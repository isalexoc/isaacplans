/**
 * Impact Health Sharing post-sale welcome, server side.
 *
 * One click on the dashboard, in this order:
 *  1. Put the client's ID card in the CRM media library: the PDF, plus the front-over-back JPG
 *     the browser rendered from it. A resend with no new file reuses the card already stored.
 *  2. Email: the app sends the welcome email itself through the CRM Conversations API, with the
 *     PDF attached. A GHL workflow cannot attach a different file per contact. The email lands in
 *     the contact's conversation like any other.
 *  3. Texts and WhatsApp: POST the values and the card URLs to the GHL Inbound Webhook workflow,
 *     which picks Spanish or English by the contact's `spanish` tag. Nothing is written to the
 *     contact's custom fields.
 *  4. Record what went out in `impact_enrollments`, then leave a plain-text note on the contact.
 *
 * Nothing is sent until every precondition holds. If the email fails, the workflow is not
 * called, so a retry never doubles anything. The one partial case left is "the email went out,
 * then the workflow refused". It is reported as such, and the dialog's channel boxes let the
 * agent resend only the texts.
 *
 * Server-only (CRM credentials, webhook URLs, the shared portal password).
 */

import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { impactEnrollments } from "@/lib/db/schema";
import {
  AGENT_CRM_API_BASE,
  agentCrmAuthHeaders,
  agentCrmGetBaseCredentials,
  agentCrmNormalizeContactTags,
  agentCrmUploadMedia,
} from "@/lib/agent-crm-contacts";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import { INTAKE_SPANISH_TAG } from "@/lib/intake-core/server";
import { getAgentLocalTimezone } from "@/lib/timezone";
import {
  buildImpactWelcomePayload,
  IMPACT_WEBHOOK_ENV,
  type ImpactCardUrls,
  type ImpactEnrollmentInput,
  type ImpactLanguage,
  type ImpactWelcomePayload,
} from "./format";
import { renderImpactWelcomeEmail } from "./email";
import type {
  ImpactContact,
  ImpactEnrollmentDetail,
  ImpactEnrollmentRecord,
  ImpactEnrollmentStatus,
  ImpactSendResult,
} from "./types";

const LOG = "[IMPACT_ENROLLMENT]";
const NOTE_TITLE = "Impact Health Sharing enrollment";
const WEBHOOK_TIMEOUT_MS = 15_000;
const EMAIL_TIMEOUT_MS = 20_000;
/** The Conversations endpoints are documented against this API version. */
const CONVERSATIONS_API_VERSION = "2021-04-15";

type ImpactEnrollmentRow = typeof impactEnrollments.$inferSelect;

export type ImpactResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** The new card for this send, already checked by the route. Null to reuse the stored one. */
export type ImpactCardUpload = { pdf: Blob; image: Blob } | null;

