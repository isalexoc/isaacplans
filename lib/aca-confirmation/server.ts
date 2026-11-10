/**
 * ACA application review confirmation, server side: issue a signing request, email it, show the
 * client their form, take their signature, and report all of it to the agent's dialog.
 *
 * The post-signing work (PDF archive, CRM Documents file, note, tag) lives in ./finalize.ts and
 * runs as a QStash job, so the client's "Sign" tap never waits on Cloudinary or the CRM.
 *
 * ─── Invariants ───
 *  - Nothing is written until every precondition of a send holds.
 *  - Every exclusive state change (sign, cancel, reopen on resend) is ONE conditional UPDATE: the
 *    Neon HTTP driver has no transactions, and two taps on "Sign" must not both win.
 *  - A record is append-only once signed. New application, update or plan change = new row.
 *  - The public side never learns the contact id, the CRM data or anything about other requests:
 *    the token is its only key, and dead links answer with a code, never display text.
 *
 * Raw `sql` templates bypass Drizzle's column mapping, so dates go into them as ISO strings: a JS
 * Date would be serialized in the server's local zone, and these columns are UTC wall time.
 *
 * Server-only (CRM credentials, database).
 */

import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { waitUntil } from "@vercel/functions";
import { db } from "@/lib/db";
import { acaConfirmationEvents, acaConfirmations, acaIntakeSessions } from "@/lib/db/schema";
import {
  AGENT_CRM_API_BASE,
  agentCrmAuthHeaders,
  agentCrmGetBaseCredentials,
  agentCrmNormalizeContactTags,
} from "@/lib/agent-crm-contacts";
import { sendCrmEmail } from "@/lib/agent-crm-email";
import { ACA_SPANISH_TAG } from "@/lib/aca-intake/server";
import { decryptAcaIntakeData } from "@/lib/aca-intake/encryption";
import type { AcaIntakeData } from "@/lib/aca-intake/schema";
import { publishJob } from "@/lib/qstash/client";
import { getAgentLocalTimezone } from "@/lib/timezone";
import {
  ACA_CONFIRMATION_LINK_TTL_DAYS,
  ACA_CONFIRMATION_TOKEN_LENGTH,
  acaConfirmationEmailFrom,
  acaConfirmationFileFieldId,
  getAcaConfirmationAgent,
  isAgencyEmail,
} from "./config";
import { renderAcaConfirmationRequestEmail } from "./email";
import {
  computeEvidenceSha256,
  decodeSignaturePng,
  sha256Hex,
  stableStringify,
  type RequestEvidence,
} from "./evidence";
import { finalizeAcaConfirmation } from "./finalize";
import { addEvent, agentOf, getConfirmationRow, type ConfirmationRow } from "./store";
import { CURRENT_FORM_VERSION, getFormDefinition, renderConfirmationForm, renderConfirmationFormBoth } from "./form-text";
import {
  CONFIRMATION_TOKEN_RE,
  cleanPersonName,
  confirmationState,
  describeDevice,
  describeLocation,
  firstNameOf,
  formatLocalDateTime,
} from "./format";
import { buildAcaConfirmationUrl } from "./share-url";
import type {
  AcaConfirmationBadge,
  AcaConfirmationContact,
  AcaConfirmationCreateInput,
  AcaConfirmationDeadResponse,
  AcaConfirmationDetail,
  AcaConfirmationLanguage,
  AcaConfirmationPublicView,
  AcaConfirmationRecord,
  AcaConfirmationSignInput,
  AcaConfirmationSignResult,
  AcaConfirmationSnapshot,
} from "./types";

const LOG = "[ACA_CONFIRMATION]";
const DAY_MS = 24 * 60 * 60 * 1000;
/** A reload within this window doesn't add another "viewed" row to the trail. */
const VIEW_EVENT_THROTTLE_MS = 5 * 60 * 1000;

export type AcaResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string; record?: AcaConfirmationRecord };

/** The outcome of a public request on a link that can't be used: 404 or 410 with a code. */
export type DeadLink = { status: 404 | 410; body: AcaConfirmationDeadResponse };

export type EmailOutcome = { emailSent: boolean; emailError: string | null };

const lang = (value: string | null | undefined): AcaConfirmationLanguage => (value === "en" ? "en" : "es");

