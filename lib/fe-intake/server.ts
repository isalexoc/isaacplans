/**
 * Server-side data layer for Final Expense intake sessions: DB access, access control, and
 * the CRM payload builder used on completion. Server-only (touches the DB + env secrets).
 *
 * Mirrors lib/aca-intake/server.ts. The notable difference is `buildCrmPayloadFromData`, which
 * flattens the `medications` repeater into one readable `medications_list` text field instead
 * of per-slot custom fields — there's no fixed cap on how many medications matter the way ACA's
 * household members do.
 */

import "server-only";
import { and, count, desc, eq, isNull, or, ilike, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { feIntakeSessions } from "@/lib/db/schema";
import {
  FE_SECTIONS,
  USAGE_OPTIONS,
  isFieldVisible,
  type RepeaterRow,
} from "./fields";
import { feFieldIds } from "./ghl-field-ids";
import type { FeIntakeData } from "./schema";
import type { FeIntakeSession, FeIntakeSummary } from "./types";
import {
  agentCrmGetBaseCredentials,
  agentCrmUpdateContact,
  agentCrmGetContactTags,
  agentCrmGetContactNative,
  agentCrmEnsureContact,
  agentCrmAddContactTags,
  type AgentCrmCustomFieldValue,
  type AgentCrmNativeFields,
} from "@/lib/agent-crm-contacts";
import { buildFeIntakeShareUrl } from "./share-url";

/** Tag added to the contact when the agent sends the link — triggers the GHL workflow. */
export const FE_INTAKE_LINK_SENT_TAG = "fe_intake_link_sent";

/** Tag applied when a client submits a completed intake. */
export const FE_INTAKE_COMPLETED_TAG = "fe_intake_completed";

/** Contact tag that marks a Spanish-speaking client → the saved link uses the /es locale. */
export const FE_SPANISH_TAG = "spanish";

/** Contact tag that marks an English-speaking client (locale segmentation counterpart). */
export const FE_ENGLISH_TAG = "english";

/** Contact tag applied when a prospect self-starts an application from the public apply page. */
export const FE_SELF_APPLY_TAG = "fe_self_apply";

/**
 * How long a passwordless intake link stays usable. Long enough that a client can finish over a
 * few days, short enough that an old link in a text thread stops being a live credential. The
 * agent can always issue a fresh one with "Reset link".
 */
export const FE_INTAKE_LINK_TTL_DAYS = 30;
const FE_INTAKE_LINK_TTL_MS = FE_INTAKE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

export function isFeIntakeExpired(row: FeIntakeSessionRow): boolean {
  return Boolean(row.expiresAt && row.expiresAt.getTime() < Date.now());
}

export type FeIntakeSessionRow = typeof feIntakeSessions.$inferSelect;

export type FeIntakeStatus = "draft" | "in_progress" | "completed";

export function toFeIntakeSummary(row: FeIntakeSessionRow): FeIntakeSummary {
  return {
    id: row.id,
    token: row.token,
    status: row.status as FeIntakeStatus,
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
export function toFeIntakeSession(
  row: FeIntakeSessionRow,
  role: "owner" | "client",
  data: FeIntakeData
): FeIntakeSession {
  return {
    ...toFeIntakeSummary(row),
    data,
    locale: row.locale ?? "en",
    role,
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

export async function createFeIntakeSession(input: {
  ownerUserId: string;
  clientUserId?: string | null;
  crmContactId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locale?: string;
  data?: FeIntakeData;
  clientDeviceId?: string | null;
}): Promise<FeIntakeSessionRow> {
  const id = nanoid();
  const token = nanoid(24);
  const now = new Date();
  const [row] = await db
    .insert(feIntakeSessions)
    .values({
      id,
      token,
      ownerUserId: input.ownerUserId,
      clientUserId: input.clientUserId ?? null,
      clientDeviceId: input.clientDeviceId ?? null,
      expiresAt: new Date(now.getTime() + FE_INTAKE_LINK_TTL_MS),
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
 * (FE_INTAKE_DEFAULT_OWNER_USER_ID) is always the owner so it lands in their dashboard.
 *
 * No account required — the caller is identified by their device cookie. `clientUserId` is still
 * honored so sessions created under the old Clerk-gated flow keep working.
 */
export async function selfStartFeIntakeForClient(input: {
  clientDeviceId: string;
  clientUserId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  locale?: string;
}): Promise<FeIntakeSessionRow> {
  const ownerUserId = process.env.FE_INTAKE_DEFAULT_OWNER_USER_ID;
  if (!ownerUserId) {
    throw new Error("FE_INTAKE_DEFAULT_OWNER_USER_ID is not configured.");
  }

  // 1a. Resume an application already bound to this Clerk user (legacy sessions).
  if (input.clientUserId) {
    const [bound] = await db
      .select()
      .from(feIntakeSessions)
      .where(eq(feIntakeSessions.clientUserId, input.clientUserId))
      .orderBy(desc(feIntakeSessions.updatedAt))
      .limit(1);
    if (bound && !isFeIntakeExpired(bound)) return bound;
  }

  // 1b. Resume the application this browser already started.
  const byDevice = await findFeSessionByDevice(input.clientDeviceId);
  if (byDevice && !isFeIntakeExpired(byDevice)) return byDevice;

  const email = (input.email ?? "").trim().toLowerCase();

  // 2. Claim an unclaimed session the agent already created for this email (avoids a duplicate).
  if (email) {
    const unclaimed = await findUnclaimedFeSessionByEmail(ownerUserId, email);
    if (unclaimed) {
      await bindFeClientDevice(unclaimed.token, input.clientDeviceId);
      return { ...unclaimed, clientDeviceId: input.clientDeviceId };
    }
  }

  // 3. Create a new application — match-or-create the CRM contact and tag it.
  const locale = input.locale === "es" ? "es" : "en";
  const firstName = (input.firstName ?? "").trim();
  const lastName = (input.lastName ?? "").trim();
  const phone = (input.phone ?? "").replace(/[^\d+]/g, "");

  const prefill: FeIntakeData = {};
  if (firstName) prefill.firstName = firstName;
  if (lastName) prefill.lastName = lastName;
  if (email) prefill.email = email;
  if (phone) prefill.phone = phone;

  let crmContactId: string | null = null;
  let contactName = [firstName, lastName].filter(Boolean).join(" ") || null;
  let contactEmail = email || null;
  let contactPhone = phone || null;
  const creds = agentCrmGetBaseCredentials();
  // Without an account there is nothing to identify an anonymous starter by, and creating a
  // contact from nothing would litter the CRM with blank records on every "Apply" tap. The
  // contact is created lazily instead, on the first autosave that carries an email or phone
  // (see ensureCrmContactForSession).
  if (creds && (email || phone)) {
    // Best-effort — a CRM hiccup must never block the prospect from starting.
    try {
      // agentCrmEnsureContact matches by email/phone first, so a lead who already submitted a
      // CTA/ads-funnel form (e.g. final-expense-lead-form or the get-covered funnel) resolves to
      // that SAME contact rather than a fresh one.
      crmContactId = await agentCrmEnsureContact(
        {
          email: email || undefined,
          phone: phone || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          source: "fe_intake",
        },
        creds.locationId,
        creds.token,
        "[FE_INTAKE_SELF_APPLY]"
      );
      if (crmContactId) {
        const tags = [FE_SELF_APPLY_TAG, locale === "es" ? FE_SPANISH_TAG : FE_ENGLISH_TAG];
        await agentCrmAddContactTags(crmContactId, tags, creds.token, "[FE_INTAKE_SELF_APPLY]");

        // Reuse whatever this lead already gave us on an earlier CTA/ads-funnel submission —
        // name, phone, DOB, address — instead of asking them to retype it in the intake form.
        // Fields still show as their own question (per product decision: confirm, don't skip),
        // just pre-filled. CRM values win over the Clerk profile since they reflect what this
        // person explicitly typed for an insurance inquiry, not just an account signup.
        const native = await agentCrmGetContactNative(crmContactId, creds.token);
        if (native) {
          if (native.firstName) prefill.firstName = native.firstName;
          if (native.lastName) prefill.lastName = native.lastName;
          if (native.email) prefill.email = native.email;
          if (native.phone) prefill.phone = native.phone;
          if (native.dateOfBirth) prefill.dateOfBirth = native.dateOfBirth.slice(0, 10);
          if (native.address1) prefill.address1 = native.address1;
          if (native.city) prefill.city = native.city;
          if (native.state) prefill.state = native.state;
          if (native.postalCode) prefill.postalCode = native.postalCode;
          contactName = [native.firstName, native.lastName].filter(Boolean).join(" ") || contactName;
          contactEmail = native.email || contactEmail;
          contactPhone = native.phone || contactPhone;
        }
      }
    } catch (e) {
      console.warn("[fe-intake] self-apply CRM ensure failed:", e);
    }
  } else if (!creds) {
    console.warn("[fe-intake] Agent CRM credentials missing; self-apply session is unlinked.");
  }

  const row = await createFeIntakeSession({
    ownerUserId,
    clientUserId: input.clientUserId ?? null,
    clientDeviceId: input.clientDeviceId,
    crmContactId,
    contactName,
    contactEmail,
    contactPhone,
    locale,
    data: prefill,
  });

  // Seed the CRM share link (best-effort — never blocks the redirect).
  await syncFeIntakeLinkToCrm(row, locale);

  return row;
}

export async function getFeIntakeByToken(token: string): Promise<FeIntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(feIntakeSessions)
    .where(eq(feIntakeSessions.token, token))
    .limit(1);
  return row ?? null;
}

/** Filters shared by the paginated list and the matching count query. */
function ownerListConditions(
  ownerUserId: string,
  opts: { search?: string; status?: FeIntakeStatus }
): SQL[] {
  const conditions: SQL[] = [eq(feIntakeSessions.ownerUserId, ownerUserId)];
  if (opts.status) conditions.push(eq(feIntakeSessions.status, opts.status));
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    const searchClause = or(
      ilike(feIntakeSessions.contactName, q),
      ilike(feIntakeSessions.contactEmail, q),
      ilike(feIntakeSessions.contactPhone, q)
    );
    if (searchClause) conditions.push(searchClause);
  }
  return conditions;
}

export const FE_INTAKE_PAGE_SIZE = 20;

export async function listFeIntakeSessionsForOwner(
  ownerUserId: string,
  opts: { search?: string; status?: FeIntakeStatus; page?: number; limit?: number } = {}
): Promise<FeIntakeSessionRow[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? FE_INTAKE_PAGE_SIZE, 100));
  const page = Math.max(1, opts.page ?? 1);
  const conditions = ownerListConditions(ownerUserId, opts);
  return db
    .select()
    .from(feIntakeSessions)
    .where(and(...conditions))
    .orderBy(desc(feIntakeSessions.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

/** Total rows matching the same filters — used to compute total pages. */
export async function countFeIntakeSessionsForOwner(
  ownerUserId: string,
  opts: { search?: string; status?: FeIntakeStatus } = {}
): Promise<number> {
  const conditions = ownerListConditions(ownerUserId, opts);
  const [row] = await db
    .select({ value: count() })
    .from(feIntakeSessions)
    .where(and(...conditions));
  return row?.value ?? 0;
}

/** Permanently delete an intake session. Owner-scoped: only the creating agent can delete. */
export async function deleteFeIntakeSession(token: string, ownerUserId: string): Promise<boolean> {
  const deleted = await db
    .delete(feIntakeSessions)
    .where(and(eq(feIntakeSessions.token, token), eq(feIntakeSessions.ownerUserId, ownerUserId)))
    .returning({ id: feIntakeSessions.id });
  return deleted.length > 0;
}

export async function updateFeIntakeData(
  token: string,
  data: FeIntakeData,
  status: FeIntakeStatus
): Promise<FeIntakeSessionRow | null> {
  const [row] = await db
    .update(feIntakeSessions)
    .set({ data, status, updatedAt: new Date() })
    .where(eq(feIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/**
 * Reset a share link: rotate the token (old link dies immediately) and clear the bound
 * client so the next person to open the new link claims it. Admin-only at the route layer.
 */
export async function resetFeIntakeLink(token: string): Promise<FeIntakeSessionRow | null> {
  const now = new Date();
  const [row] = await db
    .update(feIntakeSessions)
    // Clearing the device binding is also the recovery path when a client loses the browser they
    // started on: a fresh link, claimable by whichever device opens it next.
    .set({
      token: nanoid(24),
      clientUserId: null,
      clientDeviceId: null,
      expiresAt: new Date(now.getTime() + FE_INTAKE_LINK_TTL_MS),
      updatedAt: now,
    })
    .where(eq(feIntakeSessions.token, token))
    .returning();
  return row ?? null;
}


export async function markFeIntakeCompleted(
  token: string,
  data: FeIntakeData
): Promise<FeIntakeSessionRow | null> {
  const now = new Date();
  const [row] = await db
    .update(feIntakeSessions)
    // Re-lock the client on every submission; admin re-opens explicitly if needed.
    .set({ data, status: "completed", reopenedForClient: false, completedAt: now, updatedAt: now })
    .where(eq(feIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/** Admin grants (or revokes) the client's ability to edit an already-submitted form. */
export async function setFeClientReopened(
  token: string,
  allow: boolean
): Promise<FeIntakeSessionRow | null> {
  const [row] = await db
    .update(feIntakeSessions)
    .set({ reopenedForClient: allow, updatedAt: new Date() })
    .where(eq(feIntakeSessions.token, token))
    .returning();
  return row ?? null;
}

/** A client may edit while not yet completed, or after an admin re-opens the form. */
export function feClientCanEdit(row: FeIntakeSessionRow): boolean {
  return row.status !== "completed" || row.reopenedForClient === true;
}

/**
 * Write the session's current share link to the CRM `fe_intake_link` custom field so a GHL
 * workflow can text/email it. The link locale follows the contact's Spanish tag (tag present
 * → /es, else /en); pass `localeOverride` to skip the tag lookup. Never throws.
 */
export async function syncFeIntakeLinkToCrm(
  row: FeIntakeSessionRow,
  localeOverride?: "en" | "es"
): Promise<boolean> {
  if (!row.crmContactId) return false;
  const fieldId = feFieldIds.fe_intake_link;
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
        locale = row.locale === "es" ? "es" : "en";
      } else {
        locale = tags.some((t) => t.trim().toLowerCase() === FE_SPANISH_TAG) ? "es" : "en";
      }
    }
    const url = buildFeIntakeShareUrl(row.token, locale);
    return await agentCrmUpdateContact(
      row.crmContactId,
      { customFields: [{ id: fieldId, field_value: url }] },
      creds.token,
      "[FE_INTAKE]"
    );
  } catch (e) {
    console.warn("[fe-intake] Link sync failed:", e);
    return false;
  }
}

export type FeIntakeCaller = {
  /** Clerk user id, when the caller happens to be signed in (the agent always is). */
  userId?: string | null;
  /** Device id from the httpOnly cookie — how an anonymous client proves continuity. */
  deviceId?: string | null;
};

export type FeIntakeAccess = {
  allowed: boolean;
  /** The session is unclaimed: bind it to this caller's device on the way through. */
  shouldClaim: boolean;
  role: "owner" | "client";
  /** Denied because a different browser already claimed the link (vs. simply not found). */
  claimedByOtherDevice: boolean;
};

const DENIED: FeIntakeAccess = {
  allowed: false,
  shouldClaim: false,
  role: "client",
  claimedByOtherDevice: false,
};

/**
 * Access rule for a token-scoped session. The agent (owner) always gets in. Otherwise the
 * unguessable token plus one of: the Clerk id it was bound to under the old sign-in flow, or the
 * device cookie that claimed it. An unclaimed session is claimable by whoever opens it first —
 * which is safe precisely because the token is unguessable.
 */
export function canAccessFeIntake(row: FeIntakeSessionRow, caller: FeIntakeCaller): FeIntakeAccess {
  const userId = caller.userId ?? null;
  const deviceId = caller.deviceId ?? null;

  if (userId && row.ownerUserId === userId) {
    return { allowed: true, shouldClaim: false, role: "owner", claimedByOtherDevice: false };
  }
  // Sessions created before passwordless access stay bound to their Clerk user.
  if (userId && row.clientUserId === userId) {
    return { allowed: true, shouldClaim: false, role: "client", claimedByOtherDevice: false };
  }
  if (deviceId && row.clientDeviceId === deviceId) {
    return { allowed: true, shouldClaim: false, role: "client", claimedByOtherDevice: false };
  }
  if (!row.clientUserId && !row.clientDeviceId && deviceId) {
    return { allowed: true, shouldClaim: true, role: "client", claimedByOtherDevice: false };
  }
  return { ...DENIED, claimedByOtherDevice: Boolean(row.clientDeviceId || row.clientUserId) };
}

/** Bind an unclaimed session to the browser that just opened it. */
export async function bindFeClientDevice(token: string, deviceId: string): Promise<void> {
  await db
    .update(feIntakeSessions)
    .set({ clientDeviceId: deviceId, updatedAt: new Date() })
    .where(eq(feIntakeSessions.token, token));
}

/** Find a session already claimed by this browser, so "Apply" resumes instead of duplicating. */
export async function findFeSessionByDevice(deviceId: string): Promise<FeIntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(feIntakeSessions)
    .where(eq(feIntakeSessions.clientDeviceId, deviceId))
    .orderBy(desc(feIntakeSessions.updatedAt))
    .limit(1);
  return row ?? null;
}

/** Human-readable label for a usage value, falling back to a free-text "Other" answer. */
function usageLabel(row: RepeaterRow): string {
  const value = str(row.usage);
  if (value === "Other") return str(row.usageOther) || "Other";
  const opt = USAGE_OPTIONS.find((o) => o.value === value);
  return opt ? opt.labelEn : value;
}

/** Flatten the medications repeater into one CRM text value, e.g. "Atorvastatin (Cholesterol)". */
function formatMedications(rows: RepeaterRow[]): string {
  return rows
    .map((row) => {
      const drug = str(row.drugName);
      if (!drug) return "";
      const usage = usageLabel(row);
      return usage ? `${drug} (${usage})` : drug;
    })
    .filter(Boolean)
    .join("; ");
}

/** Flatten the beneficiaries repeater into one CRM text value, e.g. "Jane Doe (Spouse)". */
function formatBeneficiaries(rows: RepeaterRow[]): string {
  return rows
    .map((row) => {
      const name = [str(row.firstName), str(row.lastName)].filter(Boolean).join(" ");
      if (!name) return "";
      const relationship = str(row.relationship);
      return relationship ? `${name} (${relationship})` : name;
    })
    .filter(Boolean)
    .join("; ");
}

/**
 * Build the CRM update payload from DECRYPTED intake data.
 * Native fields go on the contact body; custom fields resolve slug→id (unprovisioned ids
 * are skipped). Medications collapse into one text field.
 */
export function buildCrmPayloadFromData(data: FeIntakeData): {
  native: AgentCrmNativeFields;
  customFields: AgentCrmCustomFieldValue[];
  skippedSlugs: string[];
} {
  const native: AgentCrmNativeFields = {};
  const customFields: AgentCrmCustomFieldValue[] = [];
  const skippedSlugs: string[] = [];

  const pushCustom = (slug: string, value: string) => {
    const id = feFieldIds[slug as keyof typeof feFieldIds];
    if (!id) {
      skippedSlugs.push(slug);
      return;
    }
    customFields.push({ id, field_value: value });
  };

  for (const section of FE_SECTIONS) {
    for (const field of section.fields) {
      if (!field.crm) continue;
      if (!isFieldVisible(field, data)) continue;
      if (field.type === "repeater") continue; // handled separately below

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

  // GHL's contact record has no native address-2 slot, and an apartment number belongs with the
  // street it qualifies — mail without it doesn't arrive. Composed rather than dropped, and
  // idempotent because it always rebuilds from our own stored fields.
  const address2 = str(data.address2);
  if (address2 && native.address1) {
    native.address1 = `${native.address1}, ${address2}`;
  }

  const medications: RepeaterRow[] = Array.isArray(data.medications)
    ? (data.medications as RepeaterRow[])
    : [];
  const medsText = formatMedications(medications);
  if (medsText) pushCustom("medications_list", medsText);

  const beneficiaries: RepeaterRow[] = Array.isArray(data.beneficiaries)
    ? (data.beneficiaries as RepeaterRow[])
    : [];
  const beneficiariesText = formatBeneficiaries(beneficiaries);
  if (beneficiariesText) pushCustom("beneficiaries_list", beneficiariesText);

  return { native, customFields, skippedSlugs };
}

/**
 * Push the current (decrypted) intake data to the linked CRM contact. Best-effort:
 * returns false and logs on any miss (missing creds/contact, API error) without throwing,
 * so it can run on every autosave without breaking the save.
 */
/**
 * Attach a CRM contact to a session that started anonymously, as soon as the client has typed
 * enough to identify them. Matching on email/phone means a prospect who already came through a
 * CTA or ads funnel lands on their existing contact rather than a duplicate.
 * Returns the contact id, or null while there's still nothing to match on.
 */
export async function ensureCrmContactForSession(
  row: FeIntakeSessionRow,
  decrypted: FeIntakeData
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
        source: "fe_intake",
      },
      creds.locationId,
      creds.token,
      "[FE_INTAKE]"
    );
    if (!contactId) return null;

    const locale = row.locale === "es" ? "es" : "en";
    await agentCrmAddContactTags(
      contactId,
      [FE_SELF_APPLY_TAG, locale === "es" ? FE_SPANISH_TAG : FE_ENGLISH_TAG],
      creds.token,
      "[FE_INTAKE]"
    );

    await db
      .update(feIntakeSessions)
      .set({
        crmContactId: contactId,
        contactName: [firstName, lastName].filter(Boolean).join(" ") || row.contactName,
        contactEmail: email || row.contactEmail,
        contactPhone: phone || row.contactPhone,
        updatedAt: new Date(),
      })
      .where(eq(feIntakeSessions.token, row.token));

    row.crmContactId = contactId;
    // The share link field is only writable once a contact exists.
    await syncFeIntakeLinkToCrm(row, locale);
    return contactId;
  } catch (e) {
    console.warn("[fe-intake] lazy CRM contact creation failed:", e);
    return null;
  }
}

export async function syncFeIntakeToCrm(
  row: FeIntakeSessionRow,
  decrypted: FeIntakeData
): Promise<boolean> {
  const contactId = await ensureCrmContactForSession(row, decrypted);
  if (!contactId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  try {
    const { native, customFields, skippedSlugs } = buildCrmPayloadFromData(decrypted);
    if (skippedSlugs.length > 0) {
      console.warn(
        "[fe-intake] Custom fields not provisioned (run pnpm fe-intake:fields):",
        Array.from(new Set(skippedSlugs)).join(", ")
      );
    }
    if (Object.keys(native).length === 0 && customFields.length === 0) return false;
    return await agentCrmUpdateContact(contactId, { native, customFields }, creds.token, "[FE_INTAKE]");
  } catch (e) {
    console.warn("[fe-intake] CRM sync failed:", e);
    return false;
  }
}

/** Find an unclaimed session already created for this email (avoids duplicate sessions). */
export async function findUnclaimedFeSessionByEmail(
  ownerUserId: string,
  email: string
): Promise<FeIntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(feIntakeSessions)
    .where(
      and(
        eq(feIntakeSessions.ownerUserId, ownerUserId),
        isNull(feIntakeSessions.clientUserId),
        ilike(feIntakeSessions.contactEmail, email)
      )
    )
    .orderBy(desc(feIntakeSessions.updatedAt))
    .limit(1);
  return row ?? null;
}
