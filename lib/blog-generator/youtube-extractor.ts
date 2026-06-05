import { YoutubeTranscript } from "youtube-transcript";
import type { YouTubeExtractionResult, YouTubeMetadata } from "./types";

const YOUTUBE_URL_PATTERNS = [
  /[?&]v=([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /\/shorts\/([a-zA-Z0-9_-]{11})/,
  /\/embed\/([a-zA-Z0-9_-]{11})/,
];

export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Parses ISO 8601 duration (e.g. PT12M34S) to total seconds
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchMetadata(videoId: string): Promise<YouTubeMetadata> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    throw new Error("Video not found");
  }

  const item = data.items[0];
  const snippet = item.snippet;
  const contentDetails = item.contentDetails;

  const thumbnailUrl =
    snippet.thumbnails?.maxres?.url ??
    snippet.thumbnails?.high?.url ??
    snippet.thumbnails?.medium?.url ??
    "";

  return {
    videoId,
    title: snippet.title,
    description: (snippet.description as string).slice(0, 500),
    channelName: snippet.channelTitle,
    thumbnailUrl,
    durationSeconds: parseDuration(contentDetails.duration),
    publishedAt: snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

// Primary: Supadata API (works from Vercel/AWS IPs via residential proxy)
async function fetchTranscriptSupadata(
  videoId: string
): Promise<{ text: string; language: string }> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) throw new Error("SUPADATA_API_KEY not configured");

  const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supadata API ${res.status}: ${body || res.statusText}`);
  }

  const data = await res.json() as { content?: unknown; lang?: string };

  // With text=true, content is a plain string
  // Without it, content is an array of segments — handle both for safety
  let text: string;
  if (typeof data.content === "string") {
    text = data.content;
  } else if (Array.isArray(data.content)) {
    text = (data.content as Array<{ text: string }>).map((s) => s.text.trim()).join(" ");
  } else {
    throw new Error("Supadata returned unexpected response format");
  }

  if (!text.trim()) throw new Error("Supadata returned an empty transcript");

  return { text, language: data.lang ?? "en" };
}

// Fallback: youtube-transcript library (works locally, blocked on Vercel AWS IPs)
async function fetchTranscriptLocal(
  videoId: string
): Promise<{ text: string; language: string }> {
  const attempts = [
    () => YoutubeTranscript.fetchTranscript(videoId, { lang: "en" }),
    () => YoutubeTranscript.fetchTranscript(videoId),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const segments = await attempt();
      if (segments.length === 0) continue;
      const text = segments.map((s) => s.text.trim()).join(" ");
      return { text, language: "en" };
    } catch (err) {
      lastError = err;
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(msg);
}

async function fetchTranscript(
  videoId: string
): Promise<{ text: string; language: string }> {
  // Use Supadata in production (bypasses YouTube's datacenter IP blocks).
  // Fall back to the local library when the key isn't set (dev).
  if (process.env.SUPADATA_API_KEY) {
    try {
      return await fetchTranscriptSupadata(videoId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[youtube-extractor] Supadata failed, falling back:", msg);
      // Fall through to local fallback
    }
  }

  try {
    return await fetchTranscriptLocal(videoId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.toLowerCase().includes("disabled") ||
      msg.toLowerCase().includes("no transcript") ||
      msg.toLowerCase().includes("captcha") ||
      msg.toLowerCase().includes("too many")
    ) {
      throw new Error(
        "No transcript is available for this video. " +
        "The video may have transcripts disabled, be private, or YouTube is blocking server requests. " +
        "Ensure SUPADATA_API_KEY is set in production."
      );
    }
    throw new Error(`Failed to fetch transcript: ${msg}`);
  }
}

export async function extractYouTubeData(
  url: string
): Promise<YouTubeExtractionResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...");
  }

  const [metadata, transcriptResult] = await Promise.all([
    fetchMetadata(videoId),
    fetchTranscript(videoId),
  ]);

  return {
    metadata,
    transcript: transcriptResult.text,
    transcriptLanguage: transcriptResult.language,
    extractedAt: new Date().toISOString(),
  };
}
