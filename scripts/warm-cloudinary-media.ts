/**
 * Force Cloudinary to generate every derived asset the /agent-crm page delivers, so no visitor is
 * ever the one who pays for a transcode.
 *
 *   pnpm warm:media
 *
 * ─── Why this exists ───
 *
 * Cloudinary stores the original on upload, but a URL carrying a transformation
 * (`w_1600,c_limit,f_mp4,...`) describes a file that does not exist until somebody asks for it.
 * The first request triggers the transcode and waits for it. For the Spanish walkthrough — a
 * 493.9 MB master — that is minutes, and the person paying it is whoever pressed play first.
 *
 * Requesting each URL once moves that cost here. Cloudinary then stores the derived asset and
 * serves it from its CDN to everyone afterwards.
 *
 * Run this after changing a transformation string, swapping a video, or uploading new artwork.
 * Re-running is free once the assets are warm — it simply confirms each one responds immediately.
 *
 * ─── What "ready" means ───
 *
 * A still-generating derived video answers a range request without a total size, or stalls. So
 * "ready" is: the URL reports its full byte count AND serves a chunk quickly. Both, because either
 * alone can be true of an asset that is still being written.
 */
import "dotenv/config";
import { agentCrmMediaUrls } from "../lib/agent-crm-affiliate";

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

async function main(): Promise<void> {
  const assets = agentCrmMediaUrls();
  process.stdout.write(`Warming ${assets.length} Cloudinary assets for /agent-crm\n`);

  const failed: string[] = [];
  for (const { label, url } of assets) {
    const ok = await warm(label, url);
    if (!ok) failed.push(label);
  }

  process.stdout.write("\n" + "─".repeat(60) + "\n");
  if (failed.length === 0) {
    process.stdout.write(`All ${assets.length} assets are generated and served from CDN.\n`);
    return;
  }
  process.stdout.write(`${failed.length} asset(s) not confirmed: ${failed.join(", ")}\n`);
  process.stdout.write(
    "A large video can legitimately still be transcoding — re-run this in a few minutes.\n"
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("warm:media failed:", error);
  process.exitCode = 1;
});
