import OpenAI from "openai";
import { LEAD_MAGNET_SYSTEM_PROMPT, buildOutlinePrompt } from "./prompts";
import type {
  LeadMagnetCategory,
  LeadMagnetOutline,
  LeadMagnetPromptInput,
  LeadMagnetSection,
} from "./types";

interface RawOutline {
  title: string;
  subtitle: string;
  targetAudience: string;
  category: string;
  keyBenefits: string[];
  sections: Array<{ sectionTitle: string; keyPoints: string[] }>;
  estimatedWordCount: number;
  estimatedPages: number;
}

function validateAndNormalize(
  raw: RawOutline,
  input: LeadMagnetPromptInput
): LeadMagnetOutline {
  const requiredFields: (keyof RawOutline)[] = [
    "title",
    "subtitle",
    "targetAudience",
    "category",
    "keyBenefits",
    "sections",
    "estimatedWordCount",
    "estimatedPages",
  ];
  for (const field of requiredFields) {
    if (raw[field] === undefined || raw[field] === null) {
      throw new Error(`Outline validation failed: missing required field "${field}"`);
    }
  }

  if (!Array.isArray(raw.keyBenefits) || raw.keyBenefits.length < 3) {
    throw new Error(
      `Outline validation failed: keyBenefits has ${Array.isArray(raw.keyBenefits) ? raw.keyBenefits.length : 0} items, minimum is 3`
    );
  }

  if (!Array.isArray(raw.sections) || raw.sections.length < 6 || raw.sections.length > 8) {
    throw new Error(
      `Outline validation failed: sections array has ${Array.isArray(raw.sections) ? raw.sections.length : 0} items, expected 6–8`
    );
  }

  const sections: LeadMagnetSection[] = raw.sections.map((s, i) => {
    if (!s.sectionTitle?.trim()) {
      throw new Error(`Outline validation failed: section ${i + 1} has an empty sectionTitle`);
    }
    if (!Array.isArray(s.keyPoints) || s.keyPoints.length < 3) {
      throw new Error(
        `Outline validation failed: section ${i + 1} "${s.sectionTitle}" has fewer than 3 keyPoints`
      );
    }
    return { sectionTitle: s.sectionTitle.trim(), keyPoints: s.keyPoints };
  });

  const estimatedWordCount = sections.length * 1000 + 700;
  const estimatedPages = Math.ceil(estimatedWordCount / 400);

  return {
    title: raw.title.slice(0, 80),
    subtitle: raw.subtitle.slice(0, 160),
    targetAudience: raw.targetAudience,
    category: input.category as LeadMagnetCategory,
    keyBenefits: raw.keyBenefits.slice(0, 5),
    sections,
    estimatedWordCount,
    estimatedPages,
  };
}

export async function generateLeadMagnetOutline(
  input: LeadMagnetPromptInput
): Promise<LeadMagnetOutline> {
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
        { role: "system", content: LEAD_MAGNET_SYSTEM_PROMPT },
        { role: "user", content: buildOutlinePrompt(input) },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI outline generation failed: ${msg}`);
  }

  let parsed: RawOutline;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(
      `Failed to parse outline JSON. Raw response: ${rawContent.slice(0, 500)}`
    );
  }

  return validateAndNormalize(parsed, input);
}
