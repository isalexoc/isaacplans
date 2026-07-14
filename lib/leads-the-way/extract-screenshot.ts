/**
 * OpenAI vision extractor for the Lead Backup flow: reads a screenshot of the Senior Life
 * "Detalles de Lead" screen and returns the same structured `ParsedLead` the email extractor
 * produces. Mirrors `lib/leads-the-way/extract-openai.ts` (raw fetch + JSON mode), but the user
 * message is multimodal (image_url). Does NOT touch the email path.
 */

import type { LeadsTheWayConfig } from "@/lib/leads-the-way/config";
import type { ParsedLead } from "@/lib/leads-the-way/parse";

const SYSTEM_PROMPT = `You read a screenshot of a Senior Life Insurance "Detalles de Lead" (lead details) screen and extract the lead's structured data.
The screen typically lists, top to bottom: a lead number (shown as "# 5878583"), a date/time stamp, the client's full name, email, a mailing address line (street, city, state, ZIP — sometimes without commas), one or two phone numbers (often identical), a date of birth, and a lead source line (e.g. "Facebook - Spanish Call"), plus a comments line.

Return ONLY valid JSON with these keys (omit a key or use null if not present — never invent data):
{
  "firstName": string|null,
  "lastName": string|null,
  "phone": string|null,          // the client's phone digits as shown
  "email": string|null,
  "address1": string|null,       // street address only (e.g. "901 Hillcrest Dr. Apt115")
  "city": string|null,
  "state": string|null,          // 2-letter US state code (convert "Florida" -> "FL")
  "postalCode": string|null,
  "dateOfBirth": string|null,    // as shown (e.g. MM/DD/YYYY)
  "leadType": string|null,       // the lead source line, e.g. "Facebook - Spanish Call"
  "leadId": string|null,         // the "#" lead number
  "purchaseDate": string|null,   // the date/time stamp shown near the top, if any
  "purchasePrice": string|null
}
Extract only the client's contact info. If a phone appears twice, use it once.`;

const KEYS: (keyof ParsedLead)[] = [
  "firstName", "lastName", "phone", "email", "address1", "city", "state",
  "postalCode", "dateOfBirth", "leadType", "leadId", "purchaseDate", "purchasePrice",
];

/**
 * Extract lead fields from a screenshot data URL. Returns the parsed fields, or null if OpenAI is
 * unavailable / the call fails. `dataUrl` must be a `data:image/...;base64,...` string.
 */
export async function extractLeadFromScreenshot(
  dataUrl: string,
  config: LeadsTheWayConfig
): Promise<ParsedLead | null> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) return null;
  // Prefer a strong vision model for OCR accuracy (both gpt-4o and -mini support vision).
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the lead fields from this Senior Life lead-details screenshot." },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.warn("[LEADS_THE_WAY] Screenshot extract failed:", res.status, raw.slice(0, 300));
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
    console.warn("[LEADS_THE_WAY] Screenshot extract error:", err);
    return null;
  }
}
