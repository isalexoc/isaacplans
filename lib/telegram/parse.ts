/**
 * Parser for the "Empiregrowth Leads" IUL lead messages that arrive over Telegram.
 *
 * The one sample we have:
 *
 *   🔔 Nuevo lead IUL
 *   👤 Miguel Colon
 *   📞 +18647757287
 *   ✉️ miguelcolon7061212@gmail.com
 *   📍 Estado: Arkansas
 *   🎯 Ahorrar y crecer mi dinero
 *   💰 Ahorro/mes: Entre $100 y $200
 *   🕐 Mejor hora para llamar: Tarde
 *   📢 Anuncio: DCO Arkansas | WILSON-HOOKS
 *   📅 Entró: 9/15 8:11 AM CDT
 *   🌙 Llamar: 8:12 AM CDT local, fuera de horario
 *
 * ONE sample means the format will drift and we will not be told. So resolution is three-tier and
 * position-independent:
 *
 *   1. LABEL   — "Estado:", "Ahorro/mes:" … matched accent- and case-insensitively, by substring,
 *                against a synonym table. Survives emoji changes.
 *   2. SHAPE   — a line that looks like a phone / an email / a person's name claims that field even
 *                with no label and no emoji. Survives both changing at once.
 *   3. EMOJI   — 👤 📞 ✉️ … used only when the label is unrecognised and no shape rule claimed the
 *                line. Survives label renaming.
 *
 * Anything a tier cannot claim lands in `diagnostics.unmatchedLines`, which flags the lead for
 * review rather than being silently dropped.
 */

import { createHash } from "crypto";

export type ParsedTelegramLead = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  /** As written in the message. */
  phoneRaw?: string;
  /** Validated NANP E.164 — the ONLY phone the CRM ever sees. */
  phoneE164?: string;
  email?: string;
  /** As written, e.g. "Arkansas". */
  stateRaw?: string;
  /** 2-letter USPS code, e.g. "AR". */
  stateCode?: string;
  goal?: string;
  monthlySavings?: string;
  bestCallTime?: string;
  adName?: string;
  enteredAtRaw?: string;
  localCallNote?: string;
  leadTypeLabel?: string;
  language?: "es" | "en";
  parseSource?: "deterministic" | "openai" | "merged" | "manual";
};

export type ParseDiagnostics = {
  matchedFields: string[];
  unmatchedLines: string[];
  warnings: string[];
};

type Field = keyof Pick<
  ParsedTelegramLead,
  | "fullName"
  | "phoneRaw"
  | "email"
  | "stateRaw"
  | "goal"
  | "monthlySavings"
  | "bestCallTime"
  | "adName"
  | "enteredAtRaw"
  | "localCallNote"
>;

/**
 * Label synonyms, checked LONGEST FIRST so "mejor hora para llamar" wins over the bare "llamar"
 * that would otherwise swallow it.
 */
const LABELS: Array<{ label: string; field: Field }> = [
  { label: "mejor hora para llamar", field: "bestCallTime" },
  { label: "hora para llamar", field: "bestCallTime" },
  { label: "mejor hora", field: "bestCallTime" },
  { label: "best time to call", field: "bestCallTime" },
  { label: "best time", field: "bestCallTime" },
  { label: "presupuesto mensual", field: "monthlySavings" },
  { label: "ahorro/mes", field: "monthlySavings" },
  { label: "ahorro al mes", field: "monthlySavings" },
  { label: "ahorro mes", field: "monthlySavings" },
  { label: "monthly savings", field: "monthlySavings" },
  { label: "presupuesto", field: "monthlySavings" },
  { label: "ahorro", field: "monthlySavings" },
  { label: "budget", field: "monthlySavings" },
  { label: "estado", field: "stateRaw" },
  { label: "provincia", field: "stateRaw" },
  { label: "ubicacion", field: "stateRaw" },
  { label: "state", field: "stateRaw" },
  { label: "anuncio", field: "adName" },
  { label: "campana", field: "adName" },
  { label: "campaign", field: "adName" },
  { label: "telefono", field: "phoneRaw" },
  { label: "celular", field: "phoneRaw" },
  { label: "phone", field: "phoneRaw" },
  { label: "correo electronico", field: "email" },
  { label: "correo", field: "email" },
  { label: "e-mail", field: "email" },
  { label: "email", field: "email" },
  { label: "nombre completo", field: "fullName" },
  { label: "nombre", field: "fullName" },
  { label: "cliente", field: "fullName" },
  { label: "name", field: "fullName" },
  { label: "objetivo", field: "goal" },
  { label: "interes", field: "goal" },
  { label: "meta", field: "goal" },
  { label: "goal", field: "goal" },
  { label: "recibido", field: "enteredAtRaw" },
  { label: "submitted", field: "enteredAtRaw" },
  { label: "received", field: "enteredAtRaw" },
  { label: "entro", field: "enteredAtRaw" },
  { label: "fecha", field: "enteredAtRaw" },
  { label: "hora local", field: "localCallNote" },
  { label: "llamar", field: "localCallNote" },
];

