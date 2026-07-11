/**
 * Deterministic parser for "Leads the Way" (Senior Life) order-confirmation emails.
 *
 * The email is a fixed, labeled template, so a line/label parser is fast, free, and reliable for
 * the common case. `lib/leads-the-way/extract-openai.ts` is the fallback for format drift.
 *
 * Sample body (fields are variably present; phone is the only near-guaranteed one):
 *   LEAD INFORMATION
 *   Gabriel Mena
 *   8202120876
 *   gabimena967@gmail.com
 *   2055 Patricia St
 *   Oxnard, California 93036
 *   PURCHASE INFORMATION
 *   Lead Type: Facebook - Spanish Call
 *   Purchase Date: 5/6/2026 11:11:53 AM
 *   Purchase Price: $40
 *   Lead Id: 5797173
 */

import { createHash } from "crypto";

export type ParsedLead = {
  firstName?: string;
  lastName?: string;
  phone?: string; // as found in the email (not yet E.164)
  email?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dateOfBirth?: string;
  leadType?: string;
  leadId?: string;
  purchaseDate?: string;
  purchasePrice?: string;
};

const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;
const CITY_STATE_ZIP_RE = /^(.+?),\s*([A-Za-z.\s]+?)\s+(\d{5})(?:-\d{4})?$/;

/** Rough US full-state-name → USPS abbreviation (GHL's `state` prefers 2-letter). */
const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function normalizeState(raw: string): string {
  const t = raw.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATE_ABBR[t.toLowerCase()] ?? t;
}

/** Digit count that looks like a US phone (10, or 11 starting with 1). */
function isPhoneLine(line: string): boolean {
  const d = line.replace(/\D/g, "");
  return d.length === 10 || (d.length === 11 && d.startsWith("1"));
}

/** Very small HTML → text fallback for when only an HTML part is delivered. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/tr|\/li|\/h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function firstMatch(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim() || undefined;
}

function splitName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Parse a Leads the Way email body (plain text preferred; HTML tolerated). */
export function parseLeadEmail(rawBody: string): ParsedLead {
  const text = /<[a-z][\s\S]*>/i.test(rawBody) && !/LEAD INFORMATION/i.test(rawBody)
    ? htmlToText(rawBody)
    : rawBody;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Labeled fields can appear anywhere; scan the whole email.
  const parsed: ParsedLead = {
    leadType: firstMatch(text, /Lead Type\s*:\s*(.+)/i),
    purchaseDate: firstMatch(text, /Purchase Date\s*:\s*(.+)/i),
    purchasePrice: firstMatch(text, /Purchase Price\s*:\s*\$?\s*([\d.,]+)/i),
    leadId: firstMatch(text, /Lead\s*Id\s*:\s*(\S+)/i),
    dateOfBirth: firstMatch(
      text,
      /(?:Date of Birth|DOB|Birth\s*Date)\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
    ),
  };

  // Restrict the unlabeled "LEAD INFORMATION" block so we never grab the Senior Life footer phone.
  // Markers are standalone header lines — anchor the match so the intro sentence
  // ("...the Lead and Purchase information related to your order.") isn't mistaken for the end.
  const startIdx = lines.findIndex((l) => /^lead information$/i.test(l));
  let endIdx = -1;
  if (startIdx >= 0) {
    const rel = lines.slice(startIdx + 1).findIndex((l) => /^purchase information$/i.test(l));
    endIdx = rel >= 0 ? startIdx + 1 + rel : -1;
  }
  const leadLines =
    startIdx >= 0
      ? lines.slice(startIdx + 1, endIdx >= 0 ? endIdx : undefined)
      : lines; // fallback: whole email

  for (const line of leadLines) {
    if (/^(lead|purchase) information$/i.test(line)) continue;
    // Skip lines that are actually labeled purchase fields if markers were missing.
    if (/^(Lead Type|Purchase Date|Purchase Price|Lead\s*Id|Transaction)\s*:/i.test(line)) continue;

    if (!parsed.email && line.includes("@")) {
      parsed.email = line.toLowerCase();
      continue;
    }
    if (!parsed.phone && isPhoneLine(line)) {
      parsed.phone = line;
      continue;
    }
    const csz = line.match(CITY_STATE_ZIP_RE);
    if (!parsed.city && csz) {
      parsed.city = csz[1].trim();
      parsed.state = normalizeState(csz[2]);
      parsed.postalCode = csz[3];
      continue;
    }
    // A bare date line in the lead block is a DOB (purchase date is labeled).
    if (!parsed.dateOfBirth && DATE_RE.test(line) && !/[a-z]/i.test(line.replace(DATE_RE, ""))) {
      parsed.dateOfBirth = line.match(DATE_RE)![1];
      continue;
    }
    if (!parsed.address1 && /^\d/.test(line)) {
      parsed.address1 = line;
      continue;
    }
    if (!parsed.firstName && /[a-z]/i.test(line) && !line.includes(":")) {
      Object.assign(parsed, splitName(line));
      continue;
    }
  }

  return parsed;
}

/** Normalize a US phone to E.164 (+1XXXXXXXXXX). Returns null if fewer than 10 digits. */
export function toE164(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+1${digits.slice(-10)}`;
}

/**
 * Stable idempotency key for a lead. Prefers the app's Lead Id; otherwise a content hash of the
 * inbound email so the same message never processes twice (mirrors resolveCallProcessingId).
 */
export function deriveLeadKey(
  parsed: ParsedLead,
  ctx: { from?: string; subject?: string; rawText: string }
): string {
  if (parsed.leadId) return `ltw_${parsed.leadId}`;
  const hash = createHash("sha256")
    .update(`${ctx.from ?? ""}|${ctx.subject ?? ""}|${ctx.rawText}`)
    .digest("hex")
    .slice(0, 32);
  return `ltw_${hash}`;
}
