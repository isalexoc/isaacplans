import OpenAI from "openai";
import { and, eq, notInArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { videoAssets } from "@/lib/db/schema";

/**
 * Cross-post asset library: every scene image/clip generated anywhere gets registered here
 * (write-through, unconditional), so a later scene with a similar `imageConcept` can reuse it
 * instead of paying to generate a fresh one. Matching is cosine similarity over an OpenAI
 * embedding of `concept`, scoped to the same category + locale (subject demographics differ by
 * locale — see `getDemographicHint` in image-generator.ts — so cross-locale reuse is wrong).
 *
 * All functions here are soft-fail: a library read/write problem must never break generation.
 */

// Balanced default — lower (~0.78) reuses more aggressively, higher (~0.88) more conservatively.
const REUSE_THRESHOLD = Number(process.env.VIDEO_ASSET_REUSE_THRESHOLD) || 0.83;

async function embedConcept(text: string): Promise<number[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return res.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

/** Register a freshly generated scene image. Always called, regardless of the reuse toggle. */
export async function registerImageAsset(opts: {
  imageUrl: string;
  concept: string;
  category: string;
  locale?: string;
  sourcePostId?: string;
}): Promise<void> {
  try {
    const embedding = await embedConcept(opts.concept);
    await db.insert(videoAssets).values({
      id:           nanoid(),
      imageUrl:     opts.imageUrl,
      concept:      opts.concept,
      category:     opts.category,
      locale:       opts.locale ?? null,
      embedding,
      sourcePostId: opts.sourcePostId ?? null,
    }).onConflictDoNothing({ target: videoAssets.imageUrl });
  } catch (e) {
    console.warn("[video-asset-library] registerImageAsset failed:", (e as Error).message);
  }
}

/**
 * Register a freshly generated Veo clip. Upserts onto the existing image row (the common case
 * — the image was already registered by `registerImageAsset`); only inserts a fresh row if that
 * image was never registered (e.g. it came from a reused/legacy asset).
 */
export async function registerClipAsset(opts: {
  imageUrl: string;
  videoClipUrl: string;
  clipDurationSec?: number;
  concept?: string;
  category?: string;
  locale?: string;
  sourcePostId?: string;
}): Promise<void> {
  try {
    const updated = await db.update(videoAssets)
      .set({ videoClipUrl: opts.videoClipUrl, clipDurationSec: opts.clipDurationSec ?? null, updatedAt: new Date() })
      .where(eq(videoAssets.imageUrl, opts.imageUrl))
      .returning({ id: videoAssets.id });
    if (updated.length > 0) return;
    if (!opts.concept || !opts.category) return; // not enough info to register a fresh row

    const embedding = await embedConcept(opts.concept);
    await db.insert(videoAssets).values({
      id:              nanoid(),
      imageUrl:        opts.imageUrl,
      videoClipUrl:    opts.videoClipUrl,
      clipDurationSec: opts.clipDurationSec ?? null,
      concept:         opts.concept,
      category:        opts.category,
      locale:          opts.locale ?? null,
      embedding,
      sourcePostId:    opts.sourcePostId ?? null,
    }).onConflictDoNothing({ target: videoAssets.imageUrl });
  } catch (e) {
    console.warn("[video-asset-library] registerClipAsset failed:", (e as Error).message);
  }
}

export type ReusableVideoAsset = {
  imageUrl: string;
  videoClipUrl?: string;
  clipDurationSec?: number;
};

/**
 * Find a library asset close enough to `concept` to reuse instead of generating a fresh one.
 * Scoped to the same category + locale. Prefers a clip-bearing match over a higher-scoring
 * image-only one when `preferClip` is set. Returns null when nothing clears the threshold.
 */
export async function findReusableAsset(opts: {
  category: string;
  locale?: string;
  concept: string;
  preferClip: boolean;
  excludeImageUrls?: string[];
}): Promise<ReusableVideoAsset | null> {
  try {
    const queryVec = await embedConcept(opts.concept);
    const exclude = (opts.excludeImageUrls ?? []).filter(Boolean);
    const rows = await db.select().from(videoAssets).where(
      and(
        eq(videoAssets.category, opts.category),
        eq(videoAssets.locale, opts.locale ?? "en"),
        ...(exclude.length ? [notInArray(videoAssets.imageUrl, exclude)] : []),
      ),
    );

    const scored = rows
      .map((row) => ({ row, score: cosineSimilarity(queryVec, row.embedding) }))
      .filter((s) => s.score >= REUSE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      console.log(`[video-asset-library] no match >= ${REUSE_THRESHOLD} for "${opts.concept.slice(0, 60)}"`);
      return null;
    }

    const withClip = scored.filter((s) => s.row.videoClipUrl);
    const pick = (opts.preferClip && withClip.length > 0 ? withClip[0] : scored[0]).row;

    void db.update(videoAssets)
      .set({ useCount: pick.useCount + 1, updatedAt: new Date() })
      .where(eq(videoAssets.id, pick.id))
      .catch((e) => console.warn("[video-asset-library] useCount bump failed:", (e as Error).message));

    return {
      imageUrl:        pick.imageUrl,
      videoClipUrl:    pick.videoClipUrl ?? undefined,
      clipDurationSec: pick.clipDurationSec ?? undefined,
    };
  } catch (e) {
    console.warn("[video-asset-library] findReusableAsset failed:", (e as Error).message);
    return null;
  }
}
