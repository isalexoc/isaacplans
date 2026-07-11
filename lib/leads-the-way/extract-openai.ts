/**
 * OpenAI JSON-mode fallback extractor for Leads the Way emails. Used only when the deterministic
 * parser in `parse.ts` can't find a phone (format drift / unusual variants). Mirrors the fetch +
 * `response_format: { type: "json_object" }` pattern in `lib/openai-call-summary.ts`.
 */

import type { LeadsTheWayConfig } from "@/lib/leads-the-way/config";
import type { ParsedLead } from "@/lib/leads-the-way/parse";

const SYSTEM_PROMPT = `You extract structured lead data from a "Leads the Way" (Senior Life Insurance) order-confirmation email.
Return ONLY valid JSON with these keys (omit a key or use null if the value is not present in the email — never invent data):
{
  "firstName": string|null,
  "lastName": string|null,
  "phone": string|null,          // the customer's phone digits as written
  "email": string|null,
  "address1": string|null,       // street address only
  "city": string|null,
  "state": string|null,          // 2-letter US state code if you can infer it, else as written
  "postalCode": string|null,
  "dateOfBirth": string|null,    // as written (e.g. MM/DD/YYYY)
  "leadType": string|null,       // the "Lead Type" value
  "leadId": string|null,         // the "Lead Id" value
  "purchaseDate": string|null,
  "purchasePrice": string|null
}
Extract the CUSTOMER's contact info, not the Senior Life company address or its support phone number.`;

const KEYS: (keyof ParsedLead)[] = [
  "firstName", "lastName", "phone", "email", "address1", "city", "state",
  "postalCode", "dateOfBirth", "leadType", "leadId", "purchaseDate", "purchasePrice",
];

/** Returns extracted fields, or null if OpenAI is unavailable/failed. */
export async function extractLeadWithOpenAI(
  rawText: string,
  config: LeadsTheWayConfig
): Promise<ParsedLead | null> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) return null;

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
          { role: "user", content: rawText.slice(0, 8000) },
        ],
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.warn("[LEADS_THE_WAY] OpenAI extract failed:", res.status, raw.slice(0, 300));
      return null;
    }

    const envelope = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
    const content = envelope.choices?.[0]?.message?.content;
    if (!content) return null;

    const data = JSON.parse(content) as Record<string, unknown>;
    const out: ParsedLead = {};
    for (const key of KEYS) {
      const v = data[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim();
    }
    return out;
  } catch (err) {
    console.warn("[LEADS_THE_WAY] OpenAI extract error:", err);
    return null;
  }
}