/** The welcome workflow's Inbound Webhook URL, or null when unset or not https. */
export function impactWebhookUrl(): string | null {
  const raw = process.env[IMPACT_WEBHOOK_ENV]?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/** The shared temporary portal password printed in the email. Lives only in env: the repo is public. */
function impactTempPassword(): string | null {
  return process.env.IMPACT_TEMP_PASSWORD?.trim() || null;
}

function toRecord(row: ImpactEnrollmentRow): ImpactEnrollmentRecord {
  return {
    contactId: row.crmContactId,
    memberId: row.memberId,
    startDate: row.startDate,
    monthlyAmountCents: row.monthlyAmountCents,
    paymentDay: row.paymentDay,
    language: row.language === "en" ? "en" : "es",
    cardPdfUrl: row.cardPdfUrl,
    cardImageUrl: row.cardImageUrl,
    sendCount: row.sendCount,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
  };
}

export async function getImpactEnrollment(contactId: string): Promise<ImpactEnrollmentRecord | null> {
  const [row] = await db
    .select()
    .from(impactEnrollments)
    .where(eq(impactEnrollments.crmContactId, contactId))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function listImpactEnrollmentStatuses(
  contactIds: string[]
): Promise<Record<string, ImpactEnrollmentStatus>> {
  if (contactIds.length === 0) return {};
  const rows = await db
    .select({
      contactId: impactEnrollments.crmContactId,
      sendCount: impactEnrollments.sendCount,
      lastSentAt: impactEnrollments.lastSentAt,
    })
    .from(impactEnrollments)
    .where(inArray(impactEnrollments.crmContactId, contactIds));
  return Object.fromEntries(
    rows.map((r) => [r.contactId, { sendCount: r.sendCount, lastSentAt: r.lastSentAt?.toISOString() ?? null }])
  );
}

/**
 * `spanish` tag → Spanish, anything else → English. This is exactly the condition the welcome
 * workflow's language branch uses (like every other GHL workflow of Isaac's), so the email the app
 * sends and the texts the workflow sends always come out in the same language. To switch a
 * client's language, change the tag in the CRM.
 */
function contactLanguage(tags: string[]): ImpactLanguage {
  return tags.some((t) => t.trim().toLowerCase() === INTAKE_SPANISH_TAG) ? "es" : "en";
}

/** One GET for the fields the dialog shows plus the tags that pick the language. */
async function loadImpactContact(contactId: string, token: string): Promise<ImpactContact | null> {
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${encodeURIComponent(contactId)}`, {
    headers: agentCrmAuthHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`${LOG} Get contact failed:`, res.status);
    return null;
  }
  const data = await res.json().catch(() => null);
  const c = data?.contact ?? data;
  if (!c?.id) return null;
  const firstName = typeof c.firstName === "string" ? c.firstName.trim() : "";
  const lastName = typeof c.lastName === "string" ? c.lastName.trim() : "";
  return {
    contactId: c.id,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ") || (c.contactName ?? ""),
    email: typeof c.email === "string" ? c.email.trim().toLowerCase() : "",
    phone: typeof c.phone === "string" ? c.phone.trim() : "",
    language: contactLanguage(agentCrmNormalizeContactTags(c.tags)),
  };
}

export async function getImpactEnrollmentDetail(
  contactId: string
): Promise<ImpactResult<ImpactEnrollmentDetail>> {
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return { ok: false, status: 400, error: "CRM is not configured." };

  const [contact, enrollment] = await Promise.all([
    loadImpactContact(contactId, creds.token),
    getImpactEnrollment(contactId),
  ]);
  if (!contact) return { ok: false, status: 404, error: "Contact not found in the CRM." };

  return {
    ok: true,
    data: {
      contact,
      enrollment,
      webhookConfigured: Boolean(impactWebhookUrl()),
      emailConfigured: Boolean(impactTempPassword()),
    },
  };
}

/** "S002048413" → "impact-id-card-S002048413-<time>.pdf". The time keeps re-uploads apart. */
function cardFileName(memberId: string, ext: "pdf" | "jpg"): string {
  const safe = memberId.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "member";
  return `impact-id-card-${safe}-${Date.now()}.${ext}`;
}

async function uploadCard(card: NonNullable<ImpactCardUpload>, memberId: string): Promise<ImpactCardUrls | null> {
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return null;
  const [pdf, image] = await Promise.all([
    agentCrmUploadMedia(card.pdf, cardFileName(memberId, "pdf"), creds.locationId, creds.token, LOG),
    agentCrmUploadMedia(card.image, cardFileName(memberId, "jpg"), creds.locationId, creds.token, LOG),
  ]);
  return pdf && image ? { pdfUrl: pdf.url, imageUrl: image.url } : null;
}

async function sendWelcomeEmail(
  contactId: string,
  payload: ImpactWelcomePayload,
  tempPassword: string,
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { subject, html } = renderImpactWelcomeEmail(payload, tempPassword);
  const emailFrom = process.env.IMPACT_EMAIL_FROM?.trim();
  try {
    const res = await fetch(`${AGENT_CRM_API_BASE}/conversations/messages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Version: CONVERSATIONS_API_VERSION,
      },
      body: JSON.stringify({
        type: "Email",
        contactId,
        subject,
        html,
        attachments: [payload.member_card_url],
        ...(emailFrom ? { emailFrom } : {}),
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    const text = (await res.text()).slice(0, 300);
    console.warn(`${LOG} Email send rejected:`, res.status, text);
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error:
          "The CRM key is not allowed to send emails. In Agent CRM → Settings → Private Integrations, add the conversations/message.write scope to the key in AGENT_CRM_PI. Nothing was sent.",
      };
    }
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      detail = typeof parsed.message === "string" ? ` ${parsed.message}` : "";
    } catch {
      /* not JSON */
    }
    return { ok: false, error: `The CRM did not send the email (${res.status}).${detail} Nothing was sent.` };
  } catch (error) {
    console.warn(`${LOG} Email send failed:`, error);
    return { ok: false, error: "The CRM did not answer when sending the email. Nothing was sent. Try again." };
  }
}

