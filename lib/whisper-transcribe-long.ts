import { execFile } from "child_process";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import type { CallSummaryConfig } from "@/lib/agent-crm-call-summary-config";
import { AGENT_CRM_API_BASE, AGENT_CRM_API_VERSION } from "@/lib/agent-crm-contacts";
import type { KixieCallSummaryConfig } from "@/lib/kixie-call-summary-config";
import { isKixieRecordingHost } from "@/lib/kixie-call-summary-config";
import {
  downloadKixieRecording,
  downloadRecordingUrl,
  type DownloadedRecording,
} from "@/lib/kixie-recording-download";
import {
  createCallSummaryLogger,
  previewText,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";

const execFileAsync = promisify(execFile);

async function getFfmpegPath(): Promise<string> {
  const mod = await import("ffmpeg-static");
  const ffmpegPath = mod.default;
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary not available for this platform");
  }
  await fs.access(ffmpegPath);
  return ffmpegPath;
}

async function whisperTranscribeBuffer(
  buffer: ArrayBuffer,
  contentType: string,
  config: CallSummaryConfig,
  log: CallSummaryLogger,
  label: string
): Promise<string> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const ext = contentType.includes("wav")
    ? "wav"
    : contentType.includes("mp4") || contentType.includes("m4a")
      ? "m4a"
      : "mp3";

  const blob = new Blob([buffer], { type: contentType });
  const form = new FormData();
  form.append("file", blob, `recording-${label}.${ext}`);
  form.append("model", config.whisperModel);
  form.append("response_format", "text");

  log.step("Whisper: transcribe segment", { label, model: config.whisperModel });
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const text = await res.text();
  log.elapsed("Whisper: transcribe segment", t0, { label, status: res.status, ok: res.ok });
  if (!res.ok) {
    throw new Error(`Whisper failed (${res.status}) for ${label}: ${text.slice(0, 500)}`);
  }
  return text.trim();
}

async function splitAudioWithFfmpeg(
  inputPath: string,
  outputPattern: string,
  segmentSeconds: number,
  log: CallSummaryLogger,
  reencode: boolean
): Promise<string[]> {
  const ffmpeg = await getFfmpegPath();
  log.step("ffmpeg: split recording", { segmentSeconds, inputPath, reencode });
  const t0 = Date.now();
  // MP3 (Kixie) splits by stream copy. WAV (GHL/Twilio) can't be copied into
  // .mp3 segments, so it's encoded to mono 32 kbps MP3, which is plenty for speech.
  const codecArgs = reencode ? ["-vn", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "32k"] : ["-c", "copy"];
  await execFileAsync(
    ffmpeg,
    [
      "-i",
      inputPath,
      "-f",
      "segment",
      "-segment_time",
      String(segmentSeconds),
      ...codecArgs,
      "-reset_timestamps",
      "1",
      outputPattern,
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  log.elapsed("ffmpeg: split complete", t0);

  const dir = join(outputPattern, "..");
  // "rec-…-chunk-" — everything before %03d (the ".mp3" after it is checked separately).
  const prefix = outputPattern
    .split(/[/\\]/)
    .pop()!
    .split("%03d")[0]!;
  const files = await fs.readdir(dir);
  const chunks = files
    .filter((f) => f.startsWith(prefix) && f.endsWith(".mp3"))
    .sort()
    .map((f) => join(dir, f));

  if (chunks.length === 0) {
    throw new Error("ffmpeg produced no segment files");
  }
  return chunks;
}

export type TranscribeRecordingResult = {
  transcript: string;
  chunksTotal: number;
};

/**
 * Download and transcribe a call recording (Kixie or generic URL).
 * Splits with ffmpeg when file exceeds maxBytesPerChunk.
 */
export async function transcribeRecordingLong(
  recordingUrl: string,
  callSummaryConfig: CallSummaryConfig,
  kixieConfig: KixieCallSummaryConfig,
  log: CallSummaryLogger = createCallSummaryLogger(callSummaryConfig.debug),
  onProgress?: (chunksDone: number, chunksTotal: number) => void
): Promise<TranscribeRecordingResult> {
  let hostname = "";
  try {
    hostname = new URL(recordingUrl).hostname;
  } catch {
    throw new Error("Invalid recording URL");
  }

  let downloaded: DownloadedRecording;
  if (isKixieRecordingHost(hostname)) {
    downloaded = await downloadKixieRecording(recordingUrl, kixieConfig, log);
  } else if (recordingUrl.startsWith(AGENT_CRM_API_BASE) && callSummaryConfig.piToken) {
    // GHL's recording endpoint (CRM-dialed calls) needs the CRM key.
    downloaded = await downloadRecordingUrl(recordingUrl, log, {
      Authorization: `Bearer ${callSummaryConfig.piToken}`,
      Version: AGENT_CRM_API_VERSION,
    });
  } else {
    downloaded = await downloadRecordingUrl(recordingUrl, log);
  }

  const { buffer, contentType, byteLength } = downloaded;
  const maxBytes = kixieConfig.recordingMaxBytes;
  const segmentSeconds = kixieConfig.whisperSegmentSeconds;

  if (byteLength <= maxBytes) {
    log.info("Single Whisper pass (under size limit)", { byteLength, maxBytes });
    const transcript = await whisperTranscribeBuffer(
      buffer,
      contentType,
      callSummaryConfig,
      log,
      "full"
    );
    onProgress?.(1, 1);
    return { transcript, chunksTotal: 1 };
  }

  const isMp3 = contentType.includes("mpeg") || contentType.includes("mp3");
  const workId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = join(tmpdir(), `${workId}.${isMp3 ? "mp3" : "wav"}`);
  const chunkPattern = join(tmpdir(), `${workId}-chunk-%03d.mp3`);

  try {
    await fs.writeFile(inputPath, Buffer.from(buffer));
    const chunkPaths = await splitAudioWithFfmpeg(
      inputPath,
      chunkPattern,
      segmentSeconds,
      log,
      !isMp3
    );
    const chunksTotal = chunkPaths.length;
    log.info("Transcribing split segments", { chunksTotal, byteLength });

    const parts: string[] = [];
    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkPath = chunkPaths[i]!;
      const chunkBuf = await fs.readFile(chunkPath);
      if (chunkBuf.byteLength > maxBytes) {
        log.warn("Segment still exceeds max bytes; may fail Whisper", {
          segment: i + 1,
          bytes: chunkBuf.byteLength,
        });
      }
      const part = await whisperTranscribeBuffer(
        chunkBuf.buffer.slice(chunkBuf.byteOffset, chunkBuf.byteOffset + chunkBuf.byteLength) as ArrayBuffer,
        "audio/mpeg",
        callSummaryConfig,
        log,
        `seg-${i + 1}`
      );
      if (part) {
        parts.push(`[Part ${i + 1}/${chunksTotal}]\n${part}`);
      }
      onProgress?.(i + 1, chunksTotal);
      await fs.unlink(chunkPath).catch(() => undefined);
    }

    const transcript = parts.join("\n\n").trim();
    if (!transcript) throw new Error("Whisper returned empty transcript for all segments");
    log.debug("Long transcript assembled", previewText(transcript, 200));
    return { transcript, chunksTotal };
  } finally {
    await fs.unlink(inputPath).catch(() => undefined);
  }
}