/** Postgres unique_violation (23505), as the Neon driver surfaces it. */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return e?.code === "23505" || (typeof e?.message === "string" && e.message.includes("duplicate key"));
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

export function toRecord(row: ConfirmationRow, linkOrigin?: string): AcaConfirmationRecord {
  const status = row.status === "signed" || row.status === "cancelled" ? row.status : "pending";
  const state = confirmationState(status, row.expiresAt);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    id: row.id,
    status,
    state,
    language: lang(row.language),
    consumerName: row.consumerName,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt.toISOString(),
    lastSentAt: iso(row.lastSentAt),
    sendCount: row.sendCount,
    expiresAt: row.expiresAt.toISOString(),
    firstViewedAt: iso(row.firstViewedAt),
    lastViewedAt: iso(row.lastViewedAt),
    viewCount: row.viewCount,
    signedAt: iso(row.signedAt),
    signedLanguage: row.signedLanguage ? lang(row.signedLanguage) : null,
    signatureMethod: row.signatureMethod === "drawn" || row.signatureMethod === "typed" ? row.signatureMethod : null,
    signerLocation: describeLocation({ city: row.signerCity, region: row.signerRegion, country: row.signerCountry }),
    signerDevice: describeDevice(row.signerUserAgent),
    signerIpMatchesAgent: row.signerIpMatchesAgent,
    cancelledAt: iso(row.cancelledAt),
    pdfStored: Boolean(row.pdfStoredAt),
    crmFileSaved: Boolean(row.crmFileSavedAt),
    notePosted: Boolean(row.notePostedAt),
    tagged: Boolean(row.taggedAt),
    url: state === "pending" ? buildAcaConfirmationUrl(row.token, lang(row.language), linkOrigin) : null,
  };
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

async function getConfirmationRowByToken(token: string): Promise<ConfirmationRow | null> {
  const [row] = await db.select().from(acaConfirmations).where(eq(acaConfirmations.token, token)).limit(1);
  return row ?? null;
}

/** The contact's request that can still be signed, if any. */
async function getPendingForContact(contactId: string): Promise<ConfirmationRow | null> {
  const [row] = await db
    .select()
    .from(acaConfirmations)
    .where(
      and(
        eq(acaConfirmations.crmContactId, contactId),
        eq(acaConfirmations.status, "pending"),
        gt(acaConfirmations.expiresAt, new Date())
      )
    )
    .orderBy(desc(acaConfirmations.createdAt))
    .limit(1);
  return row ?? null;
}

// ─── CRM contact ─────────────────────────────────────────────────────────────

/** `spanish` tag → es, anything else → en: the rule all of Isaac's GHL workflows branch on. */
function contactLanguage(tags: string[]): AcaConfirmationLanguage {
  return tags.some((t) => t.trim().toLowerCase() === ACA_SPANISH_TAG) ? "es" : "en";
}

async function loadContact(contactId: string, token: string): Promise<AcaConfirmationContact | null> {
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
    name: cleanPersonName([firstName, lastName].filter(Boolean).join(" ") || (c.contactName ?? "")),
    email: typeof c.email === "string" ? c.email.trim().toLowerCase() : "",
    phone: typeof c.phone === "string" ? c.phone.trim() : "",
    language: contactLanguage(agentCrmNormalizeContactTags(c.tags)),
  };
}

/**
 * The intake row the dialog was opened from — only if it really belongs to this contact. The id
 * comes from the browser, so it is never trusted on its own.
 */
async function intakeSessionFor(contactId: string, sessionId: string | undefined) {
  if (!sessionId) return null;
  const [row] = await db
    .select({ id: acaIntakeSessions.id, crmContactId: acaIntakeSessions.crmContactId, data: acaIntakeSessions.data })
    .from(acaIntakeSessions)
    .where(eq(acaIntakeSessions.id, sessionId))
    .limit(1);
  return row && row.crmContactId === contactId ? row : null;
}

/** The primary applicant's full legal name from the intake (first, middle, last, second last). */
function legalNameFromIntake(data: unknown): string | null {
  try {
    const decrypted = decryptAcaIntakeData((data ?? {}) as AcaIntakeData);
    const parts = [decrypted.firstName, decrypted.middleName, decrypted.lastName, decrypted.secondLastName]
      .map((v) => (typeof v === "string" ? cleanPersonName(v) : ""))
      .filter(Boolean);
    return parts.length >= 2 ? parts.join(" ") : null;
  } catch (error) {
    console.warn(`${LOG} Intake name unavailable:`, error);
    return null;
  }
}

