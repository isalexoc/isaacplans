import OpenAI from "openai";
import {
  SECTION_KEYS,
  SECTION_LABELS,
  coerceText,
  lineOfBusinessLabel,
  parseJsonLoose,
  type GeneratedScript,
  type LineOfBusiness,
  type ScriptSection,
  type SectionKey,
  type VideoDistillation,
} from "./types";

// Synthesis ("reduce") step. Combines every per-video distillation into one
// structured sales script. Uses the strong model for quality.
const SYNTH_MODEL = process.env.SCRIPT_GENERATOR_MODEL ?? "gpt-4o";

function buildSystemPrompt(lob: LineOfBusiness): string {
  return `You are an elite insurance sales coach and scriptwriter for Isaac Plans Insurance. You write phone/in-person sales scripts that agents read and follow with real clients.

You are building ONE definitive ${lineOfBusinessLabel(lob)} sales script by synthesizing insights distilled from many source videos (real sales calls and sales-training sessions). Combine the best techniques, language, discovery questions, closing approaches, and objection responses found across all the sources into a single coherent, ready-to-use script.

Rules:
- Write in the second person, as direct guidance/lines for the agent to say. Use natural, spoken language an agent can read aloud.
- Synthesize and improve — do not just copy one source. Merge the strongest ideas; resolve contradictions sensibly.
- Stay specific to ${lineOfBusinessLabel(lob)}. Do not drift into unrelated products.
- Ground everything in the provided insights. Do not invent fake statistics, prices, or carrier names. Generic illustrative numbers are fine only if clearly framed as examples.
- The "closingTechniques" section MUST present three distinct closing options/approaches.
- Each section's "content" is the script itself; "tips" are short coaching notes / strategy bullets for that section.

Markdown format (will be converted to Sanity Portable Text):
- ## for H2, ### for H3, **bold**, - for bullet lists
- NO numbered lists, tables, blockquotes, or inline code
- Blank line between blocks`;
}

function buildUserPrompt(distillations: VideoDistillation[], lob: LineOfBusiness): string {
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
- title: a clear internal title, e.g. "${lineOfBusinessLabel(lob)} — Complete Sales Script".
- description: 1–2 sentence summary of what this script covers and who it's for.
- Each of the six section objects is REQUIRED. "content" must be substantial markdown (the actual script for that stage). "tips" is a short markdown bullet list of coaching notes (may be brief but should not be empty).
- closingTechniques.content MUST lay out three distinct closing options.
- completeScript: a compressed all-in-one version of the entire script (markdown) for quick reference during a live call.

Return only the JSON object. No markdown wrapper, no explanation.`;
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
  lineOfBusiness: LineOfBusiness
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
      messages: [
        { role: "system", content: buildSystemPrompt(lineOfBusiness) },
        { role: "user", content: buildUserPrompt(distillations, lineOfBusiness) },
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
