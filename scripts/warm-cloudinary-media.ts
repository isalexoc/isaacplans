/**
 * Force Cloudinary to generate every derived asset the site delivers, so no visitor is ever the
 * one who pays for a transcode.
 *
 *   pnpm warm:media
 *
 * (The npm script passes `--conditions=react-server`. `lib/page-media/settings.ts` imports
 * `server-only`, whose default entrypoint throws outside a server component; that package ships an
 * empty module under the `react-server` condition, so asking Node to resolve with it lets a plain
 * script reuse the real settings code instead of a second, driftable copy of it.)
 *
 * ─── Why this exists ───
 *
 * Cloudinary stores the original on upload, but a URL carrying a transformation
 * (`f_mp4,vc_h264,w_1280,...`) describes a file that does not exist until somebody asks for it.
 * The first request triggers the transcode and waits for it. For the Spanish Final Expense hero —
 * eleven minutes — or the /agent-crm walkthrough — a 493.9 MB master — that is minutes of a
 * visitor watching a spinner above the fold.
 *
 * Requesting each URL once moves that cost here. Cloudinary then stores the derived asset and
 * serves it from its CDN to everyone afterwards.
 *
 * Run this after uploading a hero video in /admin/hero, swapping a clip, or changing a
 * transformation string. Re-running is cheap once assets are warm — it just confirms each one
 * answers immediately.
 *
 * ─── What it covers ───
 *
 *  - /agent-crm: the walkthrough, posters, stills and share cards.
 *  - Every page-media hero cell: the built-in defaults AND the overrides saved in /admin/hero,
 *    read straight from the database so an uploaded video is warmed without anyone maintaining a
 *    second list. Needs DATABASE_URL; without it the page-media half is skipped with a warning
 *    rather than failing the run.
 *
 * Only videos and their posters are worth waiting on. Plain images derive in milliseconds, but
 * they are requested too — it costs nothing and confirms the URL is actually valid.
 *
 * ─── What "ready" means ───
 *
 * A still-generating derived video answers a range request without a total size, or stalls. So
 * "ready" is: the URL reports its full byte count AND serves a chunk quickly. Both, because either
 * alone can be true of an asset that is still being written.
 */
import "dotenv/config";
import { agentCrmMediaUrls } from "../lib/agent-crm-affiliate";
import { getPageMediaForAdmin } from "../lib/page-media/settings";

/** A warm asset answers well within this; a cold one is transcoding and will blow through it. */
const CHUNK_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 20_000;
const MAX_ATTEMPTS = 45; // ~15 minutes, enough for a large video transcode.

type Probe = { ready: boolean; totalBytes: number | null; ms: number; status: number };

/** Ask for one byte. A generated asset answers `Content-Range: bytes 0-0/<total>` instantly. */
async function probe(url: string): Promise<Probe> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-0" },
      signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
    });
    const range = res.headers.get("content-range");
    const total = range?.split("/")[1];
    const totalBytes = total && total !== "*" ? Number(total) : null;
    // Drain so the connection is released rather than left hanging on a transcode.
    await res.arrayBuffer().catch(() => undefined);
    return {
      ready: res.ok && Number.isFinite(totalBytes as number) && (totalBytes as number) > 0,
      totalBytes,
      ms: Date.now() - started,
      status: res.status,
    };
  } catch {
    return { ready: false, totalBytes: null, ms: Date.now() - started, status: 0 };
  }
}

function mb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

async function warm(label: string, url: string): Promise<boolean> {
  process.stdout.write(`\n▶ ${label}\n  ${url}\n`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await probe(url);

    if (result.ready) {
      const size = result.totalBytes ? mb(result.totalBytes) : "unknown size";
      process.stdout.write(`  ✓ ready — ${size}, responded in ${result.ms} ms\n`);
      return true;
    }

    // First attempt on a cold asset is what kicks the transcode off; say so plainly rather than
    // looking like a failure.
    const why = result.status === 0 ? "no response yet (generating)" : `http ${result.status}`;
    process.stdout.write(
      `  … attempt ${attempt}/${MAX_ATTEMPTS}: ${why} — waiting ${POLL_INTERVAL_MS / 1000}s\n`
    );
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  process.stdout.write(`  ✗ still not ready after ${MAX_ATTEMPTS} attempts\n`);
  return false;
}

/**
 * Every hero cell's live media — the override when one is saved, otherwise the built-in default.
 * Deduplicated, because the same still backs several cells and warming it eight times is waste.
 */
async function pageMediaAssets(): Promise<{ label: string; url: string }[]> {
  let rows;
  try {
    rows = await getPageMediaForAdmin();
  } catch (error) {
    process.stdout.write(
      `\n⚠ Skipping page-media heroes — could not read settings ` +
        `(${error instanceof Error ? error.message : String(error)}).\n` +
        `  Set DATABASE_URL to warm admin-uploaded hero videos too.\n`
    );
    return [];
  }

  const seen = new Set<string>();
  const out: { label: string; url: string }[] = [];

  for (const row of rows) {
    // What the page actually renders today, which is the only thing worth warming.
    const media = row.override ?? row.defaultMedia;
    const where = `${row.lob}/${row.surface}/${row.kind}/${row.locale}`;
    const source = row.override ? "override" : "default";

    const push = (label: string, url: string | undefined) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({ label, url });
    };

    if (media.type === "video") {
      push(`${where} video (${source})`, media.url);
      push(`${where} poster (${source})`, media.posterUrl);
    } else {
      push(`${where} image (${source})`, media.url);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const assets = [...agentCrmMediaUrls(), ...(await pageMediaAssets())];
  process.stdout.write(`Warming ${assets.length} Cloudinary assets\n`);

  const failed: string[] = [];
  for (const { label, url } of assets) {
    const ok = await warm(label, url);
    if (!ok) failed.push(label);
  }

  process.stdout.write("\n" + "─".repeat(60) + "\n");
  if (failed.length === 0) {
    process.stdout.write(`All ${assets.length} assets are generated and served from CDN.\n`);
    // Explicit exit: the Neon client holds the event loop open otherwise.
    process.exit(0);
  }
  process.stdout.write(`${failed.length} asset(s) not confirmed: ${failed.join(", ")}\n`);
  process.stdout.write(
    "A large video can legitimately still be transcoding — re-run this in a few minutes.\n"
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("warm:media failed:", error);
  process.exit(1);
});
