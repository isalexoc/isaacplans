import OpenAI from "openai";
import { textToBlocks } from "./portable-text";
import type { GeneratedBlogContent, TranslatedBlogContent } from "./types";

const SYSTEM_PROMPT = `You are a professional translator specializing in insurance content for a U.S.-based bilingual insurance agency targeting Spanish-speaking clients.

Translate the provided English insurance blog post fields into Latin American Spanish.

Rules:
- Maintain the exact same tone: professional, clear, empathetic, helpful.
- Preserve all markdown formatting (##, ###, **bold**, - bullets) exactly as-is in the body.
- Translate insurance terminology accurately — use terms familiar to U.S. Latino audiences (e.g., "seguro de salud", "deducible", "prima", "cobertura").
- Do NOT translate proper nouns: "ACA", "Obamacare", "Medicaid", "Medicare", "Isaac Plans Insurance", "Isaac Orraiz", plan tier names (Bronze, Silver, Gold, Platinum).
- Do NOT translate SEO keywords that are better kept in English (e.g., brand names, program names).
- Return only the JSON object with translated fields. No explanation.`;

function buildTranslationPrompt(content: GeneratedBlogContent): string {
  const input = {
    title: content.title,
    excerpt: content.excerpt,
    body: content.bodyMarkdown,
    tags: content.tags,
    seo: {
      metaTitle: content.seo.metaTitle,
      metaDescription: content.seo.metaDescription,
      focusKeyword: content.seo.focusKeyword,
      keywords: content.seo.keywords,
    },
  };

  return `Translate these English insurance blog post fields to Latin American Spanish:

${JSON.stringify(input, null, 2)}

Return JSON with the same structure and all fields translated.`;
}

interface RawTranslation {
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  seo: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    keywords: string[];
  };
}

export async function translateBlogContent(
  content: GeneratedBlogContent
): Promise<TranslatedBlogContent> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
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
        { role: "user", content: buildTranslationPrompt(content) },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI API error during translation: ${msg}`);
  }

  let parsed: RawTranslation;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`Failed to parse translation response as JSON. Raw: ${rawContent.slice(0, 500)}`);
  }

  const requiredFields = ["title", "excerpt", "body", "tags", "seo"] as const;
  for (const field of requiredFields) {
    if (!parsed[field]) {
      throw new Error(`Translation response is missing required field: "${field}"`);
    }
  }

  return {
    title: parsed.title.slice(0, 70),
    excerpt: parsed.excerpt.slice(0, 200),
    bodyMarkdown: parsed.body,
    bodyBlocks: textToBlocks(parsed.body),
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    seo: {
      metaTitle: parsed.seo.metaTitle.slice(0, 60),
      metaDescription: parsed.seo.metaDescription.slice(0, 160),
      focusKeyword: parsed.seo.focusKeyword,
      keywords: Array.isArray(parsed.seo.keywords) ? parsed.seo.keywords : [],
    },
  };
}