/** Tier 3. Clock faces (U+1F550–U+1F567) all mean "best time to call". */
const EMOJI_FIELDS: Array<{ test: RegExp; field: Field }> = [
  { test: /\u{1F464}/u, field: "fullName" }, // 👤
  { test: /\u{1F4DE}|\u{260E}|\u{1F4F1}/u, field: "phoneRaw" }, // 📞 ☎ 📱
  { test: /\u{2709}|\u{1F4E7}|\u{1F4E9}/u, field: "email" }, // ✉ 📧 📩
  { test: /\u{1F4CD}|\u{1F5FA}/u, field: "stateRaw" }, // 📍 🗺
  { test: /\u{1F3AF}|\u{1F4A1}/u, field: "goal" }, // 🎯 💡
  { test: /\u{1F4B0}|\u{1F4B5}|\u{1F4B2}/u, field: "monthlySavings" }, // 💰 💵 💲
  { test: /[\u{1F550}-\u{1F567}]|\u{23F0}|\u{231A}/u, field: "bestCallTime" }, // 🕐… ⏰ ⌚
  { test: /\u{1F4E2}|\u{1F4E3}|\u{1F4FA}/u, field: "adName" }, // 📢 📣 📺
  { test: /\u{1F4C5}|\u{1F4C6}/u, field: "enteredAtRaw" }, // 📅 📆
  { test: /\u{1F319}|\u{1F31A}|\u{1F303}/u, field: "localCallNote" }, // 🌙 🌚 🌃
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LEAD_HEADER_RE = /nuevo\s+lead|new\s+lead/i;

/** Lowercase + strip accents + collapse punctuation, for label comparison only. */
function normalizeLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Leading emoji / bullets / whitespace are decoration — strip them before reading a line. */
function stripLeadingDecoration(line: string): string {
  return line.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s*\u2022\u00B7\-\u2013\u2014]+/u, "").trim();
}

/**
 * Normalize the raw message: drop the client-rendered "Forwarded from" header (the Bot API does not
 * include it, but a copy-paste would), normalize unicode, kill zero-width and exotic spaces.
 */
export function normalizeMessageText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u00A0\u202F\u2009\u2007]/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^(forwarded from|reenviado de|reenviado desde)\b/i.test(l))
    .join("\n");
}

export function contentHashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

export function deriveTelegramLeadKey(chatId: string | number, messageId: string | number): string {
  return `tg_${chatId}_${messageId}`;
}

/**
 * Strict NANP validator. Deliberately NOT `lib/leads-the-way/parse.ts:toE164`, which accepts any
 * string with 10+ digits and takes the last 10 — a policy number or a concatenated date would sail
 * through that and become a phone number the automation then dials.
 */
export function toE164Nanp(input?: string | null): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;

  const npa = digits.slice(0, 3);
  const nxx = digits.slice(3, 6);
  const line = digits.slice(6);

  if (!/^[2-9]/.test(npa)) return null; // area code can't start 0/1
  if (!/^[2-9]/.test(nxx)) return null; // exchange can't start 0/1
  if (npa[1] === "1" && npa[2] === "1") return null; // N11 service codes (411, 911…)
  if (nxx[1] === "1" && nxx[2] === "1") return null;
  if (nxx === "555" && line.startsWith("01")) return null; // 555-0100..0199 are fictional
  if (/^(\d)\1{9}$/.test(digits)) return null; // 1111111111

  return `+1${digits}`;
}

