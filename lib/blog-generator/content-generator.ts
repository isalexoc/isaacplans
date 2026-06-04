import OpenAI from "openai";
import { textToBlocks } from "./portable-text";
import {
  VALID_CATEGORIES,
  type BlogCategory,
  type GeneratedBlogContent,
  type YouTubeExtractionResult,
} from "./types";

const SYSTEM_PROMPT = `You are a professional insurance content writer for Isaac Plans Insurance, a bilingual insurance agency.
Your job is to transform YouTube video transcripts into authoritative, SEO-optimized blog posts that educate readers and convert them into insurance leads.

Tone: Professional, clear, empathetic. Use "you" to address the reader directly.
Brand voice: Helpful expert who simplifies insurance. Trustworthy, not salesy.
Structure: Every post must have a compelling intro, well-organized H2/H3 sections, bullet points for key info, and a soft CTA at the end (encourage readers to reach out for a free consultation — no hard sells).

Content rules:
- Only use facts explicitly stated in the transcript. Do not invent statistics, dates, or quotes.
- If the transcript is vague on a topic, write generally about that topic without fabricating specifics.
- Always relate content back to the insurance category it belongs to.
- Target U.S. readers; use USD for any dollar amounts mentioned.

Markdown format rules (will be converted to Portable Text):
- Use ## for H2, ### for H3, #### for H4.
- Use **text** for bold.
- Use - for bullet lists.
- Do NOT use numbered lists, blockquotes, tables, or inline code.
- Separate sections with a blank line.
- Body length: 800–1200 words.`;

function buildUserPrompt(extraction: YouTubeExtractionResult): string {
  const { metadata, transcript } = extraction;
  return `Video title: ${metadata.title}
Channel: ${metadata.channelName}
Published: ${metadata.publishedAt}
Duration: ${metadata.durationSeconds} seconds

Transcript:
${transcript}

---

Generate a complete blog post JSON with this exact structure:
{
  "title": "...",
  "excerpt": "...",
  "body": "...",
  "category": "...",
  "tags": ["..."],
  "readingTime": 0,
  "seo": {
    "metaTitle": "...",
    "metaDescription": "...",
    "focusKeyword": "...",
    "keywords": ["..."]
  }
}

Field rules:
- title: compelling, SEO-optimized, max 70 chars
- excerpt: 150–160 char summary for search results and cards
- body: full post in the markdown format described above
- category: exactly one of: aca | temporary-health-insurance | dental-vision | hospital-indemnity | iul | final-expense | cancer-plans | heart-stroke | general | tips-guides | news
- tags: 6–12 specific tags relevant to this post (array of strings)
- readingTime: estimated reading time in minutes (integer)
- seo.metaTitle: max 60 chars, different wording from post title
- seo.metaDescription: 120–160 chars for Google snippet
- seo.focusKeyword: primary keyword phrase
- seo.keywords: 5–10 additional keywords (array of strings)

Return only the JSON object. No markdown wrapper, no explanation.`;
}

interface RawGeneratedPost {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  readingTime: number;
  seo: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    keywords: string[];
  };
}

function validateAndNormalize(raw: RawGeneratedPost): Omit<GeneratedBlogContent, "bodyBlocks"> & { bodyMarkdown: string } {
  const requiredFields: (keyof RawGeneratedPost)[] = ["title", "excerpt", "body", "category", "tags", "readingTime", "seo"];
  for (const field of requiredFields) {
    if (raw[field] === undefined || raw[field] === null) {
      throw new Error(`Generated content is missing required field: "${field}"`);
    }
  }

  const seoFields = ["metaTitle", "metaDescription", "focusKeyword", "keywords"] as const;
  for (const field of seoFields) {
    if (!raw.seo[field]) {
      throw new Error(`Generated content is missing required SEO field: "seo.${field}"`);
    }
  }

  const category: BlogCategory = VALID_CATEGORIES.includes(raw.category as BlogCategory)
    ? (raw.category as BlogCategory)
    : "general";

  return {
    title: raw.title.slice(0, 70),
    excerpt: raw.excerpt.slice(0, 200),
    bodyMarkdown: raw.body,
    category,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    readingTime: Math.max(1, Math.round(Number(raw.readingTime) || 1)),
    seo: {
      metaTitle: raw.seo.metaTitle.slice(0, 60),
      metaDescription: raw.seo.metaDescription.slice(0, 160),
      focusKeyword: raw.seo.focusKeyword,
      keywords: Array.isArray(raw.seo.keywords) ? raw.seo.keywords : [],
    },
  };
}

export async function generateBlogContent(
  extraction: YouTubeExtractionResult
): Promise<GeneratedBlogContent> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (extraction.transcript.trim().length < 500) {
    throw new Error(
      "Transcript is too short (minimum 500 characters). The video may have very limited captions or content."
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let rawContent: string;
  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(extraction) },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI API error: ${msg}`);
  }

  let parsed: RawGeneratedPost;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`Failed to parse OpenAI response as JSON. Raw response: ${rawContent.slice(0, 500)}`);
  }

  const normalized = validateAndNormalize(parsed);
  const bodyBlocks = textToBlocks(normalized.bodyMarkdown);

  return { ...normalized, bodyBlocks };
}

export async function regenerateField(
  field: "title" | "excerpt" | "body",
  extraction: YouTubeExtractionResult,
  currentContent: GeneratedBlogContent
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompts: Record<"title" | "excerpt" | "body", string> = {
    title: `The current title is: "${currentContent.title}"\nBased on the transcript below, suggest one improved, SEO-optimized title (max 70 chars) that better captures the main topic. Return only the title string, no explanation, no quotes.\n\nTranscript: ${extraction.transcript}`,
    excerpt: `The current excerpt is: "${currentContent.excerpt}"\nWrite an improved 150–160 character excerpt that better summarizes the post for search results. Return only the excerpt string, no explanation, no quotes.\n\nPost title: ${currentContent.title}\nTranscript: ${extraction.transcript}`,
    body: `Regenerate the full blog post body based on the transcript. Use these markdown format rules: ## for H2, ### for H3, **text** for bold, - for bullet lists. No numbered lists, tables, or blockquotes. 800–1200 words. Return only the markdown body, no JSON wrapper, no explanation.\n\nVideo title: ${extraction.metadata.title}\nTranscript: ${extraction.transcript}`,
  };

  let rawContent: string;
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompts[field] },
      ],
    });
    rawContent = (response.choices[0]?.message?.content ?? "").trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI API error during regeneration: ${msg}`);
  }

  if (!rawContent) throw new Error("OpenAI returned an empty response");

  if (field === "title") return rawContent.slice(0, 70);
  if (field === "excerpt") return rawContent.slice(0, 200);
  return rawContent;
}
