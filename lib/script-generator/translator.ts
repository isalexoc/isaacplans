import OpenAI from "openai";
import {
  SECTION_KEYS,
  coerceText,
  parseJsonLoose,
  type GeneratedScript,
  type ScriptSection,
  type SectionKey,
} from "./types";

// Translates a synthesized English script into Latin American Spanish,
// preserving structure and markdown. Mirrors the blog translator rules.
const TRANSLATE_MODEL = process.env.SCRIPT_GENERATOR_MODEL ?? "gpt-4o";

const SYSTEM_PROMPT = `You are a professional translator specializing in insurance sales content for a U.S.-based bilingual insurance agency targeting Spanish-speaking clients.

Translate the provided English sales-script fields into Latin American Spanish.

Rules:
- Keep the tone natural and spoken — these are lines an agent reads aloud to a client.
- Preserve all markdown formatting (##, ###, **bold**, - bullets) and the JSON structure exactly.
- Use insurance terms familiar to U.S. Latino audiences (e.g., "seguro de salud", "deducible", "prima", "cobertura").
- Do NOT translate proper nouns / brand and program names: "ACA", "Obamacare", "Medicaid", "Medicare", "IUL", "Isaac Plans Insurance", "Isaac Orraiz", plan tier names (Bronze, Silver, Gold, Platinum).
- Translate every text field. Do not add or remove fields.
- Return only the JSON object. No explanation.`;

interface RawSection {
  content?: string;
  tips?: string;
}

interface RawTranslation {
  title?: string;
  description?: string;
  completeScript?: string;
  openingIntroduction?: RawSection;
  discoveryQuestions?: RawSection;
  productPresentation?: RawSection;
  closingTechniques?: RawSection;
  objectionHandling?: RawSection;
  psychologySalesTips?: RawSection;
}

function buildPrompt(en: GeneratedScript): string {
  const input = {
    title: en.title,
    description: en.description,
    completeScript: en.completeScript,
    ...SECTION_KEYS.reduce((acc, key) => {
      acc[key] = { content: en.sections[key].content, tips: en.sections[key].tips };
      return acc;
    }, {} as Record<SectionKey, ScriptSection>),
  };

  return `Translate these English sales-script fields to Latin American Spanish, keeping the same JSON structure:

${JSON.stringify(input, null, 2)}

Return JSON with the exact same keys and all text translated.`;
}

export async function translateScript(en: GeneratedScript): Promise<GeneratedScript> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let rawContent: string;
  try {
    const response = await client.chat.completions.create({
      model: TRANSLATE_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(en) },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI API error during translation: ${msg}`);
  }

  const parsed = parseJsonLoose<RawTranslation>(rawContent);
  if (!parsed) {
    throw new Error(`Failed to parse translation response as JSON. Raw: ${rawContent.slice(0, 500)}`);
  }

  const sections = SECTION_KEYS.reduce((acc, key) => {
    const raw = parsed[key];
    // Fall back to the English text if the model dropped a field, so the
    // required Sanity fields are never empty.
    acc[key] = {
      content: coerceText(raw?.content).trim() || en.sections[key].content,
      tips: coerceText(raw?.tips).trim() || en.sections[key].tips,
    };
    return acc;
  }, {} as Record<SectionKey, ScriptSection>);

  return {
    title: coerceText(parsed.title).trim() || en.title,
    description: coerceText(parsed.description).trim() || en.description,
    completeScript: coerceText(parsed.completeScript).trim() || en.completeScript,
    sections,
  };
}