async function postToWorkflow(url: string, payload: ImpactWelcomePayload): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`${LOG} Workflow webhook rejected:`, res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`${LOG} Workflow webhook failed:`, error);
    return false;
  }
}

/** Plain text: GHL notes do not render Markdown. In the client's language, like the messages. */
function formatImpactNote(
  payload: ImpactWelcomePayload,
  sent: { email: boolean; messages: boolean },
  sendCount: number
): string {
  const es = payload.language === "es";
  const sentOn = new Date(payload.sent_at).toLocaleDateString(es ? "es-US" : "en-US", {
    dateStyle: "medium",
    timeZone: getAgentLocalTimezone(),
  });
  const channels = [
    sent.email ? (es ? "correo con la tarjeta adjunta" : "email with the card attached") : null,
    sent.messages ? (es ? "textos y WhatsApp (workflow)" : "texts and WhatsApp (workflow)") : null,
  ]
    .filter(Boolean)
    .join(" + ");
  const resend = sendCount > 1 ? (es ? ` (envío #${sendCount})` : ` (send #${sendCount})`) : "";
  return [
    es ? "🩺 Impact Health Sharing: bienvenida enviada" : "🩺 Impact Health Sharing: welcome sent",
    "",
    `${es ? "ID de miembro" : "Member ID"}: ${payload.member_id}`,
    `${es ? "Fecha de inicio" : "Start date"}: ${payload.start_date}`,
    `${es ? "Pago mensual" : "Monthly share"}: ${payload.monthly_amount}`,
    `${es ? "Fecha de pago" : "Payment date"}: ${payload.payment_day}`,
    `${es ? "Usuario del portal" : "Portal username"}: ${payload.portal_username}`,
    `${es ? "Tarjeta (PDF)" : "ID card (PDF)"}: ${payload.member_card_url}`,
    "",
    `${es ? "Enviado" : "Sent"}: ${channels}`,
    `${sentOn}${payload.agent_name ? ` · ${payload.agent_name}` : ""}${resend}`,
  ].join("\n");
}

type Prepared = {
  token: string;
  contact: ImpactContact;
  workflowUrl: string | null;
  tempPassword: string | null;
  /** The card from the last send, reused when no new file came with this one. */
  storedCard: ImpactCardUrls | null;
};

