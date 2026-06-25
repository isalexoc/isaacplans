import OpenAI from "openai";
import {
  SECTION_KEYS,
  coerceText,
  languageName,
  parseJsonLoose,
  type GeneratedScript,
  type ScriptLanguage,
  type ScriptSection,
  type SectionKey,
} from "./types";

// Translates a synthesized script from its source language into the other
// language, preserving structure and markdown. Mirrors the blog translator rules.
const TRANSLATE_MODEL = process.env.SCRIPT_GENERATOR_MODEL ?? "gpt-4o";
// The script can be long; give the translation room so it isn't truncated.
const MAX_TOKENS = Number(process.env.SCRIPT_GENERATOR_MAX_TOKENS) || 16000;

function buildSystemPrompt(from: ScriptLanguage, to: ScriptLanguage): string {
  const audience =
    to === "es"
      ? "Use insurance terms familiar to U.S. Latino audiences (e.g., \"seguro de salud\", \"deducible\", \"prima\", \"cobertura\")."
      : "Use clear, professional U.S. English insurance terminology.";
  return `You are a professional translator specializing in insurance sales content for a U.S.-based bilingual insurance agency.

Translate the provided sales-script fields from ${languageName(from)} into ${languageName(to)}.

Rules:
- Keep the tone natural and spoken — these are lines an agent reads aloud to a client.
- Preserve all markdown formatting (##, ###, **bold**, - bullets) and the JSON structure exactly.
- ${audience}
- Do NOT translate proper nouns / brand and program names: "ACA", "Obamacare", "Medicaid", "Medicare", "IUL", "Isaac Plans Insurance", "Isaac Orraiz", plan tier names (Bronze, Silver, Gold, Platinum).
- Translate every text field. Do not add or remove fields.
- Return only the JSON object. No explanation.`;
}

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

function buildPrompt(source: GeneratedScript, from: ScriptLanguage, to: ScriptLanguage): string {
  const input = {
    title: source.title,
    description: source.description,
    completeScript: source.completeScript,
    ...SECTION_KEYS.reduce((acc, key) => {
      acc[key] = { content: source.sections[key].content, tips: source.sections[key].tips };
      return acc;
    }, {} as Record<SectionKey, ScriptSection>),
  };

  return `Translate these ${languageName(from)} sales-script fields to ${languageName(to)}, keeping the same JSON structure:

${JSON.stringify(input, null, 2)}

Return JSON with the exact same keys and all text translated.`;
}

/** Translate a synthesized script from its source language into the other language. */
export async function translateScript(
  source: GeneratedScript,
  from: ScriptLanguage,
  to: ScriptLanguage
): Promise<GeneratedScript> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let rawContent: string;
  try {
    const response = await client.chat.completions.create({
      model: TRANSLATE_MODEL,
      response_format: { type: "json_object" },
      max_completion_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: buildSystemPrompt(from, to) },
        { role: "user", content: buildPrompt(source, from, to) },
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
    // Fall back to the source text if the model dropped a field, so the
    // required Sanity fields are never empty.
    acc[key] = {
      content: coerceText(raw?.content).trim() || source.sections[key].content,
      tips: coerceText(raw?.tips).trim() || source.sections[key].tips,
    };
    return acc;
  }, {} as Record<SectionKey, ScriptSection>);

  return {
    title: coerceText(parsed.title).trim() || source.title,
    description: coerceText(parsed.description).trim() || source.description,
    completeScript: coerceText(parsed.completeScript).trim() || source.completeScript,
    sections,
  };
}
