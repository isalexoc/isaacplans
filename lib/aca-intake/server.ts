/**
 * Server-side data layer for ACA intake sessions: DB access, access control, and the
 * CRM payload builder used on completion. Server-only (touches the DB + env secrets).
 *
 * Mirrors lib/iul-intake/server.ts. The notable difference is `buildCrmPayloadFromData`,
 * which flattens the `householdMembers` repeater into the aca_member_1..8 text slots
 * (the GHL contact has no concept of a nested household).
 */

import "server-only";
import { and, count, desc, eq, isNull, or, ilike, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { acaIntakeSessions } from "@/lib/db/schema";
import {
  ACA_SECTIONS,
  MEMBER_SLUGS,
  isFieldVisible,
  isRowFilled,
  fieldByKey,
  type RepeaterRow,
} from "./fields";
import { acaFieldIds } from "./ghl-field-ids";
import type { AcaIntakeData } from "./schema";
import type { AcaIntakeSession, AcaIntakeSummary } from "./types";
import {
  agentCrmGetBaseCredentials,
  agentCrmUpdateContact,
  agentCrmGetContactTags,
  agentCrmEnsureContact,
  agentCrmAddContactTags,
  type AgentCrmCustomFieldValue,
  type AgentCrmNativeFields,
} from "@/lib/agent-crm-contacts";
import { buildAcaIntakeShareUrl } from "./share-url";
import {
  resolveIntakeAccess,
  isIntakeExpired,
  intakeLinkExpiry,
  type IntakeAccess,
  type IntakeCaller,
} from "@/lib/intake-shared/access";

/** Tag added to the contact when the agent sends the link — triggers the GHL workflow. */
export const ACA_INTAKE_LINK_SENT_TAG = "aca_intake_link_sent";

/** Tag applied when a client submits a completed intake. */
export const ACA_INTAKE_COMPLETED_TAG = "aca_intake_completed";

/** Contact tag that marks a Spanish-speaking client → the saved link uses the /es locale. */
export const ACA_SPANISH_TAG = "spanish";

/** Contact tag that marks an English-speaking client (locale segmentation counterpart). */
export const ACA_ENGLISH_TAG = "english";

/** Contact tag applied when a prospect self-starts an application from the public apply page. */
export const ACA_SELF_APPLY_TAG = "aca_self_apply";

export type AcaIntakeSessionRow = typeof acaIntakeSessions.$inferSelect;

export type AcaIntakeStatus = "draft" | "in_progress" | "completed";

export function toAcaIntakeSummary(row: AcaIntakeSessionRow): AcaIntakeSummary {
  return {
    id: row.id,
    token: row.token,
    status: row.status as AcaIntakeStatus,
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
export function toAcaIntakeSession(
  row: AcaIntakeSessionRow,
  role: "owner" | "client",
  data: AcaIntakeData
): AcaIntakeSession {
  return {
    ...toAcaIntakeSummary(row),
    data,
    locale: row.locale ?? "en",
    role,
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

export async function createAcaIntakeSession(input: {
  ownerUserId: string;
  clientUserId?: string | null;
  clientDeviceId?: string | null;
  crmContactId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locale?: string;
  data?: AcaIntakeData;
}): Promise<AcaIntakeSessionRow> {
  const id = nanoid();
  const token = nanoid(24);
  const now = new Date();
  const [row] = await db
    .insert(acaIntakeSessions)
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
 * (ACA_DEFAULT_OWNER_USER_ID) is always the owner so it lands in their dashboard.
 *
 * No account required — the caller is identified by their device cookie. `clientUserId` is still
 * honored so sessions created under the old Clerk-gated flow keep working.
 */
export async function selfStartAcaIntakeForClient(input: {
  clientDeviceId: string;
  clientUserId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  locale?: string;
}): Promise<AcaIntakeSessionRow> {
  const ownerUserId = process.env.ACA_DEFAULT_OWNER_USER_ID;
  if (!ownerUserId) {
    throw new Error("ACA_DEFAULT_OWNER_USER_ID is not configured.");
  }

  // 1a. Resume an application already bound to this Clerk user (legacy sessions).
  if (input.clientUserId) {
    const [bound] = await db
      .select()
      .from(acaIntakeSessions)
      .where(eq(acaIntakeSessions.clientUserId, input.clientUserId))
      .orderBy(desc(acaIntakeSessions.updatedAt))
      .limit(1);
    if (bound && !isIntakeExpired(bound)) return bound;
  }

  // 1b. Resume the application this browser already started.
  const byDevice = await findAcaSessionByDevice(input.clientDeviceId);
  if (byDevice && !isIntakeExpired(byDevice)) return byDevice;

  const email = (input.email ?? "").trim().toLowerCase();

  // 2. Claim an unclaimed session the agent already created for this email (avoids a duplicate).
  if (email) {
    const unclaimed = await findUnclaimedAcaSessionByEmail(ownerUserId, email);
    if (unclaimed) {
      await bindAcaClientDevice(unclaimed.token, input.clientDeviceId);
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
  // is created lazily instead, on the first autosave that carries an email or phone — see
  // ensureAcaCrmContactForSession.
  if (creds && (email || phone)) {
    // Best-effort — a CRM hiccup must never block the prospect from starting.
    try {
      crmContactId = await agentCrmEnsureContact(
        {
          email: email || undefined,
          phone: phone || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          // Without this the shared helper stamps new contacts "iul_intake".
          source: "aca_intake",
        },
        creds.locationId,
        creds.token,
        "[ACA_SELF_APPLY]"
      );
      if (crmContactId) {
        const tags = [ACA_SELF_APPLY_TAG, locale === "es" ? ACA_SPANISH_TAG : ACA_ENGLISH_TAG];
        await agentCrmAddContactTags(crmContactId, tags, creds.token, "[ACA_SELF_APPLY]");
      }
    } catch (e) {
      console.warn("[aca-intake] self-apply CRM ensure failed:", e);
    }
  } else if (!creds) {
    console.warn("[aca-intake] Agent CRM credentials missing; self-apply session is unlinked.");
  }

  const prefill: AcaIntakeData = {};
  if (firstName) prefill.firstName = firstName;
  if (lastName) prefill.lastName = lastName;
  if (email) prefill.email = email;
  if (phone) prefill.phone = phone;

  const row = await createAcaIntakeSession({
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
  await syncAcaIntakeLinkToCrm(row, locale);

  return row;
}

export async function getAcaIntakeByToken(token: string): Promise<AcaIntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(acaIntakeSessions)
    .where(eq(acaIntakeSessions.token, token))
    .limit(1);
  return row ?? null;
}

/** Filters shared by the paginated list and the matching count query. */
function ownerListConditions(
  ownerUserId: string,
  opts: { search?: string; status?: AcaIntakeStatus }
): SQL[] {
  const conditions: SQL[] = [eq(acaIntakeSessions.ownerUserId, ownerUserId)];
  if (opts.status) conditions.push(eq(acaIntakeSessions.status, opts.status));
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    const searchClause = or(
      ilike(acaIntakeSessions.contactName, q),
      ilike(acaIntakeSessions.contactEmail, q),
      ilike(acaIntakeSessions.contactPhone, q)
    );
    if (searchClause) conditions.push(searchClause);
  }
  return conditions;
}

export const ACA_INTAKE_PAGE_SIZE = 20;

export async function listAcaIntakeSessionsForOwner(
  ownerUserId: string,
  opts: { search?: string; status?: AcaIntakeStatus; page?: number; limit?: number } = {}
): Promise<AcaIntakeSessionRow[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? ACA_INTAKE_PAGE_SIZE, 100));
  const page = Math.max(1, opts.page ?? 1);
  const conditions = ownerListConditions(ownerUserId, opts);
  return db
    .select()
    .from(acaIntakeSessions)
    .where(and(...conditions))
    .orderBy(desc(acaIntakeSessions.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

/** Total rows matching the same filters — used to compute total pages. */
export async function countAcaIntakeSessionsForOwner(
  ownerUserId: string,
  opts: { search?: string; status?: AcaIntakeStatus } = {}
): Promise<number> {
  const conditions = ownerListConditions(ownerUserId, opts);
  const [row] = await db
    .select({ value: count() })
    .from(acaIntakeSessions)
    .where(and(...conditions));
  return row?.value ?? 0;
}

/** Permanently delete an intake session. Owner-scoped: only the creating agent can delete. */
export async function deleteAcaIntakeSession(token: string, ownerUserId: string): Promise<boolean> {
  const deleted = await db
    .delete(acaIntakeSessions)
    .where(and(eq(acaIntakeSessions.token, token), eq(acaIntakeSessions.ownerUserId, ownerUserId)))
    .returning({ id: acaIntakeSessions.id });
  return deleted.length > 0;
}

export async function updateAcaIntakeData(
  token: string,
  data: AcaIntakeData,
  status: AcaIntakeStatus
): Promise<AcaIntakeSessionRow | null> {
  const [row] = await db
    .update(acaIntakeSessions)
    .set({ data, status, updatedAt: new Date() })
    .where(eq(acaIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/**
 * Reset a share link: rotate the token (old link dies immediately) and clear the bound
 * client so the next person to open the new link claims it. Admin-only at the route layer.
 */
export async function resetAcaIntakeLink(token: string): Promise<AcaIntakeSessionRow | null> {
  const now = new Date();
  const [row] = await db
    .update(acaIntakeSessions)
    // Clearing the device binding is also the recovery path when a client loses the browser they
    // started on: a fresh link, claimable by whichever device opens it next.
    .set({
      token: nanoid(24),
      clientUserId: null,
      clientDeviceId: null,
      expiresAt: intakeLinkExpiry(now),
      updatedAt: now,
    })
    .where(eq(acaIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

export async function bindAcaClientUser(token: string, clientUserId: string): Promise<void> {
  await db
    .update(acaIntakeSessions)
    .set({ clientUserId, updatedAt: new Date() })
    .where(eq(acaIntakeSessions.token, token));
}

export async function markAcaIntakeCompleted(
  token: string,
  data: AcaIntakeData
): Promise<AcaIntakeSessionRow | null> {
  const now = new Date();
  const [row] = await db
    .update(acaIntakeSessions)
    // Re-lock the client on every submission; admin re-opens explicitly if needed.
    .set({ data, status: "completed", reopenedForClient: false, completedAt: now, updatedAt: now })
    .where(eq(acaIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/** Admin grants (or revokes) the client's ability to edit an already-submitted form. */
export async function setAcaClientReopened(
  token: string,
  allow: boolean
): Promise<AcaIntakeSessionRow | null> {
  const [row] = await db
    .update(acaIntakeSessions)
    .set({ reopenedForClient: allow, updatedAt: new Date() })
    .where(eq(acaIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/** A client may edit while not yet completed, or after an admin re-opens the form. */
export function acaClientCanEdit(row: AcaIntakeSessionRow): boolean {
  return row.status !== "completed" || row.reopenedForClient === true;
}

/**
 * Write the session's current share link to the CRM `aca_intake_link` custom field so a GHL
 * workflow can text/email it. The link locale follows the contact's Spanish tag (tag present
 * → /es, else /en); pass `localeOverride` to skip the tag lookup (used at create time, when
 * we already know the chosen language). Never throws.
 */
export async function syncAcaIntakeLinkToCrm(
  row: AcaIntakeSessionRow,
  localeOverride?: "en" | "es"
): Promise<boolean> {
  if (!row.crmContactId) return false;
  const fieldId = acaFieldIds.aca_intake_link;
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
        locale = tags.some((t) => t.trim().toLowerCase() === ACA_SPANISH_TAG) ? "es" : "en";
      }
    }
    const url = buildAcaIntakeShareUrl(row.token, locale);
    return await agentCrmUpdateContact(
      row.crmContactId,
      { customFields: [{ id: fieldId, field_value: url }] },
      creds.token,
      "[ACA_INTAKE]"
    );
  } catch (e) {
    console.warn("[aca-intake] Link sync failed:", e);
    return false;
  }
}

/**
 * Access rule for a token-scoped session — see lib/intake-shared/access.ts. The agent always
 * gets in; otherwise the unguessable token plus either the device cookie that claimed the session
 * or the Clerk id it was bound to under the old sign-in flow.
 */
export function canAccessAcaIntake(
  row: AcaIntakeSessionRow,
  caller: IntakeCaller
): IntakeAccess {
  return resolveIntakeAccess(row, caller);
}

/** Bind an unclaimed session to the browser that just opened it. */
export async function bindAcaClientDevice(token: string, deviceId: string): Promise<void> {
  await db
    .update(acaIntakeSessions)
    .set({ clientDeviceId: deviceId, updatedAt: new Date() })
    .where(eq(acaIntakeSessions.token, token));
}

/** Find a session already claimed by this browser, so "Apply" resumes instead of duplicating. */
export async function findAcaSessionByDevice(deviceId: string): Promise<AcaIntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(acaIntakeSessions)
    .where(eq(acaIntakeSessions.clientDeviceId, deviceId))
    .orderBy(desc(acaIntakeSessions.updatedAt))
    .limit(1);
  return row ?? null;
}

export { isIntakeExpired as isAcaIntakeExpired };

/** "Maria Gonzalez" for a member row, or "" when the row has no name yet. */
export function memberDisplayName(row: RepeaterRow): string {
  return [str(row.firstName), str(row.lastName)].filter(Boolean).join(" ");
}

/** Flatten one household member into the single line stored in an aca_member_N field. */
function formatMember(row: RepeaterRow, index: number): string {
  const parts: string[] = [];
  const name = memberDisplayName(row);
  if (name) parts.push(name);
  if (str(row.relationship)) parts.push(str(row.relationship));
  if (str(row.dateOfBirth)) parts.push(`DOB ${str(row.dateOfBirth)}`);
  if (str(row.sex)) parts.push(str(row.sex));
  if (str(row.ssn)) parts.push(`SSN ${str(row.ssn)}`);
  else if (str(row.noSsnReason)) parts.push(`No SSN (${str(row.noSsnReason)})`);

  if (str(row.isUsCitizen) === "yes") {
    parts.push(str(row.isNaturalizedCitizen) === "yes" ? "Naturalized citizen" : "US citizen");
  } else if (str(row.isUsCitizen) === "no") {
    parts.push("Non-citizen (legal presence docs uploaded)");
  }

  return parts.length ? `${index + 1}. ${parts.join(", ")}` : "";
}

/** Flatten a doctors / prescriptions repeater into one CRM text value. */
function formatSimpleRows(rows: RepeaterRow[], keys: string[]): string {
  return rows
    .map((row) => keys.map((k) => str(row[k])).filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("\n");
}

/**
 * Build the CRM update payload from DECRYPTED intake data.
 * Native fields go on the contact body; custom fields resolve slug→id (unprovisioned ids
 * are skipped). Household members serialize into aca_member_1..8; doctors and prescriptions
 * collapse into single text fields.
 */
export function buildCrmPayloadFromData(data: AcaIntakeData): {
  native: AgentCrmNativeFields;
  customFields: AgentCrmCustomFieldValue[];
  skippedSlugs: string[];
} {
  const native: AgentCrmNativeFields = {};
  const customFields: AgentCrmCustomFieldValue[] = [];
  const skippedSlugs: string[] = [];

  const pushCustom = (slug: string, value: string) => {
    const id = acaFieldIds[slug as keyof typeof acaFieldIds];
    if (!id) {
      skippedSlugs.push(slug);
      return;
    }
    customFields.push({ id, field_value: value });
  };

  for (const section of ACA_SECTIONS) {
    for (const field of section.fields) {
      if (!field.crm) continue;
      if (!isFieldVisible(field, data)) continue;
      // Repeaters and file uploads are handled separately below / by the files route.
      if (field.type === "repeater" || field.type === "file") continue;

      const value = str(data[field.key]);
      if (!value) continue;

      if (field.crm.kind === "native") {
        native[field.crm.field] = value;
      } else {
        // Selects must send the CRM picklist label (e.g. "No"), not the internal value ("no").
        let outValue = value;
        if (field.type === "select" && field.options) {
          const opt = field.options.find((o) => o.value === value);
          if (opt) outValue = opt.labelEn;
        }
        pushCustom(field.crm.slug, outValue);
      }
    }
  }

  // GHL's contact record has no native slot for a second surname or an apartment line, and
  // both belong with the value they extend — a Marketplace name match needs both surnames,
  // and mail needs the unit number. Compose them into the native fields rather than dropping
  // them; they stay separate in our own record. Idempotent because the composition always
  // rebuilds from our stored fields, never from what is already on the contact.
  const secondLastName = str(data.secondLastName);
  if (secondLastName) {
    native.lastName = native.lastName ? `${native.lastName} ${secondLastName}` : secondLastName;
  }
  const address2 = str(data.address2);
  if (address2 && native.address1) {
    native.address1 = `${native.address1}, ${address2}`;
  }

  // Household members → aca_member_1..8
  const memberField = fieldByKey("householdMembers");
  const members: RepeaterRow[] = Array.isArray(data.householdMembers)
    ? (data.householdMembers as RepeaterRow[])
    : [];
  const filledMembers = memberField
    ? members.filter((m) => isRowFilled(memberField, m ?? {}))
    : members;
  MEMBER_SLUGS.forEach((slug, i) => {
    const member = filledMembers[i];
    if (!member) return;
    const formatted = formatMember(member, i);
    if (formatted) pushCustom(slug, formatted);
  });

  // Doctors + prescriptions → one text field each
  const doctors: RepeaterRow[] = Array.isArray(data.doctorsToKeep)
    ? (data.doctorsToKeep as RepeaterRow[])
    : [];
  const doctorsText = formatSimpleRows(doctors, ["name", "specialty", "facility", "city"]);
  if (doctorsText) pushCustom("doctors_list", doctorsText);

  const rx: RepeaterRow[] = Array.isArray(data.prescriptions)
    ? (data.prescriptions as RepeaterRow[])
    : [];
  const rxText = formatSimpleRows(rx, ["drugName", "dosage", "frequency"]);
  if (rxText) pushCustom("prescriptions_list", rxText);

  return { native, customFields, skippedSlugs };
}

/**
 * Attach a CRM contact to a session that started anonymously, as soon as the client has typed
 * enough to identify them. Matching on email/phone means a prospect who already came through a
 * CTA or ads funnel lands on their existing contact rather than a duplicate.
 * Returns the contact id, or null while there's still nothing to match on.
 */
export async function ensureAcaCrmContactForSession(
  row: AcaIntakeSessionRow,
  decrypted: AcaIntakeData
): Promise<string | null> {
  if (row.crmContactId) return row.crmContactId;

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
        source: "aca_intake",
      },
      creds.locationId,
      creds.token,
      "[ACA_INTAKE]"
    );
    if (!contactId) return null;

    const locale = row.locale === "es" ? "es" : "en";
    await agentCrmAddContactTags(
      contactId,
      [ACA_SELF_APPLY_TAG, locale === "es" ? ACA_SPANISH_TAG : ACA_ENGLISH_TAG],
      creds.token,
      "[ACA_INTAKE]"
    );

    await db
      .update(acaIntakeSessions)
      .set({
        crmContactId: contactId,
        contactName: [firstName, lastName].filter(Boolean).join(" ") || row.contactName,
        contactEmail: email || row.contactEmail,
        contactPhone: phone || row.contactPhone,
        updatedAt: new Date(),
      })
      .where(eq(acaIntakeSessions.token, row.token));

    row.crmContactId = contactId;
    // The share-link field is only writable once a contact exists.
    await syncAcaIntakeLinkToCrm(row, locale);
    return contactId;
  } catch (e) {
    console.warn("[aca-intake] lazy CRM contact creation failed:", e);
    return null;
  }
}

/**
 * Push the current (decrypted) intake data to the linked CRM contact. Best-effort:
 * returns false and logs on any miss (missing creds/contact, API error) without throwing,
 * so it can run on every autosave without breaking the save.
 */
export async function syncAcaIntakeToCrm(
  row: AcaIntakeSessionRow,
  decrypted: AcaIntakeData
): Promise<boolean> {
  const contactId = await ensureAcaCrmContactForSession(row, decrypted);
  if (!contactId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  try {
    const { native, customFields, skippedSlugs } = buildCrmPayloadFromData(decrypted);
    if (skippedSlugs.length > 0) {
      console.warn(
        "[aca-intake] Custom fields not provisioned (run pnpm aca:fields):",
        Array.from(new Set(skippedSlugs)).join(", ")
      );
    }
    if (Object.keys(native).length === 0 && customFields.length === 0) return false;
    return await agentCrmUpdateContact(contactId, { native, customFields }, creds.token, "[ACA_INTAKE]");
  } catch (e) {
    console.warn("[aca-intake] CRM sync failed:", e);
    return false;
  }
}

/** Find an unclaimed session already created for this email (avoids duplicate sessions). */
export async function findUnclaimedAcaSessionByEmail(
  ownerUserId: string,
  email: string
): Promise<AcaIntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(acaIntakeSessions)
    .where(
      and(
        eq(acaIntakeSessions.ownerUserId, ownerUserId),
        isNull(acaIntakeSessions.clientUserId),
        ilike(acaIntakeSessions.contactEmail, email)
      )
    )
    .orderBy(desc(acaIntakeSessions.updatedAt))
    .limit(1);
  return row ?? null;
}