/** Every check that can stop a send, before anything leaves the building. */
async function prepareSend(
  contactId: string,
  input: ImpactEnrollmentInput,
  card: ImpactCardUpload
): Promise<ImpactResult<Prepared>> {
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return { ok: false, status: 400, error: "CRM is not configured." };

  const workflowUrl = input.sendMessages ? impactWebhookUrl() : null;
  if (input.sendMessages && !workflowUrl) {
    return { ok: false, status: 400, error: `The texts/WhatsApp workflow URL is not set (${IMPACT_WEBHOOK_ENV}).` };
  }
  const tempPassword = input.sendEmail ? impactTempPassword() : null;
  if (input.sendEmail && !tempPassword) {
    return { ok: false, status: 400, error: "The portal password for the email is not set (IMPACT_TEMP_PASSWORD)." };
  }

  const [contact, previous] = await Promise.all([loadImpactContact(contactId, creds.token), getImpactEnrollment(contactId)]);
  if (!contact) return { ok: false, status: 404, error: "Contact not found in the CRM." };
  if (!contact.email) {
    return {
      ok: false,
      status: 400,
      error: "This contact has no email in the CRM. Add the email used at Impact (it is the portal username), then send.",
    };
  }
  const storedCard =
    previous?.cardPdfUrl && previous.cardImageUrl ? { pdfUrl: previous.cardPdfUrl, imageUrl: previous.cardImageUrl } : null;
  if (!card && !storedCard) {
    return { ok: false, status: 400, error: "Upload the member ID card (PDF)." };
  }
  return { ok: true, data: { token: creds.token, contact, workflowUrl, tempPassword, storedCard } };
}

export async function sendImpactWelcome(params: {
  contactId: string;
  input: ImpactEnrollmentInput;
  card: ImpactCardUpload;
  userId: string;
  agentName: string;
}): Promise<ImpactResult<ImpactSendResult>> {
  const { contactId, input, card, userId, agentName } = params;
  const prepared = await prepareSend(contactId, input, card);
  if (!prepared.ok) return prepared;
  const { token, contact, workflowUrl, tempPassword, storedCard } = prepared.data;

  const cardUrls = card ? await uploadCard(card, input.memberId) : storedCard;
  if (!cardUrls) {
    return { ok: false, status: 502, error: "Could not save the ID card in the CRM media library. Nothing was sent. Try again." };
  }

  const sentAt = new Date();
  const payload = buildImpactWelcomePayload(input, contact, agentName, cardUrls, sentAt);

  // prepareSend guarantees a password whenever the email was asked for.
  if (input.sendEmail && tempPassword) {
    const email = await sendWelcomeEmail(contactId, payload, tempPassword, token);
    if (!email.ok) return { ok: false, status: 502, error: email.error };
  }
  const workflowStarted = workflowUrl ? await postToWorkflow(workflowUrl, payload) : false;
  if (input.sendMessages && !workflowStarted && !input.sendEmail) {
    return { ok: false, status: 502, error: "The CRM workflow did not accept the request. Nothing was sent. Try again." };
  }

  const values = {
    contactName: contact.name || null,
    contactEmail: contact.email,
    contactPhone: contact.phone || null,
    memberId: payload.member_id,
    startDate: input.startDate,
    monthlyAmountCents: input.monthlyAmountCents,
    paymentDay: input.paymentDay,
    language: contact.language,
    cardPdfUrl: cardUrls.pdfUrl,
    cardImageUrl: cardUrls.imageUrl,
    lastSentAt: sentAt,
    lastSentByUserId: userId,
    updatedAt: sentAt,
  };
  const [row] = await db
    .insert(impactEnrollments)
    .values({ crmContactId: contactId, ...values, sendCount: 1 })
    .onConflictDoUpdate({
      target: impactEnrollments.crmContactId,
      set: { ...values, sendCount: sql`${impactEnrollments.sendCount} + 1` },
    })
    .returning();

  let notePosted = true;
  try {
    await createContactNote({
      contactId,
      token,
      title: NOTE_TITLE,
      body: formatImpactNote(payload, { email: input.sendEmail, messages: workflowStarted }, row.sendCount),
    });
  } catch (error) {
    notePosted = false;
    console.warn(`${LOG} Note not posted:`, error);
  }

  return {
    ok: true,
    data: {
      enrollment: toRecord(row),
      notePosted,
      emailSent: input.sendEmail,
      workflowStarted,
      workflowFailed: input.sendMessages && !workflowStarted,
    },
  };
}
