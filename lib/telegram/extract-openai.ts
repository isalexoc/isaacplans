/**
 * OpenAI JSON-mode fallback for Telegram lead messages, used only when the deterministic parser
 * can't find a phone or a name (format drift).
 *
 * Mirrors `lib/leads-the-way/extract-openai.ts`, plus one addition that pipeline lacks: a
 * GROUNDING CHECK. Every value the model returns must actually appear in the source message, or it
 * is dropped. Schema-conformant output is not the same as correct output, and the cost of a
 * confidently invented phone number here is a real person being cold-called.
 */

import type { TelegramLeadsConfig } from "@/lib/telegram/config";
import { normalizeMessageText, toE164Nanp, type ParsedTelegramLead } from "@/lib/telegram/parse";

const SYSTEM_PROMPT = `You extract structured lead data from a Spanish-language insurance lead message sent over Telegram by a lead provider.

Return ONLY valid JSON with these keys (use null when the value is not present — NEVER invent or infer data):
{
  "fullName": string|null,        // the prospect's name
  "phone": string|null,           // the prospect's phone, digits as written
  "email": string|null,
  "state": string|null,           // US state as written, e.g. "Arkansas"
  "goal": string|null,            // what they want, e.g. "Ahorrar y crecer mi dinero"
  "monthlySavings": string|null,  // amount per month, e.g. "Entre $100 y $200"
  "bestCallTime": string|null,    // e.g. "Tarde"
  "adName": string|null,          // the ad/campaign name
  "enteredAt": string|null        // when the lead came in, as written
}

Extract the PROSPECT's details only — never the lead provider's own contact details.
Copy values EXACTLY as they appear in the message. Do not translate, reformat or complete them.`;

type RawExtraction = Partial<Record<string, unknown>>;

/** Accent- and case-insensitive containment, used to prove a value came from the message. */
function normalizeForGrounding(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isGrounded(value: string, haystack: string): boolean {
  const needle = normalizeForGrounding(value);
  if (needle.length < 2) return false;
  return normalizeForGrounding(haystack).includes(needle);
}

/** A phone is grounded when its 10 digits appear, in order, among the message's digits. */
function phoneIsGrounded(phoneE164: string, haystack: string): boolean {
  const digits = phoneE164.replace(/\D/g, "").slice(-10);
  return haystack.replace(/\D/g, "").includes(digits);
}

export type OpenAiExtractionResult = {
  parsed: ParsedTelegramLead;
  /** Fields the model returned that were NOT present in the source and were therefore discarded. */
  dropped: string[];
  raw: string;
} | null;

export async function extractTelegramLeadWithOpenAI(
  rawText: string,
  config: TelegramLeadsConfig
): Promise<OpenAiExtractionResult> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) return null;

  const source = normalizeMessageText(rawText);

  let raw = "";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: source.slice(0, 4000) },
        ],
      }),
    });

    if (!res.ok) {
      console.warn("[TELEGRAM_LEADS] OpenAI extraction failed:", res.status);
      return null;
    }

    const data = await res.json();
    raw = data?.choices?.[0]?.message?.content ?? "";
    if (!raw.trim()) return null;
  } catch (err) {
    console.warn("[TELEGRAM_LEADS] OpenAI extraction threw", { error: err });
    return null;
  }

  let obj: RawExtraction;
  try {
    obj = JSON.parse(raw) as RawExtraction;
  } catch {
    console.warn("[TELEGRAM_LEADS] OpenAI returned non-JSON");
    return null;
  }

  const str = (key: string): string | undefined => {
    const v = obj[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };

  const dropped: string[] = [];
  const keep = (key: string, value: string | undefined): string | undefined => {
    if (!value) return undefined;
    if (!isGrounded(value, source)) {
      dropped.push(key);
      return undefined;
    }
    return value;
  };

  // Phone gets the strict NANP validator AND a digit-level grounding check.
  let phoneE164: string | undefined;
  const phoneRaw = str("phone");
  if (phoneRaw) {
    const e164 = toE164Nanp(phoneRaw);
    if (e164 && phoneIsGrounded(e164, source)) phoneE164 = e164;
    else dropped.push("phone");
  }

  const fullName = keep("fullName", str("fullName"));
  const nameParts = fullName?.split(/\s+/).filter(Boolean) ?? [];

  const parsed: ParsedTelegramLead = {
    fullName,
    firstName: nameParts[0],
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
    phoneRaw: phoneE164 ? phoneRaw : undefined,
    phoneE164,
    email: keep("email", str("email"))?.toLowerCase(),
    stateRaw: keep("state", str("state")),
    goal: keep("goal", str("goal")),
    monthlySavings: keep("monthlySavings", str("monthlySavings")),
    bestCallTime: keep("bestCallTime", str("bestCallTime")),
    adName: keep("adName", str("adName")),
    enteredAtRaw: keep("enteredAt", str("enteredAt")),
    parseSource: "openai",
  };

  if (dropped.length > 0) {
    console.warn("[TELEGRAM_LEADS] Dropped ungrounded OpenAI fields", { dropped });
  }

  return { parsed, dropped, raw };
}

/** Deterministic values always win; the model only fills gaps. */
export function mergeParsedLeads(
  deterministic: ParsedTelegramLead,
  ai: ParsedTelegramLead
): ParsedTelegramLead {
  const merged: ParsedTelegramLead = { ...ai, ...{} };
  for (const [key, value] of Object.entries(deterministic) as [
    keyof ParsedTelegramLead,
    unknown,
  ][]) {
    if (value !== undefined && value !== null && value !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  merged.parseSource = "merged";
  return merged;
}