/** First token is the given name, everything after is the surname(s). Correct for Spanish names. */
function splitName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function looksLikePhone(value: string): boolean {
  if (!/^[+\d][\d\s().+\-]{7,}$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

function looksLikeName(value: string): boolean {
  if (value.includes(":") || /\d/.test(value) || value.includes("@")) return false;
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return false;
  return parts.every((p) => /^[\p{L}][\p{L}'’.\-]*$/u.test(p));
}

/** Detect a message carrying more than one lead — we refuse to guess which one is "the" lead. */
export function countLeadHeaders(text: string): number {
  return text.split("\n").filter((l) => LEAD_HEADER_RE.test(l)).length;
}

export function parseEmpiregrowthLead(rawText: string): {
  parsed: ParsedTelegramLead;
  diagnostics: ParseDiagnostics;
} {
  const text = normalizeMessageText(rawText);
  const lines = text.split("\n");

  const out: Record<string, string> = {};
  const matchedFields: string[] = [];
  const unmatchedLines: string[] = [];
  const warnings: string[] = [];
  let leadTypeLabel: string | undefined;

  const claim = (field: Field, value: string) => {
    const v = value.trim();
    if (!v || out[field]) return false;
    out[field] = v;
    matchedFields.push(field);
    return true;
  };

  for (const original of lines) {
    // The "🔔 Nuevo lead IUL" banner is a type marker, not a field.
    if (LEAD_HEADER_RE.test(original)) {
      leadTypeLabel = stripLeadingDecoration(original);
      continue;
    }

    const body = stripLeadingDecoration(original);
    if (!body) continue;

    // ── Tier 1: label ───────────────────────────────────────────────────────
    const colon = body.indexOf(":");
    let claimed = false;
    if (colon > 0) {
      const labelNorm = normalizeLabel(body.slice(0, colon));
      const value = body.slice(colon + 1).trim();
      if (value) {
        const hit = LABELS.find((l) => labelNorm.includes(l.label));
        if (hit) claimed = claim(hit.field, value);
      }
    }
    if (claimed) continue;

    const afterColon = colon > 0 ? body.slice(colon + 1).trim() : body;

    // ── Tier 2: emoji hint ──────────────────────────────────────────────────
    // Checked BEFORE the shape rules: an explicit emoji is a far stronger signal than
    // "this line looks like a name". Without this ordering, a goal line such as
    // "🎯 Ahorrar y crecer mi dinero" satisfies looksLikeName() and steals the name field
    // whenever it happens to be read first.
    const emojiHit = EMOJI_FIELDS.find((e) => e.test.test(original));
    if (emojiHit && claim(emojiHit.field, afterColon)) continue;

    // ── Tier 3: shape ───────────────────────────────────────────────────────
    if (EMAIL_RE.test(afterColon)) {
      if (claim("email", afterColon)) continue;
    }
    if (looksLikePhone(afterColon)) {
      if (claim("phoneRaw", afterColon)) continue;
    }
    if (colon < 0 && looksLikeName(body)) {
      if (claim("fullName", body)) continue;
    }

    // A label-less, shape-less, emoji-less line with a couple of words is most likely the goal
    // ("🎯 Ahorrar y crecer mi dinero" carries no label at all in the sample).
    if (colon < 0 && !out.goal && body.split(/\s+/).length >= 2) {
      if (claim("goal", body)) continue;
    }

    unmatchedLines.push(body);
  }

  // Final safety net: sweep the whole message for a phone/email we somehow missed.
  if (!out.phoneRaw) {
    const m = text.match(/\+?1?[\s.\-(]*\d{3}[\s.\-)]*\d{3}[\s.\-]*\d{4}/);
    if (m && toE164Nanp(m[0])) {
      out.phoneRaw = m[0].trim();
      matchedFields.push("phoneRaw:sweep");
    }
  }
  if (!out.email) {
    const m = text.match(/[^\s@]+@[^\s@]+\.[^\s@,;]{2,}/);
    if (m) {
      out.email = m[0].trim();
      matchedFields.push("email:sweep");
    }
  }

  const parsed: ParsedTelegramLead = {
    fullName: out.fullName,
    ...splitName(out.fullName ?? ""),
    phoneRaw: out.phoneRaw,
    phoneE164: toE164Nanp(out.phoneRaw) ?? undefined,
    email: out.email?.toLowerCase(),
    stateRaw: out.stateRaw,
    goal: out.goal,
    monthlySavings: out.monthlySavings,
    bestCallTime: out.bestCallTime,
    adName: out.adName,
    enteredAtRaw: out.enteredAtRaw,
    localCallNote: out.localCallNote,
    leadTypeLabel,
    language: /[áéíóúñ¿¡]|ahorro|estado|llamar|mejor hora/i.test(text) ? "es" : "en",
    parseSource: "deterministic",
  };

  if (out.phoneRaw && !parsed.phoneE164) {
    warnings.push(`phone_failed_validation:${out.phoneRaw}`);
  }
  if (countLeadHeaders(text) > 1) {
    warnings.push("multiple_leads_in_message");
  }

  return { parsed, diagnostics: { matchedFields, unmatchedLines, warnings } };
}
