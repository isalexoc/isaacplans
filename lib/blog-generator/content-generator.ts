import OpenAI from "openai";
import { textToBlocks } from "./portable-text";
import {
  VALID_CATEGORIES,
  type BlogCategory,
  type GeneratedBlogContent,
  type YouTubeExtractionResult,
} from "./types";

const SYSTEM_PROMPT = `You are a professional insurance content writer and SEO strategist for Isaac Plans Insurance, a bilingual insurance agency serving Hispanic/Latino families across the United States.

Your job is to transform YouTube video transcripts into authoritative, SEO-optimized blog posts that educate readers AND generate insurance leads.

## Lines of business (always connect to at least one)
- ACA / Obamacare health insurance
- Temporary / Short-term health insurance
- Dental & Vision insurance
- Hospital Indemnity insurance
- Indexed Universal Life (IUL) — tax-advantaged savings + life insurance
- Final Expense / burial insurance
- Cancer Plans
- Heart Attack & Stroke plans
- General insurance education and tips

## Lead-generation mandate
Every post MUST connect the video topic to at least one line of business above, even when the connection is indirect. Find the natural bridge and weave it in organically — never awkward or forced. Examples:
- Healthy eating / wellness video → cancer plans, hospital indemnity, ACA preventive benefits
- Saving money / budgeting → IUL as a tax-free savings vehicle, ACA subsidies
- Retirement planning → IUL, final expense, protecting family assets
- Any health topic → relevant health insurance line
End every post with a soft paragraph encouraging readers to contact Isaac Plans for a free consultation about the relevant product — no hard sells, just a helpful invitation.

## SEO requirements
- Place the focus keyword in: the title, the opening paragraph, at least two H2 headings, and the meta description.
- Weave in semantic / LSI keywords naturally — do not keyword-stuff.
- Write at least one section that directly answers a common search question (featured-snippet style: a short direct answer followed by elaboration).
- Search intent: informational + local (reader wants to learn AND find a trusted local agent).
- U.S. audience; use USD for any amounts.

## Required structure
1. Hook intro — open with the reader's pain point or question, state what they will learn
2. 3–5 H2 sections with H3 sub-sections where helpful
3. Bullet-point key takeaways in at least one section
4. Insurance connection section — bridge the topic to the relevant line of business naturally
5. Closing soft CTA — invite readers to reach out to Isaac Plans for a free consultation

## Content rules
- Use only facts explicitly stated in the transcript. Never invent statistics, dates, or quotes.
- If the transcript is vague, write about the topic generally — never fabricate specifics.
- Body length: 900–1400 words.

## Markdown format (will be converted to Portable Text)
- ## for H2, ### for H3, #### for H4
- **text** for bold
- - for bullet lists
- NO numbered lists, blockquotes, tables, or inline code
- Blank line between every section`;

function buildUserPrompt(extraction: YouTubeExtractionResult): string {
  const { metadata, transcript } = extraction;
  return `Video title: ${metadata.title}
Channel: ${metadata.channelName}
Published: ${metadata.publishedAt}
Duration: ${metadata.durationSeconds} seconds

Transcript:
${transcript}

---

IMPORTANT: Even if this video does not directly mention insurance, you MUST find a natural, organic connection to at least one of Isaac Plans' lines of business and weave it into the content — especially in a dedicated section and in the closing CTA. The goal is always to educate the reader AND generate insurance leads for Isaac Plans Insurance.

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
- title: compelling, SEO-optimized, max 70 chars — must include the focus keyword
- excerpt: 150–160 chars, written as a search-result snippet that creates curiosity and includes the focus keyword
- body: full post following the structure and markdown rules above
- category: exactly one of: aca | temporary-health-insurance | dental-vision | hospital-indemnity | iul | final-expense | cancer-plans | heart-stroke | general | tips-guides | news
- tags: 8–12 specific tags (mix of topic tags and insurance product tags)
- readingTime: estimated reading time in minutes (integer)
- seo.metaTitle: max 60 chars, different wording from the post title, includes focus keyword
- seo.metaDescription: 140–160 chars — compelling snippet that includes the focus keyword and a subtle benefit/CTA
- seo.focusKeyword: the single best-ranking keyword phrase for this post (2–5 words)
- seo.keywords: 6–10 LSI/semantic keywords that support the focus keyword (array of strings)

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
    title: `The current title is: "${currentContent.title}"\nWrite one improved, SEO-optimized title (max 70 chars) that includes the focus keyword "${currentContent.seo.focusKeyword}" and better captures the main topic. Return only the title string, no explanation, no quotes.\n\nTranscript: ${extraction.transcript}`,
    excerpt: `The current excerpt is: "${currentContent.excerpt}"\nWrite an improved 150–160 character search-result snippet that includes the focus keyword "${currentContent.seo.focusKeyword}", creates curiosity, and hints at the insurance connection. Return only the excerpt string, no explanation, no quotes.\n\nPost title: ${currentContent.title}\nTranscript: ${extraction.transcript}`,
    body: `Regenerate the full blog post body. Follow these rules exactly:\n- ## for H2, ### for H3, **text** for bold, - for bullet lists\n- No numbered lists, tables, or blockquotes\n- 900–1400 words\n- Must include a section connecting the topic to Isaac Plans' insurance lines of business\n- Must end with a soft CTA inviting readers to contact Isaac Plans for a free consultation\nReturn only the markdown body, no JSON wrapper, no explanation.\n\nVideo title: ${extraction.metadata.title}\nCategory: ${currentContent.category}\nFocus keyword: ${currentContent.seo.focusKeyword}\nTranscript: ${extraction.transcript}`,
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
