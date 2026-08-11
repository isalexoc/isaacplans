import "server-only";
import OpenAI from "openai";
import { buildLetterContext, type LetterContext } from "./letter-context";
import type {
  LabelAgentContact,
  LetterKind,
  MailingLabelLanguage,
  MailingLabelRecord,
} from "./types";

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

  /**
   * A valedictory ends in a comma; a real sentence ends in . ! or ?. That shape catches the
   * ones no fixed list ever will — "Looking forward to staying connected," and friends.
   */
  const isValediction = (line: string) => line.length <= 60 && /,$/.test(line);

  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim();
    if (last === "" || CLOSING_LINE.test(last) || isAgentLine(last) || isValediction(last)) {
      lines.pop();
      continue;
    }
    break;
  }

  return lines.join("\n").trim();
}

function buildSystemPrompt(
  language: MailingLabelLanguage,
  agent: LetterAgentInfo,
  kind: LetterKind
): string {
  const inSpanish = language === "es";
  const isWelcome = kind === "welcome";
  return [
    `You write short personal letters for ${agent.name}, a licensed agent who helps people set up`,
    `final expense coverage through Senior Life.`,
    isWelcome
      ? `This letter is printed and mailed to someone who has JUST BECOME A CLIENT. They decided to` +
        ` go ahead. This is a welcome letter, not a pitch — there is nothing left to sell.`
      : `The letter is printed and mailed to someone who already asked for information about final` +
        ` expense coverage but has not decided yet.`,
    ``,
    ...(isWelcome
      ? [
          `WHAT THIS LETTER IS FOR`,
          `Final expense is an emotional decision, and the weeks right after it are when people`,
          `second-guess themselves. This letter exists to make them feel good about what they did`,
          `and to make sure they know a real person is looking after them.`,
          `- Welcome them warmly to the Senior Life family.`,
          `- Affirm the decision. They did something real and loving for the people they care about.`,
          `  Say so plainly, without flattery.`,
          `- If you know who they are protecting, tie the decision to those people by name. That is`,
          `  the heart of the letter.`,
          `- Make clear they are not on their own: they have ${agent.name} personally, not a call`,
          `  center, and can call about anything at all.`,
          `- Ask them, warmly, to call FIRST if anything ever changes — money gets tight, a question`,
          `  comes up, something looks off. Frame it as "let me help you sort it out before you do`,
          `  anything", never as pressure and never as a warning about consequences.`,
          ``,
          `NEVER, in a welcome letter:`,
          `- State or imply amounts, prices, draft dates, effective dates, or coverage details.`,
          `  You do not have reliable values for any of that and a wrong one destroys the trust`,
          `  this letter is meant to build.`,
          `- Say the coverage is already active, approved, or paid up.`,
          `- Suggest they cannot cancel, that cancelling costs them, or anything that pressures them`,
          `  into keeping it. Asking them to call first is fine; implying they are trapped is not.`,
          `- Ask for referrals, upsell, or mention any other product.`,
          ``,
        ]
      : []),
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
  context: LetterContext
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

  const hasContext = context.facts.length > 0 || context.conversations.length > 0;
  const isWelcome = record.letterKind === "welcome";
  const hasSpoken = context.conversations.length > 0;

  // Knowing facts about someone is not the same as having spoken to them. Details pulled from a
  // form they filled out led drafts to open with "it was a pleasure speaking with you" and refer
  // to "the program we discussed" for people who had never had a call. A new client is the
  // exception — they plainly dealt with you — but the specifics of those calls are still off
  // limits unless the notes below actually contain them.
  lines.push(
    ``,
    isWelcome
      ? `THIS PERSON IS NOW YOUR CLIENT, so you have clearly worked together. Do not invent` +
        ` specifics of past conversations beyond what the notes below actually say.`
      : hasSpoken
        ? `YOU HAVE SPOKEN WITH THIS PERSON BEFORE. Referring to that conversation is natural and good.`
        : `YOU HAVE NEVER SPOKEN WITH THIS PERSON. Anything you know came from a form they filled` +
          ` out, not a conversation. Never write "it was a pleasure speaking with you", "as we` +
          ` discussed", "the plan we talked about", or anything else implying a previous call.`
  );

  if (context.facts.length > 0) {
    lines.push(
      ``,
      `WHAT YOU KNOW ABOUT THIS PERSON`,
      hasSpoken
        ? `These are confirmed details. Weave in the ones that make the letter feel personal.`
        : `These came from the form they filled out. Weave in the ones that make the letter feel` +
          ` personal, but do not present them as things they told you on a call.`,
      ...context.facts.map((f) => `- ${f}`)
    );
  }

  if (context.conversations.length > 0) {
    lines.push(
      ``,
      `NOTES FROM PREVIOUS PHONE CONVERSATIONS WITH THIS PERSON (newest first)`,
      ...context.conversations.map((n, i) => `--- Call ${i + 1} ---\n${n}`)
    );
  }

  if (hasContext) {
    lines.push(
      ``,
      `HOW TO USE WHAT YOU KNOW`,
      `- Pick the TWO most meaningful details. A letter stuffed with facts feels like a file`,
      `  review; one or two feels like someone who remembers them.`,
      `- Naming the people they want taken care of is the single warmest thing you can do.`,
      `  If you have them, refer to them by name and relationship — "making sure Maria and`,
      `  the kids are looked after" lands far harder than "protecting your family".`,
      `- If they raised a worry before, acknowledge it gently and say you can walk through it`,
      `  together. Never argue with it or sell against it.`,
      `- If something was agreed last time, honor it: pick the thread back up where it was left.`,
      `- Only state what the notes actually support. If a detail is ambiguous, leave it out.`,
      `- Never mention health conditions, medications, money amounts, prices, or dates of birth,`,
      `  even if you can infer them. This letter travels through the mail and anyone in the`,
      `  household may open it.`
    );
  } else {
    lines.push(``, `There is no history for this person yet, so keep the letter general and welcoming.`);
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

  const context = await buildLetterContext(record);
  const system = buildSystemPrompt(record.language, agent, record.letterKind);
  const user = buildUserPrompt(record, agent, context);

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

  return { body: body.trim(), context: context.label };
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
