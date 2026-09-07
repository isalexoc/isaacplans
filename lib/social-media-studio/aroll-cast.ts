import OpenAI, { toFile } from "openai";
import cloudinary from "@/config/cloudinary";
import { buildVideoImagePrompt, SAFE_FALLBACK_CONCEPT } from "./video-generator";
import { registerImageAsset } from "./video-asset-library";
import type { SocialLocale } from "./types";

// ─── Keeping the story's cast the same person ─────────────────────────────────────
// The difference between an ad and a folder of stock shots is that the same woman is at the
// breakfast table in shot two and holding the policy in shot six. Text alone will not do that:
// two prompts describing "a 38-year-old Latina mother" produce two different women.
//
// So the first cast shot is generated once and then handed BACK to the model as a reference for
// every later cast shot, through images.edit. Detail shots (hands, keys, a windowsill) skip the
// reference entirely — there is no face to match, and a reference would only drag the framing
// toward the one it was given.

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
const IMAGE_SIZE = "1024x1536" as const; // portrait 2:3, cover-cropped to 9:16 at render time
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `input_fidelity` is what makes the model actually hold a face rather than merely echo a style,
 * but it exists only on gpt-image-1: gpt-image-2 rejects the parameter outright because it
 * already processes every reference at high fidelity. Sending it to the wrong model is a 400,
 * so it is gated on the model name rather than always-on.
 */
function supportsInputFidelity(model: string): boolean {
  return model.startsWith("gpt-image-1");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeImageError(err: any): { status?: number; message: string; safety: boolean } {
  const status = err?.status ?? err?.statusCode ?? err?.http_code;
  const message = String(err?.error?.message ?? err?.message ?? "unknown error");
  return { status, message, safety: /safety|moderation|rejected|content[_ ]policy/i.test(message) };
}

async function uploadPng(b64: string, category: string, folder: string): Promise<string> {
  const upload = await cloudinary.uploader.upload(`data:image/png;base64,${b64}`, {
    folder:        `social-media/${category}/${folder}`,
    resource_type: "image",
  });
  return upload.secure_url;
}

/** The prompt for the one shot that defines who the story is about. */
function buildCastPrompt(cast: string, world: string, locale?: SocialLocale): string {
  const concept = [
    `A candid full-length portrait of one person: ${cast}.`,
    world ? `They are at home in ${world}.` : "",
    "They stand naturally, relaxed, looking slightly off camera, unaware of being photographed.",
    "Their whole face and body are clearly visible and well lit.",
  ]
    .filter(Boolean)
    .join(" ");
  return buildVideoImagePrompt(concept, locale);
}

/**
 * Generate the cast reference — the one image every later shot of this person is matched against.
 *
 * Stored on the storyboard rather than recomputed, so a beat re-rolled six edits later still
 * matches the beats around it.
 */
export async function generateCastReference(opts: {
  cast:     string;
  world?:   string;
  category: string;
  locale?:  SocialLocale;
}): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = buildCastPrompt(opts.cast, opts.world ?? "", opts.locale);

  const response = await openai.images.generate({
    model:   IMAGE_MODEL as "gpt-image-1",
    prompt,
    quality: "medium",
    size:    IMAGE_SIZE,
    n:       1,
  } as Parameters<typeof openai.images.generate>[0]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b64 = (response as any).data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no cast reference image");

  const url = await uploadPng(b64, opts.category, "cast");
  // Registered so a follow-up ad in the same campaign can reuse this cast rather than inventing
  // a new person — see findReusableAsset.
  await registerImageAsset({
    imageUrl: url,
    concept:  `cast: ${opts.cast}`,
    category: opts.category,
    locale:   opts.locale,
  });
  return url;
}

/**
 * Generate one cutaway image.
 *
 * With a reference and `includesCast`, this goes through images.edit so the person carries over.
 * Without one it is a plain generation — which is correct for detail and establishing shots, and
 * is also the graceful degradation when the cast reference could not be made.
 *
 * Same resilience ladder as the faceless pipeline: a moderated prompt is retried against the
 * guaranteed-safe concept, and a rate-limit or 5xx backs off. A reference that cannot be fetched
 * falls through to plain generation rather than failing the beat.
 */
export async function generateBeatImage(opts: {
  concept:       string;
  cast?:         string;
  castImageUrl?: string;
  includesCast:  boolean;
  category:      string;
  locale?:       SocialLocale;
}): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const useReference = opts.includesCast && Boolean(opts.castImageUrl);

  // Restating the cast in words as well as pictures: the reference holds the face, the text holds
  // the wardrobe and colouring, and together they drift far less than either alone.
  const conceptWithCast =
    opts.includesCast && opts.cast ? `${opts.concept} The person is ${opts.cast}.` : opts.concept;

  let concept = conceptWithCast;
  let reference: Buffer | null = useReference ? await fetchReference(opts.castImageUrl!) : null;
  let lastError = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const b64 = reference
        ? await editWithReference(openai, concept, reference, opts.locale)
        : await generatePlain(openai, concept, opts.locale);

      const url = await uploadPng(b64, opts.category, "video-images");
      await registerImageAsset({
        imageUrl: url,
        concept,
        category: opts.category,
        locale:   opts.locale,
      });
      return url;
    } catch (err) {
      const { status, message, safety } = describeImageError(err);
      lastError = `(${status ?? "?"}) ${message}`;
      console.warn(`[aroll-cast] beat image attempt ${attempt + 1} failed: ${lastError}`);

      if (safety) {
        // A moderated concept will not pass however many times it is retried. Drop the reference
        // too — a face in the frame is the most common reason a prompt trips the filter.
        concept = SAFE_FALLBACK_CONCEPT;
        reference = null;
        continue;
      }
      if (status === 400 && reference) {
        // The reference itself was rejected (wrong format, too large). The shot still matters
        // more than the consistency, so lose the reference and keep going.
        console.warn("[aroll-cast] dropping the cast reference and generating without it");
        reference = null;
        continue;
      }
      if (attempt < MAX_ATTEMPTS - 1 && (status === 429 || status === undefined || (status ?? 0) >= 500)) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  throw new Error(lastError || "Beat image generation failed");
}

async function fetchReference(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn(`[aroll-cast] could not fetch the cast reference: ${(err as Error).message}`);
    return null;
  }
}

async function editWithReference(
  openai: OpenAI,
  concept: string,
  reference: Buffer,
  locale?: SocialLocale
): Promise<string> {
  const file = await toFile(reference, "cast.png", { type: "image/png" });
  const response = await openai.images.edit({
    model:  IMAGE_MODEL as "gpt-image-1",
    image:  [file],
    prompt: `${buildVideoImagePrompt(concept, locale)} The person in this scene is the SAME person as in the reference image — the same face, hair, build and clothing. Keep them recognisably identical; change only the setting, framing and what they are doing.`,
    size:   IMAGE_SIZE,
    ...(supportsInputFidelity(IMAGE_MODEL) ? { input_fidelity: "high" } : {}),
  } as Parameters<typeof openai.images.edit>[0]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b64 = (response as any).data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image data");
  return b64;
}

async function generatePlain(openai: OpenAI, concept: string, locale?: SocialLocale): Promise<string> {
  const response = await openai.images.generate({
    model:   IMAGE_MODEL as "gpt-image-1",
    prompt:  buildVideoImagePrompt(concept, locale),
    quality: "medium",
    size:    IMAGE_SIZE,
    n:       1,
  } as Parameters<typeof openai.images.generate>[0]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b64 = (response as any).data?.[0]?.b64_json;
  if (!b64) throw new Error("The image model returned no image data");
  return b64;
}