function emailIssueOf(email: string): AcaConfirmationDetail["emailIssue"] {
  if (!email) return "missing";
  return isAgencyEmail(email) ? "agency_domain" : null;
}

function emailIssueMessage(issue: NonNullable<AcaConfirmationDetail["emailIssue"]>): string {
  return issue === "missing"
    ? "This contact has no email in the CRM. Add the client's own email there, then send. Nothing was sent."
    : "The contact's email is an @isaacplans.com address. The link must go to the client's own email. Nothing was sent.";
}

// ─── Agent side ──────────────────────────────────────────────────────────────

export async function getAcaConfirmationDetail(
  contactId: string,
  intakeSessionId: string | undefined,
  linkOrigin?: string
): Promise<AcaResult<AcaConfirmationDetail>> {
  const creds = agentCrmGetBaseCredentials();
  // The history comes from our own table, so it loads even when the CRM can't return the contact
  // (merged, deleted, or down): signed records must stay reachable for an audit. Only sending
  // needs the contact.
  const [contact, rows, session] = await Promise.all([
    creds ? loadContact(contactId, creds.token).catch(() => null) : Promise.resolve(null),
    db
      .select()
      .from(acaConfirmations)
      .where(eq(acaConfirmations.crmContactId, contactId))
      .orderBy(desc(acaConfirmations.createdAt)),
    intakeSessionFor(contactId, intakeSessionId),
  ]);
  if (!contact && rows.length === 0) {
    return creds
      ? { ok: false, status: 404, error: "Contact not found in the CRM." }
      : { ok: false, status: 400, error: "CRM is not configured." };
  }

  const formVersion = CURRENT_FORM_VERSION;
  const definition = getFormDefinition(formVersion);
  const today = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    data: {
      contact,
      contactError: contact
        ? null
        : creds
          ? "The CRM didn't return this contact (it may have been merged or deleted). Its confirmations are listed below; sending a new one needs the contact."
          : "CRM is not configured.",
      suggestedName: (session ? legalNameFromIntake(session.data) : null) ?? contact?.name ?? rows[0]?.consumerName ?? "",
      agent: getAcaConfirmationAgent(),
      emailIssue: contact ? emailIssueOf(contact.email) : null,
      config: {
        fileFieldConfigured: Boolean(acaConfirmationFileFieldId()),
        formVersion,
        allowTypedSignature: definition?.allowTypedSignature ?? false,
        linkTtlDays: ACA_CONFIRMATION_LINK_TTL_DAYS,
        formNotice: definition?.py2028NoticeFrom && today >= definition.py2028NoticeFrom ? "py2028" : null,
      },
      history: rows.map((row) => toRecord(row, linkOrigin)),
    },
  };
}

/** The newest request per contact, for the dashboard badges. */
export async function listAcaConfirmationBadges(contactIds: string[]): Promise<Record<string, AcaConfirmationBadge>> {
  if (contactIds.length === 0) return {};
  const rows = await db
    .select({
      id: acaConfirmations.id,
      crmContactId: acaConfirmations.crmContactId,
      status: acaConfirmations.status,
      expiresAt: acaConfirmations.expiresAt,
      signedAt: acaConfirmations.signedAt,
      lastSentAt: acaConfirmations.lastSentAt,
      createdAt: acaConfirmations.createdAt,
    })
    .from(acaConfirmations)
    .where(inArray(acaConfirmations.crmContactId, contactIds))
    .orderBy(desc(acaConfirmations.createdAt));

  const badges: Record<string, AcaConfirmationBadge> = {};
  for (const row of rows) {
    if (badges[row.crmContactId]) continue; // newest first: keep the first one seen
    const status = row.status === "signed" || row.status === "cancelled" ? row.status : "pending";
    badges[row.crmContactId] = {
      id: row.id,
      state: confirmationState(status, row.expiresAt),
      at: (row.signedAt ?? row.lastSentAt ?? row.createdAt).toISOString(),
    };
  }
  return badges;
}

