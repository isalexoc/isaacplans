import OpenAI from "openai";
import { COPY_GENERATION_SYSTEM_PROMPT, buildCopyPrompt } from "./prompts";
import {
  type SocialPostSource,
  type SocialPlatform,
  type SocialLocale,
  type SocialPostCopy,
  ALL_PLATFORMS,
  ALL_LOCALES,
} from "./types";

export async function generateSocialCopy(
  source: SocialPostSource,
  platforms: SocialPlatform[] = ALL_PLATFORMS,
  locales: SocialLocale[] = ALL_LOCALES
): Promise<SocialPostCopy[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: COPY_GENERATION_SYSTEM_PROMPT },
      { role: "user",   content: buildCopyPrompt(source, platforms, locales) },
    ],
    max_tokens: 8000,
    temperature: 0.75,
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");

  const copies: unknown[] = raw.copies ?? [];

  if (!copies.length) {
    throw new Error("AI returned no copy variants. Check the prompt or try again.");
  }

  const result = copies.map((item, i) => validateAndNormalizeCopy(item, i));

  // Verify every requested platform+locale combination is present
  const missing: string[] = [];
  for (const platform of platforms) {
    for (const locale of locales) {
      if (!result.find((c) => c.platform === platform && c.locale === locale)) {
        missing.push(`${platform}/${locale}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`AI did not generate copy for: ${missing.join(", ")}. Please try again.`);
  }

  return result;
}

function validateAndNormalizeCopy(raw: unknown, index: number): SocialPostCopy {
  const r = raw as Record<string, unknown>;

  if (!r.platform) throw new Error(`Copy at index ${index} is missing 'platform'`);
  if (!r.locale)   throw new Error(`Copy at index ${index} is missing 'locale'`);
  if (!r.hook)     throw new Error(`Copy at index ${index} is missing 'hook'`);
  if (!r.fullPost) throw new Error(`Copy at index ${index} is missing 'fullPost'`);

  // Strip '#' prefix from any hashtags that accidentally include it
  const hashtags = Array.isArray(r.hashtags)
    ? (r.hashtags as string[]).map((h) => h.replace(/^#/, ""))
    : [];

  const fullPost  = String(r.fullPost);
  const charCount = typeof r.characterCount === "number"
    ? r.characterCount
    : fullPost.length;

  return {
    platform:       String(r.platform) as SocialPlatform,
    locale:         String(r.locale) as SocialLocale,
    hook:           String(r.hook),
    body:           String(r.body ?? ""),
    cta:            String(r.cta ?? ""),
    hashtags,
    fullPost,
    characterCount: charCount,
  };
}
