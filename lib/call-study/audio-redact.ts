/**
 * Producing a copy of a recording with the sensitive moments replaced by a tone.
 *
 * The transcript has been redacted since this feature shipped; the AUDIO never was. Scribe masks
 * text, and the file in Cloudinary is the untouched original — so up to now there was no version of
 * a call that could be handed to another agent. This makes one.
 *
 * A tone rather than silence, deliberately: silence is indistinguishable from a pause or a dropout,
 * so a listener cannot tell "this was removed on purpose" from "the recording glitched". A beep is
 * unambiguous, and it also makes it obvious at a glance whether the redaction ran at all.
 *
 * Server-only. Uses the `ffmpeg-static` binary already vendored for the Whisper pipeline.
 */

import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import type { SensitiveSpan } from "./sensitive";

const run = promisify(execFile);

/**
 * Amplitude of the tone, 0-1.
 *
 * Audible over a phone recording without being painful on headphones. Speech on these calls sits
 * well below full scale, so matching it would make the beep the loudest thing in the file.
 */
const BEEP_AMPLITUDE = 0.2;

/** 1 kHz — the conventional censor tone, and far from any speech formant, so it cannot be misread. */
const BEEP_HZ = 1000;

/**
 * More spans than this and something is wrong with detection, not with the call.
 *
 * Also a practical bound: every span adds a term to two ffmpeg filter expressions, and the command
 * line has a length limit.
 */
const MAX_SPANS = 400;

export type RedactAudioResult =
  | { ok: true; buffer: Buffer; spans: number; maskedSeconds: number }
  | { ok: false; error: string };

/** ffmpeg reads a comma inside an option value as an option separator, so they have to be escaped. */
function escapeExpr(value: string): string {
  return value.replace(/,/g, "\\,");
}

function clamp(n: number): number {
  return Math.max(0, Math.round(n * 1000) / 1000);
}

/**
 * Build the two expressions that do the work.
 *
 * `enable` gates a `volume=0` over the original, removing the speech. `gate` multiplies a sine
 * source by the same windows so the tone exists only where the speech was. The two are mixed with
 * `normalize=0`, without which amix halves everything and the untouched call comes back quieter
 * than it went in.
 */
function buildFilters(spans: readonly SensitiveSpan[]) {
  const ranges = spans.map((s) => [clamp(s.start), clamp(s.end)] as const).filter(([a, b]) => b > a);
  const enable = ranges.map(([a, b]) => `between(t,${a},${b})`).join("+");
  const gate = ranges.map(([a, b]) => escapeExpr(`between(t,${a},${b})`)).join("+");
  return { enable, gate, count: ranges.length };
}

export async function redactAudio(input: {
  /** A URL ffmpeg can read, or a local path. The Cloudinary mp3 rendition works directly. */
  sourceUrl: string;
  spans: readonly SensitiveSpan[];
  /** Used to size the tone source; a few seconds over is harmless. */
  durationSeconds: number;
}): Promise<RedactAudioResult> {
  // `ffmpegPath` is a path string whether or not anything is at it. On Vercel the binary is only
  // present if the route was listed in `outputFileTracingIncludes` in next.config.mjs — file
  // tracing follows imports, and this one is spawned by path. Checking here turns an opaque
  // `spawn … ENOENT` into something that names the cause.
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    return {
      ok: false,
      error:
        "The audio tool is missing from this deployment. Add this route to outputFileTracingIncludes in next.config.mjs.",
    };
  }
  if (input.spans.length > MAX_SPANS) {
    return { ok: false, error: `Refusing to process ${input.spans.length} redactions; something is wrong with detection.` };
  }

  const { enable, gate, count } = buildFilters(input.spans);
  const dir = await mkdtemp(join(tmpdir(), "call-redact-"));
  const source = join(dir, "source.mp3");
  const output = join(dir, "shareable.mp3");

  try {
    // Fetched here rather than handed to ffmpeg as a URL: a signed or redirecting Cloudinary URL is
    // handled correctly by fetch, and a network stall then fails as a clear error rather than as an
    // ffmpeg timeout halfway through an encode.
    const res = await fetch(input.sourceUrl);
    if (!res.ok) return { ok: false, error: `Could not download the recording (${res.status}).` };
    await writeFile(source, Buffer.from(await res.arrayBuffer()));

    const toneSeconds = Math.max(1, Math.ceil(input.durationSeconds) + 5);
    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", source];

    if (count > 0) {
      args.push(
        "-f", "lavfi",
        "-i", `aevalsrc=exprs=${BEEP_AMPLITUDE}*sin(2*PI*${BEEP_HZ}*t)*(${gate}):d=${toneSeconds}:s=44100`,
        "-filter_complex",
        `[0:a]volume=enable='${enable}':volume=0[quiet];[quiet][1:a]amix=inputs=2:duration=first:normalize=0[out]`,
        "-map", "[out]"
      );
    }

    args.push("-c:a", "libmp3lame", "-q:a", "4", output);

    await run(ffmpegPath, args, { maxBuffer: 1 << 26, timeout: 15 * 60 * 1000 });

    const buffer = await readFile(output);
    const seconds = input.spans.reduce((total, s) => total + Math.max(0, s.end - s.start), 0);
    return { ok: true, buffer, spans: count, maskedSeconds: Math.round(seconds * 10) / 10 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { ok: false, error: `Could not build the shareable copy: ${message}` };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
