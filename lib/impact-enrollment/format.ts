/**
 * Impact Health Sharing post-sale welcome: input validation, per-language formatting, and the
 * payload sent to the GHL workflow.
 *
 * Isomorphic on purpose. The dialog previews exactly what the workflow will receive, and the server
 * builds the real payload, so both read from this one file.
 *
 * Why the values travel in the webhook body and not in custom fields: Isaac does not want new
 * contact fields for a single welcome. A GHL "Inbound Webhook" trigger exposes the body to every
 * step of that run as {{inboundWebhookRequest.<key>}}, and nothing is written to the contact.
 * The workflow's templates contain no logic, so every value arrives already formatted in the
 * client's language. The same payload also fills the email the app sends itself (see email.ts).
 *
 * The language is not chosen in the dialog. It comes from the contact's `spanish` tag, the same
 * rule Isaac's GHL workflows branch on. That way the email and the texts can never disagree.
 */

import { z } from "zod";

export type ImpactLanguage = "en" | "es";

/** Env var holding the welcome workflow's Inbound Webhook URL. One workflow, both languages. */
export const IMPACT_WEBHOOK_ENV = "IMPACT_WELCOME_WEBHOOK_URL";

export const impactEnrollmentInputSchema = z.object({
  memberId: z
    .string()
    .trim()
    .min(1, "Member ID is required.")
    .max(40, "Member ID is too long."),
  /** Membership start date, YYYY-MM-DD. */
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date.")
    .refine((v) => isRealDate(v), "Pick a valid start date."),
  /** Monthly share in cents, so "$189.5" and "189.50" are the same number. */
  monthlyAmountCents: z
    .number()
    .int()
    .min(100, "Enter the monthly amount.")
    .max(1_000_000, "That monthly amount looks wrong."),
  /** Day of the month the share is drafted. */
  paymentDay: z.number().int().min(1, "Pick the payment day.").max(31, "Pick the payment day."),
  /** The welcome email with the card attached, sent by the app. */
  sendEmail: z.boolean(),
  /** The GHL workflow: texts and WhatsApp with the card image, and the dental reminder. */
  sendMessages: z.boolean(),
}).refine((v) => v.sendEmail || v.sendMessages, {
  message: "Pick at least one: the email, or the texts and WhatsApp.",
  path: ["sendEmail"],
});

export type ImpactEnrollmentInput = z.infer<typeof impactEnrollmentInputSchema>;

function isRealDate(ymd: string): boolean {
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

/** "189", "$1,189.5", "189.50" → cents. Null when it is not a money amount. */
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** "$1,189.50". The same in both languages: US Spanish writes dollars the same way. */
export function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** "1 de noviembre de 2026" / "November 1, 2026". UTC so the day never shifts by time zone. */
export function formatStartDate(ymd: string, language: ImpactLanguage): string {
  return new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${ymd}T00:00:00Z`));
}

function englishOrdinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "el 5 de cada mes" / "the 5th of every month". */
export function formatPaymentDay(day: number, language: ImpactLanguage): string {
  return language === "es" ? `el ${day} de cada mes` : `the ${englishOrdinal(day)} of every month`;
}

export type ImpactContactInfo = {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** From the contact's `spanish` tag (see server.ts `contactLanguage`). */
  language: ImpactLanguage;
};

/**
 * The body POSTed to the workflow. Flat snake_case keys, because each one becomes a merge tag the
 * agent picks from a list in GHL. Do not rename keys once the workflows exist: GHL stores the
 * merge tags as literal text, so a rename silently blanks them in every template.
 */
export type ImpactWelcomePayload = {
  contact_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  language: ImpactLanguage;
  member_id: string;
  start_date: string;
  start_date_iso: string;
  monthly_amount: string;
  monthly_amount_number: string;
  payment_day: string;
  payment_day_number: string;
  portal_username: string;
  /** The ID card PDF in the CRM media library (the email's attachment). */
  member_card_url: string;
  /** Front over back as one JPG, for the SMS attachment: phones display images, not PDFs. */
  member_card_image_url: string;
  agent_name: string;
  sent_at: string;
};

export type ImpactCardUrls = { pdfUrl: string; imageUrl: string };

export function buildImpactWelcomePayload(
  input: ImpactEnrollmentInput,
  contact: ImpactContactInfo,
  agentName: string,
  card: ImpactCardUrls,
  sentAt: Date = new Date()
): ImpactWelcomePayload {
  return {
    contact_id: contact.contactId,
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    language: contact.language,
    member_id: input.memberId.trim(),
    start_date: formatStartDate(input.startDate, contact.language),
    start_date_iso: input.startDate,
    monthly_amount: formatAmount(input.monthlyAmountCents),
    monthly_amount_number: (input.monthlyAmountCents / 100).toFixed(2),
    payment_day: formatPaymentDay(input.paymentDay, contact.language),
    payment_day_number: String(input.paymentDay),
    portal_username: contact.email,
    member_card_url: card.pdfUrl,
    member_card_image_url: card.imageUrl,
    agent_name: agentName,
    sent_at: sentAt.toISOString(),
  };
}