/** Email the signing link (first send or resend) and record what happened. */
async function deliverRequestEmail(
  row: ConfirmationRow,
  crmToken: string,
  opts: { isResend: boolean; evidence: RequestEvidence; userId: string; linkOrigin?: string }
): Promise<EmailOutcome> {
  const language = lang(row.language);
  const { subject, html } = renderAcaConfirmationRequestEmail({
    language,
    firstName: firstNameOf(row.consumerName),
    url: buildAcaConfirmationUrl(row.token, language, opts.linkOrigin),
    expiresAtLocal: formatLocalDateTime(row.expiresAt, language, getAgentLocalTimezone()),
    agent: agentOf(row),
    isResend: opts.isResend,
  });
  const result = await sendCrmEmail({
    contactId: row.crmContactId,
    token: crmToken,
    subject,
    html,
    emailFrom: acaConfirmationEmailFrom(),
    logPrefix: LOG,
  });

  if (result.ok) {
    const now = new Date();
    // Conditional: if the client signed in the moments the email took, the signed row is final.
    await db
      .update(acaConfirmations)
      .set({ sendCount: sql`${acaConfirmations.sendCount} + 1`, lastSentAt: now, updatedAt: now })
      .where(and(eq(acaConfirmations.id, row.id), eq(acaConfirmations.status, "pending")));
    await addEvent(row.id, opts.isResend ? "resent" : "email_sent", opts.evidence, opts.userId, {
      to: row.contactEmail,
      messageId: result.messageId,
    });
    return { emailSent: true, emailError: null };
  }

  await addEvent(row.id, "email_failed", opts.evidence, opts.userId, {
    to: row.contactEmail,
    reason: result.reason,
    status: result.status,
    detail: result.detail,
  });
  const tail = "The link was created: copy it or resend.";
  const emailError =
    result.reason === "scope"
      ? `The CRM key is not allowed to send emails. In Agent CRM → Settings → Private Integrations, add the conversations/message.write scope to the key in AGENT_CRM_PI. ${tail}`
      : result.reason === "network"
        ? `The CRM did not answer when sending the email. ${tail}`
        : `The CRM did not send the email (${result.status}).${result.detail ? ` ${result.detail}` : ""} ${tail}`;
  return { emailSent: false, emailError };
}

