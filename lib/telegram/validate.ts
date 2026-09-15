/**
 * Validation + value normalization for a parsed Telegram lead.
 *
 * Runs on EVERY parse result regardless of which parser produced it (deterministic or OpenAI), so
 * the model can never talk a bad phone number into the CRM.
 */

import { normalizeStateCode } from "@/lib/mailing-labels/format";
import { toE164Nanp, type ParsedTelegramLead, type ParseDiagnostics } from "@/lib/telegram/parse";

export type ValidationResult = {
  /** True when the lead can be written to the CRM unattended. */
  ok: boolean;
  /** True when it should still be surfaced for a human to look at. */
  needsReview: boolean;
  reviewReason: string | null;
  errors: string[];
  warnings: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Fold the provider's Spanish call-time words into the vocabulary the IUL funnel already writes to
 * `iul_s2_call_time`, so one field holds one language.
 */
export function normalizeCallTime(raw?: string | null): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  const k = v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (/\bmanana\b|\bmorning\b|\bam\b(?!.*pm)/.test(k) && !/mediodia/.test(k)) {
    return "Morning (8am - 12pm)";
  }
  if (/mediodia|midday|noon/.test(k)) return "Midday (12pm - 2pm)";
  if (/\btarde\b|afternoon/.test(k)) return "Afternoon (2pm - 6pm)";
  if (/\bnoche\b|evening|night/.test(k)) return "Evening (6pm - 9pm)";

  // A bare clock time ("3:30 PM") passes through as written.
  return v;
}

/**
 * "Entre $100 y $200" → "$100 - $200"; "Menos de $300" → "Less than $300".
 * Normalizes the FORMAT to match the funnel's existing values, never the bucket — coercing
 * $100-$200 into the funnel's "Less than $300" band would destroy the actual number.
 */
export function normalizeSavingsBand(raw?: string | null): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  const k = v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const between = k.match(/entre\s*\$?\s*([\d,.]+)\s*(?:y|a|-)\s*\$?\s*([\d,.]+)/);
  if (between) return `$${between[1]} - $${between[2]}`;

  const less = k.match(/(?:menos de|hasta|under|less than)\s*\$?\s*([\d,.]+)/);
  if (less) return `Less than $${less[1]}`;

  const more = k.match(/(?:mas de|more than|over)\s*\$?\s*([\d,.]+)/);
  if (more) return `More than $${more[1]}`;

  return v;
}

/**
 * "9/15 8:11 AM CDT" — the provider sends no year. Assume the current one, and roll back a year if
 * that lands more than a week in the future (a lead received on Dec 31 processed on Jan 1).
 * The verbatim string is always kept regardless; this is only for sorting/display.
 */
export function parseEnteredAt(raw?: string | null, now: Date = new Date()): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const m = v.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;

  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = m[3] ? Number(m[3]) : now.getUTCFullYear();
  if (year < 100) year += 2000;
  let hour = Number(m[4]);
  const minute = Number(m[5]);
  const ampm = m[6]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let d = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (d.getTime() - now.getTime() > 7 * 24 * 60 * 60 * 1000) {
    d = new Date(Date.UTC(year - 1, month - 1, day, hour, minute));
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Validate and normalize in place. `phoneE164` is the ONLY hard requirement: a phone-only lead is
 * still a callable, purchased lead, and the low-level CRM create has no last-name requirement.
 * Everything else downgrades to a review flag rather than blocking the sync.
 */
export function validateParsedLead(
  parsed: ParsedTelegramLead,
  diagnostics?: ParseDiagnostics
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [...(diagnostics?.warnings ?? [])];

  // Phone — re-validated here even if the parser already did it.
  const phone = toE164Nanp(parsed.phoneE164 ?? parsed.phoneRaw);
  if (phone) {
    parsed.phoneE164 = phone;
  } else {
    delete parsed.phoneE164;
    errors.push("no_valid_phone");
  }

  // Email — drop rather than write something malformed.
  if (parsed.email) {
    const e = parsed.email.trim().toLowerCase();
    if (EMAIL_RE.test(e)) parsed.email = e;
    else {
      delete parsed.email;
      warnings.push("email_failed_validation");
    }
  } else {
    warnings.push("no_email");
  }

  // State — "Arkansas" → "AR". Unrecognised states are kept raw for the note but not written.
  if (parsed.stateRaw) {
    const code = normalizeStateCode(parsed.stateRaw);
    if (code) parsed.stateCode = code;
    else warnings.push(`state_unrecognised:${parsed.stateRaw}`);
  } else {
    warnings.push("no_state");
  }

  if (!parsed.firstName && !parsed.lastName) warnings.push("no_name");

  if (parsed.bestCallTime) parsed.bestCallTime = normalizeCallTime(parsed.bestCallTime);
  if (parsed.monthlySavings) parsed.monthlySavings = normalizeSavingsBand(parsed.monthlySavings);

  if (diagnostics?.unmatchedLines?.length) {
    warnings.push(`unmatched_lines:${diagnostics.unmatchedLines.length}`);
  }

  const ok = errors.length === 0;
  const needsReview = !ok || warnings.some((w) => w !== "no_email");

  const reviewReason = !ok
    ? "no_phone"
    : warnings.find((w) => w.startsWith("unmatched_lines"))
      ? "unmatched_lines"
      : warnings.includes("multiple_leads_in_message")
        ? "multiple_leads"
        : warnings.includes("no_name")
          ? "no_name"
          : warnings.find((w) => w.startsWith("state_unrecognised"))
            ? "state_unrecognised"
            : null;

  return { ok, needsReview, reviewReason, errors, warnings };
}
