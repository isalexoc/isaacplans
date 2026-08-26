/**
 * Server-side data layer for IUL intake sessions: DB access, access control, and the
 * CRM payload builder used on completion. Server-only (touches the DB + env secrets).
 */

import "server-only";
import { and, count, desc, eq, isNull, or, ilike, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { iulIntakeSessions } from "@/lib/db/schema";
import {
  INTAKE_SECTIONS,
  BENEFICIARY_SLUGS,
  isFieldVisible,
  type Beneficiary,
} from "./fields";
import { ghlFieldIds } from "./ghl-field-ids";
import type { IntakeData } from "./schema";
import type { IntakeSession, IntakeSummary } from "./types";
import {
  agentCrmGetBaseCredentials,
  agentCrmUpdateContact,
  agentCrmGetContactTags,
  agentCrmEnsureContact,
  agentCrmAddContactTags,
  type AgentCrmCustomFieldValue,
  type AgentCrmNativeFields,
} from "@/lib/agent-crm-contacts";
import { buildIntakeShareUrl, buildSecureCaptureUrl, buildDocumentCaptureUrl } from "./share-url";
import {
  resolveIntakeAccess,
  isIntakeExpired,
  intakeLinkExpiry,
  type IntakeAccess,
  type IntakeCaller,
} from "@/lib/intake-shared/access";

/** Tag added to the contact when the agent sends the link — triggers the GHL workflow. */
export const IUL_INTAKE_LINK_SENT_TAG = "iul_intake_link_sent";

/** Tag that fires the GHL workflow which texts the client their SECURE CAPTURE link. */
export const IUL_SECURE_CAPTURE_SENT_TAG = "iul_secure_capture_sent";

/** Its own trigger tag: a workflow texting the document link must not fire on the SSN link. */
export const IUL_DOCUMENT_CAPTURE_SENT_TAG = "iul_document_capture_sent";

/** Contact tag that marks a Spanish-speaking client → the saved link uses the /es locale. */
export const IUL_SPANISH_TAG = "spanish";

/** Contact tag that marks an English-speaking client (locale segmentation counterpart). */
export const IUL_ENGLISH_TAG = "english";

/** Contact tag applied when a prospect self-starts an application from the public apply page. */
export const IUL_SELF_APPLY_TAG = "iul_self_apply";

export type IntakeSessionRow = typeof iulIntakeSessions.$inferSelect;

export type IntakeStatus = "draft" | "in_progress" | "completed";

export function toIntakeSummary(row: IntakeSessionRow): IntakeSummary {
  return {
    id: row.id,
    token: row.token,
    status: row.status as IntakeStatus,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    crmContactId: row.crmContactId,
    reopenedForClient: row.reopenedForClient ?? false,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/** Serialize a row for an authorized user. `data` should already be decrypted. */
export function toIntakeSession(
  row: IntakeSessionRow,
  role: "owner" | "client",
  data: IntakeData
): IntakeSession {
  return {
    ...toIntakeSummary(row),
    data,
    locale: row.locale ?? "en",
    role,
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

export async function createIntakeSession(input: {
  ownerUserId: string;
  clientUserId?: string | null;
  crmContactId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locale?: string;
  data?: IntakeData;
  clientDeviceId?: string | null;
}): Promise<IntakeSessionRow> {
  const id = nanoid();
  const token = nanoid(24);
  const now = new Date();
  const [row] = await db
    .insert(iulIntakeSessions)
    .values({
      id,
      token,
      ownerUserId: input.ownerUserId,
      clientUserId: input.clientUserId ?? null,
      clientDeviceId: input.clientDeviceId ?? null,
      expiresAt: intakeLinkExpiry(now),
      crmContactId: input.crmContactId ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      data: input.data ?? {},
      locale: input.locale ?? "en",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/**
 * Public "Apply now" entry point: resume the prospect's existing application, claim an
 * unclaimed one the agent already created for their email, or create a fresh one. The agent
 * (IUL_DEFAULT_OWNER_USER_ID) is always the owner so it lands in their dashboard.
 *
 * No account required — the caller is identified by their device cookie. `clientUserId` is still
 * honored so sessions created under the old Clerk-gated flow keep working.
 */
export async function selfStartIntakeForClient(input: {
  clientDeviceId: string;
  clientUserId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  locale?: string;
}): Promise<IntakeSessionRow> {
  const ownerUserId = process.env.IUL_DEFAULT_OWNER_USER_ID;
  if (!ownerUserId) {
    throw new Error("IUL_DEFAULT_OWNER_USER_ID is not configured.");
  }

  // 1a. Resume an application already bound to this Clerk user (legacy sessions).
  if (input.clientUserId) {
    const [bound] = await db
      .select()
      .from(iulIntakeSessions)
      .where(eq(iulIntakeSessions.clientUserId, input.clientUserId))
      .orderBy(desc(iulIntakeSessions.updatedAt))
      .limit(1);
    if (bound && !isIntakeExpired(bound)) return bound;
  }

  // 1b. Resume the application this browser already started.
  const byDevice = await findIulSessionByDevice(input.clientDeviceId);
  if (byDevice && !isIntakeExpired(byDevice)) return byDevice;

  const email = (input.email ?? "").trim().toLowerCase();

  // 2. Claim an unclaimed session the agent already created for this email (avoids a duplicate).
  if (email) {
    const [unclaimed] = await db
      .select()
      .from(iulIntakeSessions)
      .where(
        and(
          eq(iulIntakeSessions.ownerUserId, ownerUserId),
          isNull(iulIntakeSessions.clientUserId),
          ilike(iulIntakeSessions.contactEmail, email)
        )
      )
      .orderBy(desc(iulIntakeSessions.updatedAt))
      .limit(1);
    if (unclaimed) {
      await bindClientDevice(unclaimed.token, input.clientDeviceId);
      return { ...unclaimed, clientDeviceId: input.clientDeviceId };
    }
  }

  // 3. Create a new application — match-or-create the CRM contact and tag it.
  const locale = input.locale === "es" ? "es" : "en";
  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const phone = (input.phone ?? "").replace(/[^\d+]/g, "");
  const contactName = [firstName, lastName].filter(Boolean).join(" ") || null;

  let crmContactId: string | null = null;
  const creds = agentCrmGetBaseCredentials();
  // Without an account there is nothing to identify an anonymous starter by, and creating a
  // contact from nothing would litter the CRM with blank records on every "Apply" tap. The contact
  // is created lazily instead, on the first autosave carrying an email or phone — see
  // ensureIulCrmContactForSession.
  if (creds && (email || phone)) {
    // Best-effort — a CRM hiccup must never block the prospect from starting.
    try {
      crmContactId = await agentCrmEnsureContact(
        {
          email: email || undefined,
          phone: phone || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
        creds.locationId,
        creds.token,
        "[IUL_SELF_APPLY]"
      );
      if (crmContactId) {
        const tags = [IUL_SELF_APPLY_TAG, locale === "es" ? IUL_SPANISH_TAG : IUL_ENGLISH_TAG];
        await agentCrmAddContactTags(crmContactId, tags, creds.token, "[IUL_SELF_APPLY]");
      }
    } catch (e) {
      console.warn("[iul-intake] self-apply CRM ensure failed:", e);
    }
  } else if (!creds) {
    console.warn("[iul-intake] Agent CRM credentials missing; self-apply session is unlinked.");
  }

  const prefill: IntakeData = {};
  if (firstName) prefill.firstName = firstName;
  if (lastName) prefill.lastName = lastName;
  if (email) prefill.email = email;
  if (phone) prefill.phone = phone;

  const row = await createIntakeSession({
    ownerUserId,
    clientUserId: input.clientUserId ?? null,
    clientDeviceId: input.clientDeviceId,
    crmContactId,
    contactName,
    contactEmail: email || null,
    contactPhone: phone || null,
    locale,
    data: prefill,
  });

  // Seed the CRM share link (best-effort — never blocks the redirect).
  await syncIntakeLinkToCrm(row, locale);

  return row;
}

export async function getIntakeByToken(token: string): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(iulIntakeSessions)
    .where(eq(iulIntakeSessions.token, token))
    .limit(1);
  return row ?? null;
}

/** Filters shared by the paginated list and the matching count query. */
function ownerListConditions(
  ownerUserId: string,
  opts: { search?: string; status?: IntakeStatus }
): SQL[] {
  const conditions: SQL[] = [eq(iulIntakeSessions.ownerUserId, ownerUserId)];
  if (opts.status) conditions.push(eq(iulIntakeSessions.status, opts.status));
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    const searchClause = or(
      ilike(iulIntakeSessions.contactName, q),
      ilike(iulIntakeSessions.contactEmail, q),
      ilike(iulIntakeSessions.contactPhone, q)
    );
    if (searchClause) conditions.push(searchClause);
  }
  return conditions;
}

export const INTAKE_PAGE_SIZE = 20;

export async function listIntakeSessionsForOwner(
  ownerUserId: string,
  opts: { search?: string; status?: IntakeStatus; page?: number; limit?: number } = {}
): Promise<IntakeSessionRow[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? INTAKE_PAGE_SIZE, 100));
  const page = Math.max(1, opts.page ?? 1);
  const conditions = ownerListConditions(ownerUserId, opts);
  return db
    .select()
    .from(iulIntakeSessions)
    .where(and(...conditions))
    .orderBy(desc(iulIntakeSessions.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

/** Total rows matching the same filters — used to compute total pages. */
export async function countIntakeSessionsForOwner(
  ownerUserId: string,
  opts: { search?: string; status?: IntakeStatus } = {}
): Promise<number> {
  const conditions = ownerListConditions(ownerUserId, opts);
  const [row] = await db
    .select({ value: count() })
    .from(iulIntakeSessions)
    .where(and(...conditions));
  return row?.value ?? 0;
}

/** Permanently delete an intake session. Owner-scoped: only the creating agent can delete. */
export async function deleteIntakeSession(token: string, ownerUserId: string): Promise<boolean> {
  const deleted = await db
    .delete(iulIntakeSessions)
    .where(and(eq(iulIntakeSessions.token, token), eq(iulIntakeSessions.ownerUserId, ownerUserId)))
    .returning({ id: iulIntakeSessions.id });
  return deleted.length > 0;
}

export async function updateIntakeData(
  token: string,
  data: IntakeData,
  status: IntakeStatus
): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .update(iulIntakeSessions)
    .set({ data, status, updatedAt: new Date() })
    .where(eq(iulIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/**
 * Reset a share link: rotate the token (old link dies immediately) and clear the bound
 * client so the next person to open the new link claims it. Admin-only at the route layer.
 */
export async function resetIntakeLink(token: string): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .update(iulIntakeSessions)
    // Clearing the device binding is also the recovery path when a client loses the browser they
    // started on: a fresh link, claimable by whichever device opens it next.
    .set({
      token: nanoid(24),
      clientUserId: null,
      clientDeviceId: null,
      expiresAt: intakeLinkExpiry(),
      updatedAt: new Date(),
    })
    .where(eq(iulIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

export async function bindClientUser(
  token: string,
  clientUserId: string
): Promise<void> {
  await db
    .update(iulIntakeSessions)
    .set({ clientUserId, updatedAt: new Date() })
    .where(eq(iulIntakeSessions.token, token));
}

export async function markIntakeCompleted(
  token: string,
  data: IntakeData
): Promise<IntakeSessionRow | null> {
  const now = new Date();
  const [row] = await db
    .update(iulIntakeSessions)
    // Re-lock the client on every submission; admin re-opens explicitly if needed.
    .set({ data, status: "completed", reopenedForClient: false, completedAt: now, updatedAt: now })
    .where(eq(iulIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/** Admin grants (or revokes) the client's ability to edit an already-submitted form. */
export async function setClientReopened(
  token: string,
  allow: boolean
): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .update(iulIntakeSessions)
    .set({ reopenedForClient: allow, updatedAt: new Date() })
    .where(eq(iulIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/** A client may edit while not yet completed, or after an admin re-opens the form. */
export function clientCanEdit(row: IntakeSessionRow): boolean {
  return row.status !== "completed" || row.reopenedForClient === true;
}

/**
 * Write the session's current share link to the CRM `iul_intake_link` custom field so a GHL
 * workflow can text/email it. The link locale follows the contact's Spanish tag (tag present
 * → /es, else /en) so the client gets the right language; pass `localeOverride` to skip the
 * tag lookup (used at create time, when we already know the chosen language). Never throws.
 */
export async function syncIntakeLinkToCrm(
  row: IntakeSessionRow,
  localeOverride?: "en" | "es"
): Promise<boolean> {
  if (!row.crmContactId) return false;
  const fieldId = ghlFieldIds.iul_intake_link;
  if (!fieldId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  try {
    let locale: "en" | "es";
    if (localeOverride) {
      locale = localeOverride;
    } else {
      const tags = await agentCrmGetContactTags(row.crmContactId, creds.token);
      if (tags === null) {
        // Couldn't read tags — fall back to the session's stored locale.
        locale = row.locale === "es" ? "es" : "en";
      } else {
        locale = tags.some((t) => t.trim().toLowerCase() === IUL_SPANISH_TAG) ? "es" : "en";
      }
    }
    const url = buildIntakeShareUrl(row.token, locale);
    return await agentCrmUpdateContact(
      row.crmContactId,
      { customFields: [{ id: fieldId, field_value: url }] },
      creds.token,
      "[IUL_INTAKE]"
    );
  } catch (e) {
    console.warn("[iul-intake] Link sync failed:", e);
    return false;
  }
}

/**
 * Same idea as `syncIntakeLinkToCrm`, for the secure capture link.
 *
 * A separate CRM field and a separate tag on purpose: the two links go to the same person but
 * mean very different things, and a workflow that texts "finish your application" must not fire
 * when the agent asked for a Social Security number.
 */
export async function syncSecureCaptureLinkToCrm(
  row: IntakeSessionRow,
  captureToken: string
): Promise<boolean> {
  if (!row.crmContactId) return false;
  const fieldId = ghlFieldIds.iul_secure_capture_link;
  if (!fieldId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  try {
    const tags = await agentCrmGetContactTags(row.crmContactId, creds.token);
    const locale =
      tags === null
        ? row.locale === "es"
          ? "es"
          : "en"
        : tags.some((t) => t.trim().toLowerCase() === IUL_SPANISH_TAG)
          ? "es"
          : "en";
    const url = buildSecureCaptureUrl(captureToken, locale);
    return await agentCrmUpdateContact(
      row.crmContactId,
      { customFields: [{ id: fieldId, field_value: url }] },
      creds.token,
      "[IUL_INTAKE]"
    );
  } catch (e) {
    console.warn("[iul-intake] Secure capture link sync failed:", e);
    return false;
  }
}

/**
 * Write the live document-upload link to the contact, in the client's own language.
 *
 * Same shape as the secure-capture sync above and for the same reason: there is no direct SMS API
 * in this codebase, so the link goes onto a custom field and a GHL workflow does the sending.
 * Language comes from the contact's tags rather than the session row, because the session is
 * usually created before anyone knows which language the client prefers.
 *
 * Returns false rather than throwing when the CRM field has not been provisioned yet, which is
 * what lets "send by text" report a clear error instead of silently writing nowhere.
 */
export async function syncDocumentCaptureLinkToCrm(
  row: IntakeSessionRow,
  captureToken: string
): Promise<boolean> {
  if (!row.crmContactId) return false;
  const fieldId = ghlFieldIds.iul_document_capture_link;
  if (!fieldId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  try {
    const tags = await agentCrmGetContactTags(row.crmContactId, creds.token);
    const locale =
      tags === null
        ? row.locale === "es"
          ? "es"
          : "en"
        : tags.some((t) => t.trim().toLowerCase() === IUL_SPANISH_TAG)
          ? "es"
          : "en";
    const url = buildDocumentCaptureUrl(captureToken, locale);
    return await agentCrmUpdateContact(
      row.crmContactId,
      { customFields: [{ id: fieldId, field_value: url }] },
      creds.token,
      "[IUL_INTAKE]"
    );
  } catch (e) {
    console.warn("[iul-intake] Document capture link sync failed:", e);
    return false;
  }
}

/**
 * Access rule for a token-scoped session — see lib/intake-shared/access.ts. The agent always gets
 * in; otherwise the unguessable token plus either the device cookie that claimed the session or the
 * Clerk id it was bound to under the old sign-in flow.
 */
export function canAccessIntake(row: IntakeSessionRow, caller: IntakeCaller): IntakeAccess {
  return resolveIntakeAccess(row, caller);
}

/** Bind an unclaimed session to the browser that just opened it. */
export async function bindClientDevice(token: string, deviceId: string): Promise<void> {
  await db
    .update(iulIntakeSessions)
    .set({ clientDeviceId: deviceId, updatedAt: new Date() })
    .where(eq(iulIntakeSessions.token, token));
}

/** Find a session already claimed by this browser, so "Apply" resumes instead of duplicating. */
export async function findIulSessionByDevice(deviceId: string): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(iulIntakeSessions)
    .where(eq(iulIntakeSessions.clientDeviceId, deviceId))
    .orderBy(desc(iulIntakeSessions.updatedAt))
    .limit(1);
  return row ?? null;
}

export { isIntakeExpired as isIulIntakeExpired };

function formatBeneficiary(b: Beneficiary): string {
  const parts: string[] = [];
  const name = [str(b.firstName), str(b.lastName)].filter(Boolean).join(" ");
  if (name) parts.push(name);
  if (str(b.relationship)) parts.push(str(b.relationship));
  if (str(b.percent)) parts.push(`${str(b.percent)}%`);
  if (str(b.dateOfBirth)) parts.push(`DOB ${str(b.dateOfBirth)}`);
  if (str(b.ssn)) parts.push(`SSN ${str(b.ssn)}`);
  return parts.join(", ");
}

/**
 * Build the CRM update payload from DECRYPTED intake data.
 * Native fields go on the contact body; custom fields resolve slug→id (unprovisioned ids
 * are skipped). Beneficiaries serialize into the beneficiary_1..4 text fields.
 */
export function buildCrmPayloadFromData(data: IntakeData): {
  native: AgentCrmNativeFields;
  customFields: AgentCrmCustomFieldValue[];
  skippedSlugs: string[];
} {
  const native: AgentCrmNativeFields = {};
  const customFields: AgentCrmCustomFieldValue[] = [];
  const skippedSlugs: string[] = [];

  for (const section of INTAKE_SECTIONS) {
    for (const field of section.fields) {
      if (!field.crm) continue;
      if (!isFieldVisible(field, data)) continue;
      if (field.type === "beneficiaries" || field.type === "file") continue;

      const value = str(data[field.key]);
      if (!value) continue;

      if (field.crm.kind === "native") {
        native[field.crm.field] = value;
      } else {
        const id = ghlFieldIds[field.crm.slug];
        if (!id) {
          skippedSlugs.push(field.crm.slug);
          continue;
        }
        // Selects must send the CRM picklist label (e.g. "No"), not the internal value ("no").
        let outValue = value;
        if (field.type === "select" && field.options) {
          const opt = field.options.find((o) => o.value === value);
          if (opt) outValue = opt.labelEn;
        }
        customFields.push({ id, field_value: outValue });
      }
    }
  }

  // Beneficiaries → beneficiary_1..4
  const benies = Array.isArray(data.beneficiaries) ? data.beneficiaries : [];
  BENEFICIARY_SLUGS.forEach((slug, i) => {
    const b = benies[i];
    if (!b) return;
    const formatted = formatBeneficiary(b);
    if (!formatted) return;
    const id = ghlFieldIds[slug];
    if (id) customFields.push({ id, field_value: formatted });
    else skippedSlugs.push(slug);
  });

  return { native, customFields, skippedSlugs };
}

/**
 * Push the current (decrypted) intake data to the linked CRM contact. Best-effort:
 * returns false and logs on any miss (missing creds/contact, API error) without throwing,
 * so it can run on every autosave without breaking the save.
 */
/**
 * Attach a CRM contact to a session that started anonymously, as soon as the client has typed
 * enough to identify them. Matching on email/phone means a prospect who already came through a CTA
 * or ads funnel lands on their existing contact rather than a duplicate.
 * Returns the contact id, or null while there's still nothing to match on.
 */
export async function ensureIulCrmContactForSession(
  row: IntakeSessionRow,
  decrypted: IntakeData
): Promise<string | null> {
  if (row.crmContactId) return row.crmContactId;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const email = str(decrypted.email).toLowerCase();
  const phone = str(decrypted.phone).replace(/[^\d+]/g, "");
  if (!email && !phone) return null;

  const creds = agentCrmGetBaseCredentials();
  if (!creds) return null;

  const firstName = str(decrypted.firstName);
  const lastName = str(decrypted.lastName);
  try {
    const contactId = await agentCrmEnsureContact(
      {
        email: email || undefined,
        phone: phone || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      },
      creds.locationId,
      creds.token,
      "[IUL_INTAKE]"
    );
    if (!contactId) return null;

    const locale = row.locale === "es" ? "es" : "en";
    await agentCrmAddContactTags(
      contactId,
      [IUL_SELF_APPLY_TAG, locale === "es" ? IUL_SPANISH_TAG : IUL_ENGLISH_TAG],
      creds.token,
      "[IUL_INTAKE]"
    );

    await db
      .update(iulIntakeSessions)
      .set({
        crmContactId: contactId,
        contactName: [firstName, lastName].filter(Boolean).join(" ") || row.contactName,
        contactEmail: email || row.contactEmail,
        contactPhone: phone || row.contactPhone,
        updatedAt: new Date(),
      })
      .where(eq(iulIntakeSessions.token, row.token));

    row.crmContactId = contactId;
    // The share-link field is only writable once a contact exists.
    await syncIntakeLinkToCrm(row, locale);
    return contactId;
  } catch (e) {
    console.warn("[iul-intake] lazy CRM contact creation failed:", e);
    return null;
  }
}

export async function syncIntakeToCrm(
  row: IntakeSessionRow,
  decrypted: IntakeData
): Promise<boolean> {
  const contactId = await ensureIulCrmContactForSession(row, decrypted);
  if (!contactId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  try {
    const { native, customFields, skippedSlugs } = buildCrmPayloadFromData(decrypted);
    if (skippedSlugs.length > 0) {
      console.warn(
        "[iul-intake] Custom fields not provisioned (run pnpm iul:fields):",
        skippedSlugs.join(", ")
      );
    }
    if (Object.keys(native).length === 0 && customFields.length === 0) return false;
    return await agentCrmUpdateContact(contactId, { native, customFields }, creds.token, "[IUL_INTAKE]");
  } catch (e) {
    console.warn("[iul-intake] CRM sync failed:", e);
    return false;
  }
}
