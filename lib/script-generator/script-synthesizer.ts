import OpenAI from "openai";
import {
  SECTION_KEYS,
  SECTION_LABELS,
  coerceText,
  languageName,
  lineOfBusinessLabel,
  parseJsonLoose,
  type GeneratedScript,
  type LineOfBusiness,
  type ScriptLanguage,
  type ScriptSection,
  type SectionKey,
  type VideoDistillation,
} from "./types";

// Synthesis ("reduce") step. Combines every per-video distillation into one
// structured sales script. Uses the strong model for quality.
const SYNTH_MODEL = process.env.SCRIPT_GENERATOR_MODEL ?? "gpt-4o";
// Allow a long, comprehensive script. The default completion cap is what made
// earlier scripts come out short. gpt-4o supports up to 16384 output tokens.
const MAX_TOKENS = Number(process.env.SCRIPT_GENERATOR_MAX_TOKENS) || 16000;

function buildSystemPrompt(lob: LineOfBusiness, language: ScriptLanguage): string {
  const label = lineOfBusinessLabel(lob);
  const lang = languageName(language);
  return `You are an elite insurance sales coach and scriptwriter for Isaac Plans Insurance. You write phone/in-person sales scripts that agents read and follow, often word-for-word, with real clients.

You are building ONE definitive, COMPREHENSIVE ${label} sales script by synthesizing insights distilled from many source videos (real sales calls and sales-training sessions). Mine EVERY source for usable material and merge the best openings, rapport-building, discovery/qualifying questions, product framing, analogies, numbers, closing language, and objection responses into a single coherent, ready-to-use master script. An agent should be able to run an entire call from this script alone.

LANGUAGE: Write the ENTIRE script in natural, professional ${lang}. The source videos are primarily in ${lang}, so write the script directly in ${lang} to preserve the real phrasing and idioms (the other language is produced separately by translation). Do not mix languages — every field must be in ${lang}.

Depth & quality:
- This is a long-form MASTER script, not a summary. Be thorough, specific, and detailed in every section.
- Write the actual word-for-word lines the agent says, in the second person, in natural spoken language to read aloud. Include transitions and rapport language.
- For questions and objections, give the EXACT wording. Preserve strong verbatim phrasing found across the sources.
- Synthesize and improve — combine the strongest ideas from MULTIPLE sources; never just copy one. Resolve contradictions sensibly.
- Stay specific to ${label}. Do not drift into unrelated products.
- Ground everything in the provided insights. Do not invent fake statistics, prices, or carrier names; generic illustrative numbers are fine only if clearly framed as examples.

Per-section depth (aim for genuinely useful length, roughly as noted):
- openingIntroduction (~150–300 words): greeting, who you are, the purpose, asking permission to ask questions, and setting the agenda/frame.
- discoveryQuestions (~250–450 words): 8–14 specific qualifying questions, EACH followed by a short note on why you ask it and what to listen for.
- productPresentation (~300–550 words): how ${label} works, key benefits, analogies, illustrative numbers, and how it maps to the prospect's stated goals.
- objectionHandling (~300–550 words): the 6–10 most common ${label} objections, each formatted as **Objection:** "…" then **Response:** "…" with the exact words to say.
- closingTechniques (~250–450 words): THREE distinct, fully-scripted closing approaches the agent can choose between.
- psychologySalesTips (~150–300 words): concrete persuasion, tone, and pacing tactics demonstrated in the sources.

For each section, "content" is the script the agent reads; "tips" is a short coaching bullet list (3–6 bullets) for that stage.

completeScript (~400–800 words): a flowing, condensed run-through of the whole call from hello to close, in full sentences (not just headings), for quick live reference.

Markdown format (converted to Sanity Portable Text):
- ## for H2, ### for H3, **bold**, - for bullet lists
- NO numbered lists, tables, blockquotes, or inline code
- Blank line between blocks`;
}

function buildUserPrompt(
  distillations: VideoDistillation[],
  lob: LineOfBusiness,
  language: ScriptLanguage
): string {
  const lang = languageName(language);
  const sources = distillations
    .map(
      (d, i) =>
        `### Source ${i + 1} — ${d.sourceType.toUpperCase()} — "${d.title}" (${d.channelName})\n${d.insights}`
    )
    .join("\n\n");

  const sectionLines = SECTION_KEYS.map(
    (k) => `  "${k}": { "content": "...", "tips": "..." },   // ${SECTION_LABELS[k]}`
  ).join("\n");

  return `Line of business: ${lineOfBusinessLabel(lob)}

Here are the distilled insights from ${distillations.length} source video(s):

${sources}

---
Synthesize ALL of the above into one complete ${lineOfBusinessLabel(lob)} sales script.

Return a JSON object with this exact shape:
{
  "title": "...",
  "description": "...",
${sectionLines}
  "completeScript": "..."
}

Field rules:
- Write EVERYTHING in ${lang} (title, description, all sections, tips, and completeScript).
- title: a clear internal title, e.g. "${lineOfBusinessLabel(lob)} — Complete Sales Script".
- description: 1–2 sentence summary of what this script covers and who it's for.
- Each of the six section objects is REQUIRED and must be detailed per the per-section depth guidance — do NOT return thin one-paragraph sections. "content" is the actual script markdown; "tips" is a 3–6 bullet coaching list.
- closingTechniques.content MUST lay out three distinct, fully-scripted closing options.
- completeScript: a flowing, condensed run-through of the whole call (~400–800 words) in full sentences.

Make this the best, most complete ${lineOfBusinessLabel(lob)} sales script possible from the material. Return only the JSON object. No markdown wrapper, no explanation.`;
}

interface RawSection {
  content?: string;
  tips?: string;
}

interface RawScript {
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

function normalizeSection(raw: RawSection | undefined, label: string): ScriptSection {
  const content = coerceText(raw?.content).trim();
  if (!content) {
    throw new Error(`Generated script is missing required content for section: "${label}"`);
  }
  return { content, tips: coerceText(raw?.tips).trim() };
}

export async function synthesizeScript(
  distillations: VideoDistillation[],
  lineOfBusiness: LineOfBusiness,
  language: ScriptLanguage
): Promise<GeneratedScript> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!distillations.length) {
    throw new Error("No video insights were provided to synthesize a script.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let rawContent: string;
  try {
    const response = await client.chat.completions.create({
      model: SYNTH_MODEL,
      response_format: { type: "json_object" },
      max_completion_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: buildSystemPrompt(lineOfBusiness, language) },
        { role: "user", content: buildUserPrompt(distillations, lineOfBusiness, language) },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI API error during synthesis: ${msg}`);
  }

  const parsed = parseJsonLoose<RawScript>(rawContent);
  if (!parsed) {
    throw new Error(`Failed to parse synthesis response as JSON. Raw: ${rawContent.slice(0, 500)}`);
  }

  const sections = SECTION_KEYS.reduce((acc, key) => {
    acc[key] = normalizeSection(parsed[key], SECTION_LABELS[key]);
    return acc;
  }, {} as Record<SectionKey, ScriptSection>);

  const title = coerceText(parsed.title).trim();

  return {
    title: title || `${lineOfBusinessLabel(lineOfBusiness)} — Complete Sales Script`,
    description: coerceText(parsed.description).trim(),
    completeScript: coerceText(parsed.completeScript).trim(),
    sections,
  };
}
