import OpenAI from "openai";
import { extractYouTubeData } from "@/lib/blog-generator/youtube-extractor";
import {
  coerceText,
  lineOfBusinessLabel,
  normalizeLanguage,
  parseJsonLoose,
  type LineOfBusiness,
  type SourceType,
  type VideoDistillation,
} from "./types";

// Per-video "map" step. We deliberately distill each video on its own so the
// number of source links never affects a single function's runtime or the
// final synthesis token budget. Uses the cheap model — this is a compression
// pass, not the creative one.
const DISTILL_MODEL = process.env.SCRIPT_DISTILL_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const MIN_TRANSCRIPT_CHARS = 200;

function buildSystemPrompt(lob: LineOfBusiness): string {
  return `You are an expert insurance sales analyst. You are given the raw transcript of a YouTube video that relates to selling ${lineOfBusinessLabel(lob)} insurance. The video is either a recorded sales call with a client, a sales-training session, or general talk.

Your job: extract ONLY the sales-relevant substance and discard everything else.

Discard / ignore:
- Presenter intros and outros ("hey guys, welcome back", "in this video I'm going to...", channel promos)
- Subscribe / like / sponsor / ad-read segments
- Off-topic small talk and filler
- Anything not useful for building a real sales script

Keep and summarize faithfully (only what is actually in the transcript — never invent):
- The exact call/opening flow and rapport-building language
- Discovery / qualifying questions asked
- How the product is presented and framed (benefits, analogies, numbers mentioned)
- Closing techniques and the specific language used to ask for the sale
- Objections raised and how they were answered (verbatim phrasing where useful)
- Psychology, tone, and persuasion tactics demonstrated

Be concrete and quote useful phrasing. Do not editorialize. If the video has little usable sales content, say so briefly.`;
}

function buildUserPrompt(
  title: string,
  channelName: string,
  transcript: string
): string {
  return `Video title: ${title}
Channel: ${channelName}

Transcript:
${transcript}

---
Return a JSON object with this exact shape:
{
  "language": "en" | "es",
  "sourceType": "call" | "training" | "other",
  "insights": "..."
}

- language: the primary language SPOKEN in the video — "es" for Spanish, "en" for English.
- sourceType: a single string, one of "call" | "training" | "other". "call" if this is a recorded sales call with a real/role-play client, "training" if it teaches how to sell, otherwise "other".
- insights: a SINGLE markdown STRING (not an object, not key/value pairs, not nested JSON). Write the insights in the SAME language as the video (keep Spanish in Spanish, English in English) so verbatim phrasing is preserved. Use markdown headings (## Opening, ## Discovery, ## Presentation, ## Closing, ## Objections, ## Psychology) with bullet points underneath. Keep useful verbatim phrasing. ~300–800 words. No preamble.

Return only the JSON object with exactly those three keys.`;
}

interface RawDistillation {
  language?: string;
  sourceType?: string;
  insights?: string;
}

function normalizeSourceType(value: string | undefined): SourceType {
  if (value === "call" || value === "training" || value === "other") return value;
  return "other";
}

export async function distillVideo(
  url: string,
  lineOfBusiness: LineOfBusiness
): Promise<VideoDistillation> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const extraction = await extractYouTubeData(url.trim());
  const { metadata, transcript, transcriptLanguage } = extraction;

  if (transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
    throw new Error(
      "Transcript is too short or unavailable for this video. It may have captions disabled."
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let rawContent: string;
  try {
    const response = await client.chat.completions.create({
      model: DISTILL_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(lineOfBusiness) },
        { role: "user", content: buildUserPrompt(metadata.title, metadata.channelName, transcript) },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI API error during distillation: ${msg}`);
  }

  const parsed = parseJsonLoose<RawDistillation>(rawContent);
  if (!parsed) {
    throw new Error(`Failed to parse distillation response as JSON. Raw: ${rawContent.slice(0, 300)}`);
  }

  const insights = coerceText(parsed.insights).trim();
  if (!insights) {
    throw new Error("Distillation returned no usable sales content for this video.");
  }

  // Trust the model's language detection (it reads the actual content); fall back
  // to the transcript language reported by the extractor.
  const language = parsed.language
    ? normalizeLanguage(parsed.language)
    : normalizeLanguage(transcriptLanguage);

  return {
    videoId: metadata.videoId,
    title: metadata.title,
    channelName: metadata.channelName,
    url: metadata.url,
    durationSeconds: metadata.durationSeconds,
    sourceType: normalizeSourceType(parsed.sourceType),
    language,
    insights,
  };
}
