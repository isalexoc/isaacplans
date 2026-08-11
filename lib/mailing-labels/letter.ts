import "server-only";
import OpenAI from "openai";
import { agentCrmFetchContactNotes } from "@/lib/agent-crm-notes";
import { maskSensitiveNumbers } from "@/lib/call-summary-structured";
import type { LabelAgentContact, MailingLabelLanguage, MailingLabelRecord } from "./types";

/**
 * Drafts the personal letter that goes inside the envelope with the mailed folder.
 *
 * Voice: a short, warm note from Isaac to someone who asked about final expense coverage — written
 * in plain everyday words, not industry language. Seniors are the readers, so sentences stay short
 * and the ask is simple: call me.
 *
 * Personalization comes from the contact's Agent CRM notes, which is where the existing call-summary
 * pipeline (lib/agent-crm-call-summary.ts) files its summaries. Most new leads have none, and the
 * letter has to read naturally without them — hence the two prompt paths below.
 *
 * The draft is always editable afterward. This is a first draft, never the final word.
 */

/** How many recent notes to feed the model, and how much of each. Keeps the prompt small and recent. */
const MAX_NOTES = 6;
const MAX_NOTE_CHARS = 700;

/**
 * Words that make the letter read like an industry document instead of a person. Isaac writes to
 * seniors in plain language, so the draft is rejected and retried once if these show up.
 * (Spanish equivalents included — the letter follows the label's language.)
 */
const JARGON = [
  "insurance",
  "insured",
  "policy",
  "policies",
  "premium",
  "underwriting",
  "underwriter",
  "beneficiary",
  "beneficiaries",
  "face amount",
  "death benefit",
  "rider",
  "seguro",
  "póliza",
  "poliza",
  "prima",
  "beneficiario",
  "asegurado",
];

export type LetterAgentInfo = LabelAgentContact & { email?: string };

export type GeneratedLetter = {
  body: string;
  /** Short human-readable note of what informed the draft, shown in the UI. */
  context: string;
};

function firstNameOf(record: Pick<MailingLabelRecord, "firstName" | "lastName">): string {
  const first = record.firstName.trim();
  if (first) return first;
  const last = record.lastName.trim();
  return last || "Friend";
}

/** Title-case a name that may have been typed or stored in caps. */
function properCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'-])([a-záéíóúñü])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function containsJargon(text: string): string[] {
  const lower = text.toLowerCase();
  return JARGON.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(lower));
}

/** Sign-offs the model adds even when told not to. Matched on a line of its own. */
const CLOSING_LINE =
  /^(warm(est)?\s+regards|warmly|sincerely(\s+yours)?|best(\s+regards|\s+wishes)?|kind(est)?\s+regards|yours\s+truly|with\s+care|take\s+care|con\s+aprecio|atentamente|cordialmente|saludos(\s+cordiales)?|un\s+cordial\s+saludo|con\s+cari(ñ|n)o|afectuosamente|su\s+amigo|cu(í|i)dese(\s+mucho)?|cu(í|i)date(\s+mucho)?)\b[,.!]*$/i;

/**
 * Trim any closing and signature off the tail. The letterhead supplies both, so a model that
 * signs off anyway would put "Warmly, Isaac" on the page twice — which is exactly what the first
 * live drafts did.
 */
export function stripSignature(body: string, agentName: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const agent = agentName.trim().toLowerCase();
  const agentParts = agent.split(/\s+/).filter(Boolean);

  const isAgentLine = (line: string) => {
    const l = line.trim().toLowerCase().replace(/[,.]+$/, "");
    if (!l) return false;
    if (l === agent) return true;
    // Also catch "Isaac" / "Isaac Corrales" style partial signatures.
    return agentParts.length > 0 && l.split(/\s+/).every((w) => agentParts.includes(w));
  };

  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (last === "" || CLOSING_LINE.test(last) || isAgentLine(last)) {
      lines.pop();
      continue;
    }
    break;
  }

  return lines.join("\n").trim();
}

