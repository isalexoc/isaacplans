import type { CallLanguage, LineOfBusiness } from "@/lib/call-summary-structured";

export type MissedCallDraftPromptInput = {
  contactFirstName: string | null;
  language: CallLanguage;
  lineOfBusiness: LineOfBusiness;
  /** Light context from the most recent prior completed call, if any — never fabricated. */
  priorContext?: {
    summary?: string;
    policySummary?: string; // e.g. "$10,000 face amount with Aetna, ~$54/mo"
  };
};

const LOB_TOPIC: Record<LineOfBusiness, { en: string; es: string }> = {
  final_expense: { en: "protecting your family from funeral costs", es: "proteger a tu familia de los gastos del funeral" },
  aca: { en: "your health coverage options", es: "tus opciones de cobertura de salud" },
  stm: { en: "covering the gap until your next plan starts", es: "cubrir el tiempo hasta tu próximo plan" },
  dental_vision: { en: "your dental and vision coverage", es: "tu cobertura dental y de visión" },
  hospital_indemnity: { en: "extra protection if you're ever hospitalized", es: "protección extra si alguna vez te hospitalizan" },
  iul: { en: "building protected savings for your family's future", es: "construir ahorros protegidos para el futuro de tu familia" },
  other: { en: "what we discussed", es: "lo que hablamos" },
};

const SYSTEM_PROMPT = `You are a marketing assistant drafting two SHORT, PERSONAL follow-up messages for Isaac, an independent insurance agent, to send after he called someone and they didn't pick up. Isaac will review and edit these himself before sending — they are NEVER sent automatically.

CRITICAL LANGUAGE RULE — never violate this (matches Isaac's brand voice everywhere else):
- NEVER use the word "insurance", "insured", or "insurer"
- NEVER use the word "policy" — use "plan" or "coverage" instead
- NEVER say "premium" — use "monthly amount" or "monthly cost"
- NEVER say "underwriting"
- In Spanish, avoid "seguro" — use "plan", "beneficios", "cobertura", "protección" instead
- Write natural Latin American Spanish (not Castilian), "tú" not "usted", warm and familial in tone

TONE
- Warm, personal, like a text from someone who knows them — not a mass blast
- Create genuine urgency around protecting their family/future — NOT fake countdowns, NOT "act now or lose this forever", NOT scarcity tricks. Urgency comes from the real stakes (family left unprotected, a gap in coverage), not manufactured pressure.
- Invite a reply on their own time — no pressure, no guilt

CHANNEL DIFFERENCES
- SMS: short (1-2 sentences), plain text, NO emoji (some phones render them oddly in SMS), reads like a personal text message
- WhatsApp: a little warmer, 1-2 emoji maximum, can be a touch longer

PERSONALIZATION
- Use the first name if given
- If priorContext is given, reference it lightly and naturally (e.g. "about the $10,000 plan we discussed") — do NOT dump data or sound robotic
- If no priorContext, keep it general — just that Isaac tried to reach them about the topic given

FACTUALITY
- Never invent facts, numbers, or commitments not present in the given context

OUTPUT
- Output ONLY valid JSON: { "sms": string, "whatsapp": string }
- No markdown, no extra keys`;

export function buildMissedCallDraftPrompt(input: MissedCallDraftPromptInput): {
  system: string;
  user: string;
} {
  const topic = LOB_TOPIC[input.lineOfBusiness][input.language];
  const languageLabel = input.language === "es" ? "Spanish" : "English";

  const lines = [
    `Write both drafts in ${languageLabel}.`,
    `Contact first name: ${input.contactFirstName || "(not given — keep it general, no placeholder name)"}`,
    `Topic: ${topic}`,
    input.priorContext?.summary ? `Prior call summary: ${input.priorContext.summary}` : null,
    input.priorContext?.policySummary ? `What was discussed/quoted: ${input.priorContext.policySummary}` : null,
    !input.priorContext ? "No prior call on record — this is the first attempt to reach them." : null,
  ].filter(Boolean);

  return { system: SYSTEM_PROMPT, user: lines.join("\n") };
}
