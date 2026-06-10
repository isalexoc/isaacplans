import OpenAI from "openai";
import { textToBlocks } from "@/lib/blog-generator/portable-text";
import type { GeneratedLeadMagnet, TranslatedLeadMagnet } from "./types";

const SYSTEM_PROMPT = `You are a professional translator specializing in insurance content for a U.S.-based bilingual insurance agency targeting Spanish-speaking clients.

Translate the provided English insurance guide fields into Latin American Spanish.

Rules:
- Maintain the exact same tone: professional, clear, empathetic, helpful.
- Preserve all markdown formatting (##, ###, **bold**, - bullets) exactly as-is.
- Translate insurance terminology accurately — use terms familiar to U.S. Latino audiences (e.g., "seguro de salud", "deducible", "prima", "cobertura", "gastos finales").
- Do NOT translate proper nouns: "ACA", "Obamacare", "Medicaid", "Medicare", "Isaac Plans Insurance", "Isaac Orraiz", plan tier names (Bronze, Silver, Gold, Platinum).
- Preserve "> Action Step:" blockquote syntax — translate only the label to "> Paso de Acción:".
- Return only the JSON object with translated fields. No explanation.`;

interface MetadataTranslation {
  title: string;
  subtitle: string;
  keyBenefits: string[];
  sectionTitles: string[];
  sectionKeyPoints: string[][];
  introduction: string;
  conclusion: string;
  seo: { metaTitle: string; metaDescription: string; focusKeyword: string; keywords: string[] };
  leadFormSettings: { ctaHeadline: string; ctaSubtext: string; ctaButtonText: string; successMessage: string };
}

interface SectionTranslation {
  sectionTitle: string;
  content: string;
}

async function translateMetadata(
  client: OpenAI,
  model: string,
  content: GeneratedLeadMagnet,
  enSeoOverride: { metaTitle: string; metaDescription: string; focusKeyword: string },
  enLeadFormOverride: { ctaHeadline: string; ctaSubtext: string; ctaButtonText: string; successMessage: string }
): Promise<MetadataTranslation> {
  const input = {
    title: content.outline.title,
    subtitle: content.outline.subtitle,
    keyBenefits: content.outline.keyBenefits,
    sectionTitles: content.outline.sections.map((s) => s.sectionTitle),
    sectionKeyPoints: content.outline.sections.map((s) => s.keyPoints),
    introduction: content.introduction,
    conclusion: content.conclusion,
    seo: {
      metaTitle: enSeoOverride.metaTitle,
      metaDescription: enSeoOverride.metaDescription,
      focusKeyword: enSeoOverride.focusKeyword,
      keywords: content.outline.keyBenefits.map((b) => b.split(" ").slice(0, 3).join(" ")),
    },
    leadFormSettings: enLeadFormOverride,
  };

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Translate these English insurance guide metadata fields to Latin American Spanish:\n\n${JSON.stringify(input, null, 2)}\n\nReturn JSON with the same structure and all fields translated.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const parsed: MetadataTranslation = JSON.parse(raw);
  return parsed;
}

async function translateSections(
  client: OpenAI,
  model: string,
  sections: GeneratedLeadMagnet["sections"]
): Promise<SectionTranslation[]> {
  const input = sections.map((s) => ({ sectionTitle: s.sectionTitle, content: s.content ?? "" }));

  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Translate these English insurance guide sections to Latin American Spanish. Return JSON: { "sections": [ { "sectionTitle": "...", "content": "...markdown..." }, ... ] }\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const parsed: { sections: SectionTranslation[] } = JSON.parse(raw);
  return parsed.sections;
}

export async function translateLeadMagnet(
  content: GeneratedLeadMagnet,
  enSeoOverride: { metaTitle: string; metaDescription: string; focusKeyword: string },
  enLeadFormOverride: { ctaHeadline: string; ctaSubtext: string; ctaButtonText: string; successMessage: string }
): Promise<TranslatedLeadMagnet> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const [meta, translatedSections] = await Promise.all([
    translateMetadata(client, model, content, enSeoOverride, enLeadFormOverride),
    translateSections(client, model, content.sections),
  ]);

  return {
    outline: {
      title: meta.title,
      subtitle: meta.subtitle,
      keyBenefits: meta.keyBenefits,
      sections: (meta.sectionTitles ?? []).map((title, i) => ({
        sectionTitle: title,
        keyPoints: meta.sectionKeyPoints?.[i] ?? [],
      })),
    },
    sections: translatedSections.map((s) => ({
      sectionTitle: s.sectionTitle,
      content: s.content,
      contentBlocks: textToBlocks(s.content),
    })),
    introduction: meta.introduction,
    conclusion: meta.conclusion,
    introductionBlocks: textToBlocks(meta.introduction),
    conclusionBlocks: textToBlocks(meta.conclusion),
    seo: {
      metaTitle: (meta.seo?.metaTitle ?? "").slice(0, 60),
      metaDescription: (meta.seo?.metaDescription ?? "").slice(0, 160),
      focusKeyword: meta.seo?.focusKeyword ?? "",
      keywords: Array.isArray(meta.seo?.keywords) ? meta.seo.keywords : [],
    },
    leadFormSettings: {
      ctaHeadline: meta.leadFormSettings?.ctaHeadline ?? "",
      ctaSubtext: meta.leadFormSettings?.ctaSubtext ?? "",
      ctaButtonText: meta.leadFormSettings?.ctaButtonText ?? "",
      successMessage: meta.leadFormSettings?.successMessage ?? "",
    },
  };
}
