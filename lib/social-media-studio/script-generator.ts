import OpenAI from "openai";
import { VIDEO_SCRIPT_SYSTEM_PROMPT, buildVideoScriptPrompt } from "./prompts";
import type { VideoScript, VideoScriptRequest } from "./types";

export async function generateVideoScript(
  req: VideoScriptRequest
): Promise<VideoScript> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model:           process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VIDEO_SCRIPT_SYSTEM_PROMPT },
      { role: "user",   content: buildVideoScriptPrompt(req.source, req.duration) },
    ],
    max_tokens:  2000,
    temperature: 0.8,
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
  const s   = raw.script ?? raw;

  return validateVideoScript(s, req.duration);
}

function validateVideoScript(raw: unknown, duration: 30 | 60): VideoScript {
  const r = raw as Record<string, unknown>;

  if (!r.fullScript) throw new Error("AI returned no video script content");
  if (!r.hookScript) throw new Error("AI returned no hook script");

  return {
    duration,
    hookScript:               String(r.hookScript),
    fullScript:               String(r.fullScript),
    onScreenTextSuggestions:  Array.isArray(r.onScreenTextSuggestions)
      ? (r.onScreenTextSuggestions as string[]).map(String)
      : [],
    brollSuggestions:         Array.isArray(r.brollSuggestions)
      ? (r.brollSuggestions as string[]).map(String)
      : [],
    voiceoverTips:            String(r.voiceoverTips ?? ""),
    suggestedCaption:         String(r.suggestedCaption ?? ""),
  };
}
