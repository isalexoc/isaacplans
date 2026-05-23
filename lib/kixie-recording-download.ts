import type { KixieCallSummaryConfig } from "@/lib/kixie-call-summary-config";
import { isKixieRecordingHost } from "@/lib/kixie-call-summary-config";
import {
  createCallSummaryLogger,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const RETRY_DELAYS_MS = [0, 15_000, 45_000, 90_000];
const RETRY_STATUSES = new Set([403, 502, 503, 504]);

export type DownloadedRecording = {
  buffer: ArrayBuffer;
  contentType: string;
  byteLength: number;
  finalUrl: string;
  authMethod: string;
};

function buildDownloadUrls(baseUrl: string, config: KixieCallSummaryConfig): { url: string; authMethod: string }[] {
  const attempts: { url: string; authMethod: string }[] = [{ url: baseUrl, authMethod: "plain" }];

  if (config.apiKey) {
    const u = new URL(baseUrl);
    if (!u.searchParams.has("apikey")) {
      u.searchParams.set("apikey", config.apiKey);
      if (config.businessId) u.searchParams.set("businessid", config.businessId);
      attempts.push({ url: u.toString(), authMethod: "query_apikey" });
    }
  }

  return attempts;
}

async function fetchRecordingAttempt(
  url: string,
  authMethod: string,
  config: KixieCallSummaryConfig
): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept: "audio/mpeg,audio/*,*/*;q=0.8",
    Referer: "https://www.kixie.com/",
  };
  if (authMethod === "bearer" && config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return fetch(url, {
    method: "GET",
    headers,
    redirect: "follow",
  });
}

export async function downloadKixieRecording(
  recordingUrl: string,
  config: KixieCallSummaryConfig,
  log: CallSummaryLogger = createCallSummaryLogger(config.callSummary.debug)
): Promise<DownloadedRecording> {
  let hostname = "";
  try {
    hostname = new URL(recordingUrl).hostname;
  } catch {
    throw new Error("Invalid recording URL");
  }

  if (!isKixieRecordingHost(hostname)) {
    throw new Error(`Not a Kixie recording host: ${hostname}`);
  }

  const urlAttempts = buildDownloadUrls(recordingUrl, config);
  if (config.apiKey) {
    urlAttempts.push({ url: recordingUrl, authMethod: "bearer" });
  }

  let lastStatus = 0;
  let lastPreview = "";

  for (let round = 0; round < RETRY_DELAYS_MS.length; round++) {
    const delay = RETRY_DELAYS_MS[round]!;
    if (delay > 0) {
      log.debug("Kixie recording download retry wait", { round: round + 1, delayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
    }

    for (const { url, authMethod } of urlAttempts) {
      log.debug("Kixie recording download attempt", { round: round + 1, authMethod, urlHost: hostname });
      const t0 = Date.now();
      const res = await fetchRecordingAttempt(url, authMethod, config);
      lastStatus = res.status;
      if (!res.ok) {
        lastPreview = (await res.text()).slice(0, 120);
        log.debug("Kixie recording download failed attempt", {
          authMethod,
          status: res.status,
          ms: Date.now() - t0,
        });
        if (!RETRY_STATUSES.has(res.status)) {
          throw new Error(`Failed to download recording (${res.status}): ${lastPreview}`);
        }
        continue;
      }

      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "audio/mpeg";
      log.info("Kixie recording downloaded", {
        authMethod,
        bytes: buffer.byteLength,
        ms: Date.now() - t0,
        contentType,
      });
      return {
        buffer,
        contentType,
        byteLength: buffer.byteLength,
        finalUrl: url,
        authMethod,
      };
    }
  }

  throw new Error(
    `Failed to download recording after retries (last status ${lastStatus}): ${lastPreview}`
  );
}

/** Generic recording download (GHL attachments, etc.). */
export async function downloadRecordingUrl(
  recordingUrl: string,
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<DownloadedRecording> {
  let hostname = "";
  try {
    hostname = new URL(recordingUrl).hostname;
  } catch {
    throw new Error("Invalid recording URL");
  }

  if (isKixieRecordingHost(hostname)) {
    throw new Error("Use downloadKixieRecording for Kixie hosts");
  }

  const t0 = Date.now();
  const res = await fetch(recordingUrl, {
    method: "GET",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "audio/mpeg,audio/*,*/*;q=0.8",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    const preview = (await res.text()).slice(0, 120);
    log.error("Recording download failed", { status: res.status, hostname });
    throw new Error(`Failed to download recording (${res.status}): ${preview}`);
  }

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "audio/mpeg";
  log.elapsed("Recording downloaded", t0, { bytes: buffer.byteLength, hostname });
  return {
    buffer,
    contentType,
    byteLength: buffer.byteLength,
    finalUrl: recordingUrl,
    authMethod: "plain",
  };
}
