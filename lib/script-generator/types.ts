// Shared types for the Sales Script Generator (admin tool).
// Mirrors the Sanity `presentationScript` schema field structure.

export const LINES_OF_BUSINESS = [
  { value: "iul", label: "IUL (Indexed Universal Life)" },
  { value: "aca", label: "ACA / Obamacare" },
  { value: "dentalVision", label: "Dental & Vision" },
  { value: "hospitalIndemnity", label: "Hospital Indemnity" },
  { value: "finalExpense", label: "Final Expense / Burial" },
  { value: "shortTermMedical", label: "Temporary health insurance" },
] as const;

export type LineOfBusiness = (typeof LINES_OF_BUSINESS)[number]["value"];

export function isLineOfBusiness(value: unknown): value is LineOfBusiness {
  return typeof value === "string" && LINES_OF_BUSINESS.some((l) => l.value === value);
}

export function lineOfBusinessLabel(value: LineOfBusiness): string {
  return LINES_OF_BUSINESS.find((l) => l.value === value)?.label ?? value;
}

/**
 * Tolerant JSON parse for model output: strips ```json code fences and, if the
 * direct parse fails, retries on the substring between the first `{` and last
 * `}`. Returns null if nothing parseable is found.
 */
export function parseJsonLoose<T>(raw: string): T | null {
  const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * In JSON mode, the model sometimes returns a field that should be a markdown
 * string as a nested object or array instead (e.g. grouping insights by theme).
 * Coerce any shape into a readable markdown string so callers never crash when
 * they expect text (e.g. calling `.trim()`).
 */
export function coerceText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceText(item).trim())
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => {
        const text = coerceText(val).trim();
        return text ? `**${key}**\n${text}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return String(value);
}

// The six required script sections — keys match the Sanity schema field names.
export const SECTION_KEYS = [
  "openingIntroduction",
  "discoveryQuestions",
  "productPresentation",
  "closingTechniques",
  "objectionHandling",
  "psychologySalesTips",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  openingIntroduction: "Opening & Introduction",
  discoveryQuestions: "Discovery Questions & Qualification",
  productPresentation: "Product Presentation",
  closingTechniques: "Closing — Three Options",
  objectionHandling: "Objection Handling",
  psychologySalesTips: "Psychology & Sales Tips",
};

// ── Per-video distillation (map step) ──────────────────────────────────────────
export type SourceType = "call" | "training" | "other";

export interface VideoDistillation {
  videoId: string;
  title: string;
  channelName: string;
  url: string;
  durationSeconds: number;
  sourceType: SourceType;
  insights: string; // distilled, sales-relevant content (markdown/plain text)
}

// ── Synthesized script (reduce step) ───────────────────────────────────────────
export interface ScriptSection {
  content: string; // markdown
  tips: string; // markdown (may be empty)
}

export interface GeneratedScript {
  title: string;
  description: string;
  completeScript: string; // markdown — all-in-one quick reference
  sections: Record<SectionKey, ScriptSection>;
}

export interface BilingualScript {
  en: GeneratedScript;
  es: GeneratedScript;
}

// ── Publish result ──────────────────────────────────────────────────────────────
export interface ScriptPublishResult {
  _id: string;
  studioUrl: string;
}