function buildSystemPrompt(language: MailingLabelLanguage, agent: LetterAgentInfo): string {
  const inSpanish = language === "es";
  return [
    `You write short personal letters for ${agent.name}, a licensed agent who helps people set up`,
    `final expense coverage through Senior Life. The letter is printed and mailed to someone who`,
    `already asked for information about final expense coverage.`,
    ``,
    `Write the letter ${inSpanish ? "in warm, natural Latin American Spanish" : "in warm, natural English"}.`,
    ...(inSpanish
      ? [
          `Address the reader as "usted" throughout — usted, su, le, lo/la. Never use "tú", "te",`,
          `"ti", "tu/tus", or -as/-es verb endings. These readers are seniors and the informal`,
          `register reads as disrespectful.`,
        ]
      : []),
    ``,
    `VOICE`,
    `- Write like one person writing to another. Warm, caring, respectful, never pushy.`,
    `- The reader is a senior. Short sentences. Everyday words. Nothing to decode.`,
    `- Generous, human phrasing is good: it would be my pleasure, I would be glad to,`,
    `  I would love to help you protect your family.`,
    `- Do not oversell and do not over-explain. Warmth beats detail.`,
    ``,
    `LANGUAGE TO USE`,
    `- Say: coverage, plan, program, benefit, protecting your family, final expenses.`,
    `- Never use industry words. Specifically avoid: insurance, policy, premium, underwriting,`,
    `  beneficiary, death benefit, face amount, rider, quote, sell, buy.`,
    ``,
    `HONESTY — these are hard limits, never bend them:`,
    `- Never say or imply the letter is from a government agency, Medicare, Social Security, or`,
    `  "the state", and never imply a government endorsement.`,
    `- Never say or imply the coverage is free, automatic, already approved, or expiring.`,
    `- Never invent facts about the reader. Use only details you are given.`,
    `- Do not promise a specific price, amount, or approval.`,
    ``,
    `FORMAT`,
    `- Begin with the greeting line, then 3 or 4 short paragraphs.`,
    `- 110 to 170 words total, not counting the greeting.`,
    `- Separate paragraphs with a blank line. No bullet points, no headings, no subject line.`,
    `- STOP after the last sentence of the final paragraph. Do NOT add a closing line`,
    `  ("Warm regards", "Atentamente", "Cuídese"), do NOT sign your name, and do NOT list contact`,
    `  details on their own line. The printed letterhead already adds the closing and signature,`,
    `  so anything you add there appears twice on the page.`,
    `- The last paragraph should warmly invite them to call ${agent.phone || "me"}.`,
    `- Return only the letter text. No commentary, no markdown, no quotes around it.`,
  ].join("\n");
}

function buildUserPrompt(
  record: MailingLabelRecord,
  agent: LetterAgentInfo,
  notes: string[]
): string {
  const greeting =
    record.language === "es"
      ? `Estimado(a) ${properCase(firstNameOf(record))},`
      : `Dear ${properCase(firstNameOf(record))},`;

  const lines = [
    `Write the letter now.`,
    ``,
    `Greeting to use exactly: ${greeting}`,
    `Reader's city and state: ${properCase(record.city)}, ${record.state}`,
    `Agent's name: ${agent.name}`,
    `Agent's phone: ${agent.phone || "(not provided)"}`,
  ];

  if (notes.length > 0) {
    lines.push(
      ``,
      `NOTES FROM PREVIOUS PHONE CONVERSATIONS WITH THIS PERSON.`,
      `Use one or two genuinely relevant details so the letter feels like it remembers them —`,
      `for example something they said they were worried about, or who they want to protect.`,
      `Reference details naturally and only if you are confident. Ignore anything unclear,`,
      `and never mention money amounts, health conditions, or anything sensitive.`,
      ``,
      ...notes.map((n, i) => `--- Note ${i + 1} ---\n${n}`)
    );
  } else {
    lines.push(
      ``,
      `There is no call history for this person yet, so keep the letter general and welcoming.`,
      `Do not imply you have already spoken with them.`
    );
  }

  return lines.join("\n");
}

async function callModel(system: string, user: string): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const res = await client.chat.completions.create({
    model,
    temperature: 0.8, // A little variety so regenerating actually gives a different letter.
    max_tokens: 600,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Draft a letter for one prospect. Reads the contact's CRM notes when we know the contact id.
 * Throws only when the model gives us nothing usable — the caller turns that into a 502.
 */
export async function generateProspectLetter(params: {
  record: MailingLabelRecord;
  agent: LetterAgentInfo;
}): Promise<GeneratedLetter> {
  const { record, agent } = params;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured, so letters can't be drafted.");
  }

  // Call summaries can carry card/account digits; mask before anything leaves for the model.
  const rawNotes = record.crmContactId
    ? await agentCrmFetchContactNotes(record.crmContactId)
    : [];
  const notes = rawNotes
    .slice(0, MAX_NOTES)
    .map((n) => maskSensitiveNumbers(n.body).slice(0, MAX_NOTE_CHARS));

  const system = buildSystemPrompt(record.language, agent);
  const user = buildUserPrompt(record, agent, notes);

  let body = await callModel(system, user);

  // One retry when the model slips into industry language — cheap, and it usually fixes it.
  const slipped = containsJargon(body);
  if (body && slipped.length > 0) {
    body = await callModel(
      system,
      `${user}\n\nYour previous draft used words that are not allowed: ${slipped.join(", ")}. ` +
        `Rewrite it completely without those words, keeping the same warmth and length.`
    );
  }

  body = stripSignature(body, agent.name);

  if (!body.trim()) {
    throw new Error("The model returned an empty letter. Try regenerating.");
  }

  const context =
    notes.length > 0
      ? `Personalized from ${notes.length} recent call ${notes.length === 1 ? "note" : "notes"}`
      : record.crmContactId
        ? "No call notes on this contact yet — general letter"
        : "Not linked to a CRM contact — general letter";

  return { body: body.trim(), context };
}

/** Closing used above the signature on the printed page. */
export function letterClosing(language: MailingLabelLanguage): string {
  return language === "es" ? "Con aprecio," : "Warmly,";
}

/** Long-form date for the letterhead, in the reader's language. */
export function letterDate(language: MailingLabelLanguage, date = new Date()): string {
  return date.toLocaleDateString(language === "es" ? "es-US" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