export async function createAndSendAcaConfirmation(params: {
  contactId: string;
  input: AcaConfirmationCreateInput;
  userId: string;
  evidence: RequestEvidence;
  linkOrigin?: string;
}): Promise<AcaResult<{ record: AcaConfirmationRecord } & EmailOutcome>> {
  const { contactId, input, userId, evidence, linkOrigin } = params;

  const creds = agentCrmGetBaseCredentials();
  if (!creds) return { ok: false, status: 400, error: "CRM is not configured." };
  const agent = getAcaConfirmationAgent();
  if (!agent) {
    return { ok: false, status: 400, error: "Set ACA_AGENT_NPN in Vercel before sending. Nothing was sent." };
  }
  const contact = await loadContact(contactId, creds.token);
  if (!contact) return { ok: false, status: 404, error: "Contact not found in the CRM." };
  const issue = emailIssueOf(contact.email);
  if (issue) return { ok: false, status: 400, error: emailIssueMessage(issue) };

  const pendingExists = (pending: ConfirmationRow) => ({
    ok: false as const,
    status: 409,
    code: "pending_exists",
    error: "This client already has a confirmation waiting to be signed. Resend it or cancel it first.",
    record: toRecord(pending, linkOrigin),
  });
  const pending = await getPendingForContact(contactId);
  if (pending) return pendingExists(pending);

  // An EXPIRED request is still status "pending" (a resend can reopen it). Sending a new one
  // supersedes it: close it first, or the one-pending-per-contact index would refuse the insert.
  const now = new Date();
  const superseded = await db
    .update(acaConfirmations)
    .set({ status: "cancelled", cancelledAt: now, cancelledByUserId: userId, updatedAt: now })
    .where(
      and(
        eq(acaConfirmations.crmContactId, contactId),
        eq(acaConfirmations.status, "pending"),
        lte(acaConfirmations.expiresAt, now)
      )
    )
    .returning({ id: acaConfirmations.id });
  for (const old of superseded) {
    await addEvent(old.id, "cancelled", evidence, userId, { reason: "expired_superseded" });
  }

  const session = await intakeSessionFor(contactId, input.intakeSessionId);
  let row: ConfirmationRow;
  try {
    [row] = await db
      .insert(acaConfirmations)
      .values({
        id: nanoid(),
        token: nanoid(ACA_CONFIRMATION_TOKEN_LENGTH),
        crmContactId: contactId,
        acaIntakeSessionId: session?.id ?? null,
        status: "pending",
        language: input.language,
        formVersion: CURRENT_FORM_VERSION,
        consumerName: input.consumerName,
        contactEmail: contact.email,
        contactPhone: contact.phone || null,
        agentName: agent.name,
        agentNpn: agent.npn,
        agentPhone: agent.phone,
        agentEmail: agent.email,
        agency: agent.agency,
        createdByUserId: userId,
        requestIp: evidence.ip,
        requestCity: evidence.city,
        requestRegion: evidence.region,
        requestCountry: evidence.country,
        requestUserAgent: evidence.userAgent,
        expiresAt: new Date(now.getTime() + ACA_CONFIRMATION_LINK_TTL_DAYS * DAY_MS),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
  } catch (error) {
    // Lost a race with another send for the same client (two tabs, two admins): the unique index
    // aca_confirmation_one_pending_idx refused the second pending row. Show the one that won.
    if (isUniqueViolation(error)) {
      const winner = await getPendingForContact(contactId);
      if (winner) return pendingExists(winner);
    }
    throw error;
  }
  await addEvent(row.id, "created", evidence, userId, { language: input.language, formVersion: CURRENT_FORM_VERSION });

  const email = await deliverRequestEmail(row, creds.token, { isResend: false, evidence, userId, linkOrigin });
  const fresh = (await getConfirmationRow(row.id)) ?? row;
  return { ok: true, data: { record: toRecord(fresh, linkOrigin), ...email } };
}

export async function getAcaConfirmationRecord(id: string, linkOrigin?: string): Promise<AcaConfirmationRecord | null> {
  const row = await getConfirmationRow(id);
  return row ? toRecord(row, linkOrigin) : null;
}

/**
 * Email the same link again and give it a fresh week. Works on an expired request too: that is
 * the usual reason to resend. Refuses if the CRM email changed since the request was issued,
 * because the form the client would sign prints the old one.
 */
export async function resendAcaConfirmation(params: {
  id: string;
  userId: string;
  evidence: RequestEvidence;
  linkOrigin?: string;
}): Promise<AcaResult<{ record: AcaConfirmationRecord } & EmailOutcome>> {
  const { id, userId, evidence, linkOrigin } = params;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return { ok: false, status: 400, error: "CRM is not configured." };
  const row = await getConfirmationRow(id);
  if (!row) return { ok: false, status: 404, error: "Confirmation not found." };
  if (row.status !== "pending") {
    return { ok: false, status: 409, error: "This confirmation is no longer waiting for a signature." };
  }
  const contact = await loadContact(row.crmContactId, creds.token);
  if (!contact) return { ok: false, status: 404, error: "Contact not found in the CRM." };
  if (contact.email !== row.contactEmail) {
    return {
      ok: false,
      status: 409,
      error: "The client's email in the CRM changed since this was sent. Cancel this request and send a new one.",
    };
  }

  const now = new Date();
  const [reopened] = await db
    .update(acaConfirmations)
    .set({ expiresAt: new Date(now.getTime() + ACA_CONFIRMATION_LINK_TTL_DAYS * DAY_MS), updatedAt: now })
    .where(and(eq(acaConfirmations.id, id), eq(acaConfirmations.status, "pending")))
    .returning();
  if (!reopened) return { ok: false, status: 409, error: "This confirmation is no longer waiting for a signature." };

  const email = await deliverRequestEmail(reopened, creds.token, { isResend: true, evidence, userId, linkOrigin });
  const fresh = (await getConfirmationRow(id)) ?? reopened;
  return { ok: true, data: { record: toRecord(fresh, linkOrigin), ...email } };
}

export async function cancelAcaConfirmation(params: {
  id: string;
  userId: string;
  evidence: RequestEvidence;
  linkOrigin?: string;
}): Promise<AcaResult<{ record: AcaConfirmationRecord }>> {
  const now = new Date();
  const [row] = await db
    .update(acaConfirmations)
    .set({ status: "cancelled", cancelledAt: now, cancelledByUserId: params.userId, updatedAt: now })
    .where(and(eq(acaConfirmations.id, params.id), eq(acaConfirmations.status, "pending")))
    .returning();
  if (!row) {
    const existing = await getConfirmationRow(params.id);
    return existing
      ? { ok: false, status: 409, error: "This confirmation is no longer waiting for a signature." }
      : { ok: false, status: 404, error: "Confirmation not found." };
  }
  await addEvent(row.id, "cancelled", params.evidence, params.userId);
  return { ok: true, data: { record: toRecord(row, params.linkOrigin) } };
}

// ─── Client side (public, token only) ────────────────────────────────────────

function deadLink(row: ConfirmationRow | null): DeadLink | null {
  if (!row) {
    return { status: 404, body: { success: false, code: "not_found", agentName: null, agentPhone: null, signedAtLocal: null } };
  }
  const base = { success: false as const, agentName: row.agentName, agentPhone: row.agentPhone };
  if (row.status === "signed") {
    return { status: 410, body: { ...base, code: "signed", signedAtLocal: row.signedSnapshot?.signedAtLocal ?? null } };
  }
  if (row.status === "cancelled") return { status: 410, body: { ...base, code: "cancelled", signedAtLocal: null } };
  if (row.expiresAt.getTime() <= Date.now()) {
    return { status: 410, body: { ...base, code: "expired", signedAtLocal: null } };
  }
  return null;
}

/**
 * What the signing page renders. Called by the page's own fetch in the browser, never by the
 * server render, so a link-preview crawler or a mail scanner that runs no JavaScript can't mark
 * the link as opened.
 */
export async function loadAcaConfirmationView(
  token: string,
  evidence: RequestEvidence
): Promise<{ ok: true; view: AcaConfirmationPublicView } | { ok: false; dead: DeadLink }> {
  if (!CONFIRMATION_TOKEN_RE.test(token)) return { ok: false, dead: deadLink(null)! };
  const row = await getConfirmationRowByToken(token);
  const dead = deadLink(row);
  if (dead || !row) return { ok: false, dead: dead ?? deadLink(null)! };

  const now = new Date();
  const nowIso = now.toISOString();
  await db
    .update(acaConfirmations)
    .set({
      firstViewedAt: sql`coalesce(${acaConfirmations.firstViewedAt}, ${nowIso}::timestamp)`,
      lastViewedAt: now,
      viewCount: sql`${acaConfirmations.viewCount} + 1`,
      updatedAt: now,
    })
    .where(and(eq(acaConfirmations.id, row.id), eq(acaConfirmations.status, "pending")));
  if (!row.lastViewedAt || now.getTime() - row.lastViewedAt.getTime() > VIEW_EVENT_THROTTLE_MS) {
    await addEvent(row.id, "viewed", evidence, null);
  }

  const agent = agentOf(row);
  return {
    ok: true,
    view: {
      language: lang(row.language),
      firstName: firstNameOf(row.consumerName),
      consumerName: row.consumerName,
      form: renderConfirmationFormBoth(row.formVersion, {
        consumerName: row.consumerName,
        consumerEmail: row.contactEmail,
        agent,
        reviewedAt: null,
      }),
      allowTypedSignature: getFormDefinition(row.formVersion)?.allowTypedSignature ?? false,
      agent: { name: agent.name, phone: agent.phone, email: agent.email },
      expiresAt: row.expiresAt.toISOString(),
    },
  };
}

export type SignOutcome =
  | { ok: true; result: AcaConfirmationSignResult }
  | { ok: false; dead: DeadLink }
  | { ok: false; invalid: string };

/**
 * Did the signature come from an IP the agent used for this request (the request itself, an email
 * send, a cancel)? CMS enforcement targets agents signing for their clients, so this is recorded
 * and shown — never used to refuse: a client in the same office, or behind the same carrier NAT,
 * is possible. Unknown IPs never match.
 */
async function ipMatchesAgent(row: ConfirmationRow, signerIp: string | null): Promise<boolean> {
  if (!signerIp) return false;
  if (row.requestIp === signerIp) return true;
  const agentEvents = await db
    .select({ ip: acaConfirmationEvents.ip })
    .from(acaConfirmationEvents)
    .where(and(eq(acaConfirmationEvents.confirmationId, row.id), isNotNull(acaConfirmationEvents.actorUserId)));
  return agentEvents.some((e) => e.ip === signerIp);
}

/** Hand the post-signing work to QStash; when QStash is off, run it after the response. */
async function queueFinalize(id: string, requestOrigin: string): Promise<void> {
  const messageId = await publishJob({
    path: "/api/queue/aca-confirmation-finalize",
    body: { confirmationId: id },
    retries: 5,
    requestOrigin,
  });
  if (messageId) return;
  waitUntil(
    finalizeAcaConfirmation(id).catch((error) => {
      console.error(`${LOG} Inline finalize failed for ${id}:`, error);
    })
  );
}

/** The client's signature. `input` is already validated by acaConfirmationSignSchema. */
export async function signAcaConfirmation(params: {
  token: string;
  input: AcaConfirmationSignInput;
  evidence: RequestEvidence;
  requestOrigin: string;
}): Promise<SignOutcome> {
  const { token, input, evidence } = params;
  if (!CONFIRMATION_TOKEN_RE.test(token)) return { ok: false, dead: deadLink(null)! };
  const row = await getConfirmationRowByToken(token);
  const dead = deadLink(row);
  if (dead || !row) return { ok: false, dead: dead ?? deadLink(null)! };

  const definition = getFormDefinition(row.formVersion);
  if (!definition) throw new Error(`Unknown form version on ${row.id}: ${row.formVersion}`);
  if (input.method === "typed" && !definition.allowTypedSignature) return { ok: false, invalid: "typed_not_allowed" };
  const png = decodeSignaturePng(input.png);
  if (!png) return { ok: false, invalid: "signature_image" };

  const agent = agentOf(row);
  const signerIpMatchesAgent = await ipMatchesAgent(row, evidence.ip);
  const signedAt = new Date();
  const signedAtIso = signedAt.toISOString();
  const timeZone = getAgentLocalTimezone();
  const signedAtLocal = formatLocalDateTime(signedAt, input.language, timeZone);
  const snapshot: AcaConfirmationSnapshot = {
    ...renderConfirmationForm(row.formVersion, input.language, {
      consumerName: row.consumerName,
      consumerEmail: row.contactEmail,
      agent,
      reviewedAt: signedAtLocal,
    }),
    signedAtIso,
    signedAtLocal,
    timeZone,
  };
  const strokes = input.method === "drawn" ? (input.strokes ?? []) : null;
  const typedName = input.method === "typed" ? (input.typedName ?? null) : null;
  const evidenceSha256 = computeEvidenceSha256({
    id: row.id,
    formVersion: row.formVersion,
    snapshot,
    consumerName: row.consumerName,
    contactEmail: row.contactEmail,
    agent,
    signatureMethod: input.method,
    signaturePngSha256: png.sha256,
    strokesSha256: strokes ? sha256Hex(stableStringify(strokes)) : null,
    typedName,
    signer: { ...evidence, ipMatchesAgent: signerIpMatchesAgent },
    signedAtIso,
  });

  const [signed] = await db
    .update(acaConfirmations)
    .set({
      status: "signed",
      signedAt,
      signedLanguage: input.language,
      signerIp: evidence.ip,
      signerCity: evidence.city,
      signerRegion: evidence.region,
      signerCountry: evidence.country,
      signerUserAgent: evidence.userAgent,
      signerIpMatchesAgent,
      signatureMethod: input.method,
      signaturePng: input.png,
      signatureStrokes: strokes,
      typedName,
      signedSnapshot: snapshot,
      evidenceSha256,
      updatedAt: signedAt,
    })
    .where(
      and(
        eq(acaConfirmations.id, row.id),
        eq(acaConfirmations.status, "pending"),
        gt(acaConfirmations.expiresAt, signedAt)
      )
    )
    .returning({ id: acaConfirmations.id });

  if (!signed) {
    // Someone (usually the same client, tapping twice) got there first, or it was cancelled or
    // expired in the meantime: answer with what the row says now.
    const latest = await getConfirmationRow(row.id);
    return { ok: false, dead: deadLink(latest) ?? deadLink(null)! };
  }

  await addEvent(row.id, "signed", evidence, null, {
    method: input.method,
    language: input.language,
    evidenceSha256,
  });
  await queueFinalize(row.id, params.requestOrigin);
  return { ok: true, result: { signedAt: signedAtIso, signedAtLocal } };
}
