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

// Platforms where the exact publicUrl must appear in the cta/fullPost
const URL_REQUIRED_PLATFORMS: SocialPlatform[] = ["facebook", "threads", "google_business"];

export async function generateSocialCopy(
  source: SocialPostSource,
  platforms: SocialPlatform[] = ALL_PLATFORMS,
  locales: SocialLocale[] = ALL_LOCALES
): Promise<SocialPostCopy[]> {
  // One call per locale in parallel — keeps each prompt focused on 6 copies
  // instead of 12, preventing the model from omitting the last platform
  const results = await Promise.all(
    locales.map((locale) => generateForLocale(source, platforms, locale))
  );
  return results.flat();
}

async function generateForLocale(
  source: SocialPostSource,
  platforms: SocialPlatform[],
  locale: SocialLocale
): Promise<SocialPostCopy[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: COPY_GENERATION_SYSTEM_PROMPT },
      { role: "user",   content: buildCopyPrompt(source, platforms, [locale]) },
    ],
    max_tokens: 7000,
    temperature: 0.75,
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
  const copies: unknown[] = raw.copies ?? [];

  if (!copies.length) {
    throw new Error(`AI returned no copy for locale "${locale}". Please try again.`);
  }

  const result = copies
    .map((item, i) => validateAndNormalizeCopy(item, i))
    .map((copy) => enforceCtaUrl(copy, source.publicUrl));

  // Verify every platform is present for this locale
  const missing = platforms.filter(
    (p) => !result.find((c) => c.platform === p && c.locale === locale)
  );
  if (missing.length > 0) {
    throw new Error(
      `AI did not generate copy for: ${missing.map((p) => `${p}/${locale}`).join(", ")}. Please try again.`
    );
  }

  return result;
}

// Ensures the exact publicUrl appears in cta + fullPost for link-clickable platforms.
// If the AI mangled the URL, this replaces the wrong one; if it omitted it, appends it.
function enforceCtaUrl(copy: SocialPostCopy, publicUrl: string | undefined): SocialPostCopy {
  if (!publicUrl || !URL_REQUIRED_PLATFORMS.includes(copy.platform)) return copy;
  if (copy.cta.includes(publicUrl) && copy.fullPost.includes(publicUrl)) return copy;

  // Fix cta: replace any mangled http URL, or append if none present
  const cta = copy.cta.match(/https?:\/\/\S+/)
    ? copy.cta.replace(/https?:\/\/\S+/g, publicUrl)
    : `${copy.cta.trimEnd()} ${publicUrl}`;

  // Fix fullPost: same replacement strategy
  const fullPost = copy.fullPost.match(/https?:\/\/\S+/)
    ? copy.fullPost.replace(/https?:\/\/\S+/g, publicUrl)
    : `${copy.fullPost.trimEnd()} ${publicUrl}`;

  return { ...copy, cta, fullPost, characterCount: fullPost.length };
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
