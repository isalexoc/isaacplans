/**
 * Server-side data layer for the shared intake engine: DB access, access control, and the CRM
 * payload builder used on completion. Server-only (touches the DB + env secrets).
 *
 * Ported from `lib/aca-intake/server.ts`, with two structural changes:
 *  - every query is scoped by `lob`, since all engine lines share one `intake_sessions` table;
 *  - `buildCrmPayloadFromData` flattens repeaters generically (a GHL contact has no concept of a
 *    nested list) using the `crmSlots` / `crm` / `rowFormat` declared on the repeater field,
 *    rather than the hand-written household serializer ACA needed.
 */

import "server-only";
import { and, count, desc, eq, isNull, or, ilike, sql, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { intakeSessions } from "@/lib/db/schema";
import {
  agentCrmGetBaseCredentials,
  agentCrmUpdateContact,
  agentCrmGetContactTags,
  agentCrmEnsureContact,
  agentCrmAddContactTags,
  agentCrmGetContactNative,
  type AgentCrmNativeFields,
} from "@/lib/agent-crm-contacts";
import {
  resolveIntakeAccess,
  isIntakeExpired,
  intakeLinkExpiry,
  type IntakeAccess,
  type IntakeCaller,
} from "@/lib/intake-shared/access";
import { crmFieldId, intakeLinkSlug } from "./ghl-field-ids";
import { buildIntakeShareUrl } from "./share-url";
import { buildCrmPayloadFromData } from "./crm-payload";
import { ensureScopedContact } from "./contact-scope";
import { resolveIntakeOwner } from "./self-start";
import type {
  IntakeData,
  IntakeLobConfig,
  IntakeSession,
  IntakeStatus,
  IntakeSummary,
} from "./types";

export type IntakeSessionRow = typeof intakeSessions.$inferSelect;

/** Contact tag marking a Spanish-speaking client → the saved link uses the /es locale. */
export const INTAKE_SPANISH_TAG = "spanish";
/** Contact tag marking an English-speaking client (locale segmentation counterpart). */
export const INTAKE_ENGLISH_TAG = "english";

/** Per-line tags. Kept distinct so a GHL workflow can fire for one product only. */
export function intakeTags(config: IntakeLobConfig) {
  return {
    linkSent: `${config.slugPrefix}_intake_link_sent`,
    completed: `${config.slugPrefix}_intake_completed`,
    selfApply: `${config.slugPrefix}_self_apply`,
  };
}

/** CRM `source` stamped on contacts this line creates. Omitting it makes the shared helper
 *  stamp every new contact "iul_intake" — a real bug the ACA route documents. */
function crmSource(config: IntakeLobConfig): string {
  return `${config.slugPrefix}_intake`;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

export function toIntakeSummary(row: IntakeSessionRow): IntakeSummary {
  return {
    id: row.id,
    lob: row.lob as IntakeSummary["lob"],
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

/** Serialize a row for an authorized caller. `data` should already be decrypted or masked. */
export function toIntakeSession(
  row: IntakeSessionRow,
  role: "owner" | "client",
  data: IntakeData
): IntakeSession {
  return { ...toIntakeSummary(row), data, locale: row.locale ?? "en", role };
}

/** Owner Clerk id for self-started sessions (see `resolveIntakeOwner`). */
export function intakeOwnerUserId(config: IntakeLobConfig): string {
  return resolveIntakeOwner(config);
}

export async function createIntakeSession(
  config: IntakeLobConfig,
  input: {
    ownerUserId: string;
    clientUserId?: string | null;
    clientDeviceId?: string | null;
    crmContactId?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    locale?: string;
    data?: IntakeData;
  }
): Promise<IntakeSessionRow> {
  const now = new Date();
  const [row] = await db
    .insert(intakeSessions)
    .values({
      id: nanoid(),
      lob: config.lob,
      token: nanoid(24),
      ownerUserId: input.ownerUserId,
      clientUserId: input.clientUserId ?? null,
      clientDeviceId: input.clientDeviceId ?? null,
      expiresAt: intakeLinkExpiry(now),
      crmContactId: input.crmContactId ?? null,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      // A line's starting answers (Legal Shield's default package), under whatever the caller set.
      data: { ...(config.initialData ?? {}), ...(input.data ?? {}) },
      locale: config.fixedLocale ?? input.locale ?? "en",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function getIntakeByToken(
  config: IntakeLobConfig,
  token: string
): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(intakeSessions)
    .where(and(eq(intakeSessions.lob, config.lob), eq(intakeSessions.token, token)))
    .limit(1);
  return row ?? null;
}

/** Find a session already claimed by this browser, so "Apply" resumes instead of duplicating. */
export async function findSessionByDevice(
  config: IntakeLobConfig,
  deviceId: string
): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(intakeSessions)
    .where(and(eq(intakeSessions.lob, config.lob), eq(intakeSessions.clientDeviceId, deviceId)))
    .orderBy(desc(intakeSessions.updatedAt))
    .limit(1);
  return row ?? null;
}

/** An agent-created session for this email that no browser has claimed yet. */
export async function findUnclaimedSessionByEmail(
  config: IntakeLobConfig,
  ownerUserId: string,
  email: string
): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(intakeSessions)
    .where(
      and(
        eq(intakeSessions.lob, config.lob),
        eq(intakeSessions.ownerUserId, ownerUserId),
        ilike(intakeSessions.contactEmail, email),
        isNull(intakeSessions.clientDeviceId)
      )
    )
    .orderBy(desc(intakeSessions.updatedAt))
    .limit(1);
  return row ?? null;
}

/** Bind an unclaimed session to the browser that just opened it. */
export async function bindClientDevice(token: string, deviceId: string): Promise<void> {
  await db
    .update(intakeSessions)
    .set({ clientDeviceId: deviceId, updatedAt: new Date() })
    .where(eq(intakeSessions.token, token));
}

/**
 * Public "Apply now" entry point: resume the prospect's existing application, claim an unclaimed
 * one the agent already created for their email, or create a fresh one. The agent is always the
 * owner so it lands in their dashboard.
 *
 * No account required — the caller is identified by their device cookie.
 */
export async function selfStartIntakeForClient(
  config: IntakeLobConfig,
  input: {
    clientDeviceId: string;
    clientUserId?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    locale?: string;
    /** Whitelisted answers from the start link (`selfStartPresetsFrom`), e.g. the billing picked. */
    presets?: IntakeData;
  }
): Promise<IntakeSessionRow> {
  const ownerUserId = intakeOwnerUserId(config);
  const tags = intakeTags(config);
  const presets = input.presets ?? {};

  // 1. Resume the application this browser already started. A preset only fills an answer the
  //    client hasn't given yet: what they chose on the form wins over the presentation.
  const byDevice = await findSessionByDevice(config, input.clientDeviceId);
  if (byDevice && !isIntakeExpired(byDevice)) {
    const stored = (byDevice.data ?? {}) as IntakeData;
    const blanks: IntakeData = {};
    for (const [key, value] of Object.entries(presets)) {
      if (stored[key] === undefined || stored[key] === null || stored[key] === "") blanks[key] = value;
    }
    if (Object.keys(blanks).length === 0) return byDevice;
    return (await patchIntakeData(byDevice.token, blanks)) ?? byDevice;
  }

  const email = (input.email ?? "").trim().toLowerCase();

  // 2. Claim an unclaimed session the agent already created for this email (avoids a duplicate).
  if (email) {
    const unclaimed = await findUnclaimedSessionByEmail(config, ownerUserId, email);
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
  // ensureCrmContactForSession. A scoped line (Legal Shield) always waits for that save: its own
  // exact-match rules and tags live there, never the loose match and self-apply tag below.
  if (creds && (email || phone) && !config.contactSearchTags?.length) {
    // Best-effort — a CRM hiccup must never block the prospect from starting.
    try {
      crmContactId = await agentCrmEnsureContact(
        {
          email: email || undefined,
          phone: phone || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          source: crmSource(config),
        },
        creds.locationId,
        creds.token,
        `[${config.slugPrefix.toUpperCase()}_SELF_APPLY]`
      );
      if (crmContactId) {
        await agentCrmAddContactTags(
          crmContactId,
          [tags.selfApply, locale === "es" ? INTAKE_SPANISH_TAG : INTAKE_ENGLISH_TAG],
          creds.token,
          `[${config.slugPrefix.toUpperCase()}_SELF_APPLY]`
        );
      }
    } catch (e) {
      console.warn(`[${config.lob}-intake] self-apply CRM ensure failed:`, e);
    }
  } else if (!creds) {
    console.warn(`[${config.lob}-intake] Agent CRM credentials missing; session is unlinked.`);
  }

  const prefill: IntakeData = { ...presets };
  if (firstName) prefill.firstName = firstName;
  if (lastName) prefill.lastName = lastName;
  if (email) prefill.email = email;
  if (phone) prefill.phone = phone;

  const row = await createIntakeSession(config, {
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
  await syncIntakeLinkToCrm(config, row, locale);

  return row;
}

// ── Agent dashboard queries ──────────────────────────────────────────────────

export const INTAKE_PAGE_SIZE = 20;

/**
 * `ownerUserId: null` lists every owner's sessions of the line: only for an admin on a line with
 * `adminOversight` (Isaac seeing his dad's Legal Shield clients); the route decides that.
 */
function ownerListConditions(
  config: IntakeLobConfig,
  ownerUserId: string | null,
  opts: { search?: string; status?: IntakeStatus }
): SQL[] {
  const conditions: SQL[] = [eq(intakeSessions.lob, config.lob)];
  if (ownerUserId !== null) conditions.push(eq(intakeSessions.ownerUserId, ownerUserId));
  if (opts.status) conditions.push(eq(intakeSessions.status, opts.status));
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim()}%`;
    const searchClause = or(
      ilike(intakeSessions.contactName, q),
      ilike(intakeSessions.contactEmail, q),
      ilike(intakeSessions.contactPhone, q)
    );
    if (searchClause) conditions.push(searchClause);
  }
  return conditions;
}

export async function listIntakeSessionsForOwner(
  config: IntakeLobConfig,
  ownerUserId: string | null,
  opts: { search?: string; status?: IntakeStatus; page?: number; limit?: number } = {}
): Promise<IntakeSessionRow[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? INTAKE_PAGE_SIZE, 100));
  const page = Math.max(1, opts.page ?? 1);
  return db
    .select()
    .from(intakeSessions)
    .where(and(...ownerListConditions(config, ownerUserId, opts)))
    .orderBy(desc(intakeSessions.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);
}

export async function countIntakeSessionsForOwner(
  config: IntakeLobConfig,
  ownerUserId: string | null,
  opts: { search?: string; status?: IntakeStatus } = {}
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(intakeSessions)
    .where(and(...ownerListConditions(config, ownerUserId, opts)));
  return row?.value ?? 0;
}

/** Permanently delete a session. Owner-scoped: only the creating agent can delete. */
export async function deleteIntakeSession(
  config: IntakeLobConfig,
  token: string,
  ownerUserId: string
): Promise<boolean> {
  const deleted = await db
    .delete(intakeSessions)
    .where(
      and(
        eq(intakeSessions.lob, config.lob),
        eq(intakeSessions.token, token),
        eq(intakeSessions.ownerUserId, ownerUserId)
      )
    )
    .returning({ id: intakeSessions.id });
  return deleted.length > 0;
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** `data || patch`: the patch's keys replace stored ones, and every other stored key stays. */
function mergedData(patch: IntakeData): SQL {
  return sql`coalesce(${intakeSessions.data}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`;
}

/**
 * Merge a save into the stored answers, in ONE statement.
 *
 * Writes only the keys in `patch`, so two tabs (or the form and a secure link) saving different
 * answers can't erase each other. It has to be a single statement: the neon-http driver can't hold
 * a lock across two, so a read-modify-write in code would reopen exactly that race. A completed
 * session stays completed; anything else becomes in_progress.
 *
 * `patch` must already be encrypted (`encryptIntakeData`) and hold at least one key. There is no
 * "unset": a key can be set to null or "", never removed.
 */
export async function patchIntakeData(
  token: string,
  patch: IntakeData
): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .update(intakeSessions)
    .set({
      data: mergedData(patch),
      status: sql`CASE WHEN ${intakeSessions.status} = 'completed' THEN 'completed' ELSE 'in_progress' END`,
      updatedAt: new Date(),
    })
    .where(eq(intakeSessions.token, token))
    .returning();
  return row ?? null;
}

/**
 * Reset a share link: rotate the token (old link dies immediately) and clear the bound client so
 * the next person to open the new link claims it. Also the recovery path when a client loses the
 * browser they started on. Admin-only at the route layer.
 */
export async function resetIntakeLink(token: string): Promise<IntakeSessionRow | null> {
  const now = new Date();
  const [row] = await db
    .update(intakeSessions)
    .set({
      token: nanoid(24),
      clientUserId: null,
      clientDeviceId: null,
      expiresAt: intakeLinkExpiry(now),
      updatedAt: now,
    })
    .where(eq(intakeSessions.token, token))
    .returning();
  return row ?? null;
}

/**
 * Mark a submission completed: status and timestamps only.
 *
 * The answers were validated and synced as stored and are not written back. Completion makes
 * several CRM calls, so a copy read at its start can be seconds old by now, and writing it would
 * undo a save that landed in between. With purge-after-sync on, `purge` holds just the sensitive
 * keys to blank, merged in the same statement like any other patch.
 */
export async function markIntakeCompleted(
  token: string,
  purge?: IntakeData | null
): Promise<IntakeSessionRow | null> {
  const now = new Date();
  const [row] = await db
    .update(intakeSessions)
    .set({
      ...(purge && Object.keys(purge).length > 0 ? { data: mergedData(purge) } : {}),
      // Re-lock the client on every submission; admin re-opens explicitly if needed.
      status: "completed",
      reopenedForClient: false,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(intakeSessions.token, token))
    .returning();
  return row ?? null;
}

/** Admin grants (or revokes) the client's ability to edit an already-submitted form. */
export async function setClientReopened(
  token: string,
  allow: boolean
): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .update(intakeSessions)
    .set({ reopenedForClient: allow, updatedAt: new Date() })
    .where(eq(intakeSessions.token, token))
    .returning();
  return row ?? null;
}

/** A client may edit while not yet completed, or after an admin re-opens the form. */
export function clientCanEdit(row: IntakeSessionRow): boolean {
  return row.status !== "completed" || row.reopenedForClient === true;
}

/**
 * Access rule for a token-scoped session — see lib/intake-shared/access.ts. The agent always gets
 * in; otherwise the unguessable token plus the device cookie that claimed the session.
 */
export function canAccessIntake(row: IntakeSessionRow, caller: IntakeCaller): IntakeAccess {
  return resolveIntakeAccess(row, caller);
}

export { isIntakeExpired };

// ── CRM sync ─────────────────────────────────────────────────────────────────

/**
 * Write the session's current share link to the line's `<prefix>_intake_link` custom field so a
 * GHL workflow can text/email it. The link locale follows the contact's Spanish tag (tag present
 * → /es, else /en); pass `localeOverride` to skip the tag lookup. Never throws.
 */
export async function syncIntakeLinkToCrm(
  config: IntakeLobConfig,
  row: IntakeSessionRow,
  localeOverride?: "en" | "es"
): Promise<boolean> {
  if (!row.crmContactId) return false;
  const fieldId = crmFieldId(config.lob, intakeLinkSlug(config.slugPrefix));
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
        locale = tags.some((t) => t.trim().toLowerCase() === INTAKE_SPANISH_TAG) ? "es" : "en";
      }
    }
    const url = buildIntakeShareUrl(config, row.token, locale);
    return await agentCrmUpdateContact(
      row.crmContactId,
      { customFields: [{ id: fieldId, field_value: url }] },
      creds.token,
      `[${config.slugPrefix.toUpperCase()}_INTAKE]`
    );
  } catch (e) {
    console.warn(`[${config.lob}-intake] Link sync failed:`, e);
    return false;
  }
}

/** Lives in ./crm-payload (pure, testable); re-exported for existing callers. */
export { buildCrmPayloadFromData };

/**
 * Attach a CRM contact to a session that started anonymously, as soon as the client has typed
 * enough to identify them. Matching on email/phone means a prospect who already came through a
 * CTA or ads funnel lands on their existing contact rather than a duplicate.
 * Returns the contact id, or null while there's still nothing to match on.
 */
export async function ensureCrmContactForSession(
  config: IntakeLobConfig,
  row: IntakeSessionRow,
  decrypted: IntakeData
): Promise<string | null> {
  if (row.crmContactId) return row.crmContactId;

  const email = str(decrypted.email).toLowerCase();
  const phone = str(decrypted.phone).replace(/[^\d+]/g, "");
  if (!email && !phone) return null;

  const creds = agentCrmGetBaseCredentials();
  if (!creds) return null;

  const logTag = `[${config.slugPrefix.toUpperCase()}_INTAKE]`;
  const firstName = str(decrypted.firstName);
  const lastName = str(decrypted.lastName);
  try {
    if (config.contactSearchTags?.length) {
      // A scoped line (Legal Shield): an exact match or a new contact, its own tags, and the
      // language tag only on a contact it created. Never the self-apply tag (it would fire the
      // insurance lines' self-apply workflow), even for a session a client started themselves.
      const result = await ensureScopedContact(
        { email: email || undefined, phone: phone || undefined, firstName, lastName, source: crmSource(config) },
        creds.locationId,
        creds.token,
        logTag
      );
      if (!result.id) return null;
      const locale = row.locale === "es" ? "es" : "en";
      const tags = [...(config.contactTags ?? [])];
      if (result.created) tags.push(locale === "es" ? INTAKE_SPANISH_TAG : INTAKE_ENGLISH_TAG);
      if (tags.length) await agentCrmAddContactTags(result.id, tags, creds.token, logTag);
      await db
        .update(intakeSessions)
        .set({
          crmContactId: result.id,
          contactName: [firstName, lastName].filter(Boolean).join(" ") || row.contactName,
          contactEmail: email || row.contactEmail,
          contactPhone: phone || row.contactPhone,
          updatedAt: new Date(),
        })
        .where(eq(intakeSessions.token, row.token));
      row.crmContactId = result.id;
      return result.id;
    }

    const contactId = await agentCrmEnsureContact(
      {
        email: email || undefined,
        phone: phone || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        source: crmSource(config),
      },
      creds.locationId,
      creds.token,
      logTag
    );
    if (!contactId) return null;

    const locale = row.locale === "es" ? "es" : "en";
    await agentCrmAddContactTags(
      contactId,
      [intakeTags(config).selfApply, locale === "es" ? INTAKE_SPANISH_TAG : INTAKE_ENGLISH_TAG],
      creds.token,
      logTag
    );

    await db
      .update(intakeSessions)
      .set({
        crmContactId: contactId,
        contactName: [firstName, lastName].filter(Boolean).join(" ") || row.contactName,
        contactEmail: email || row.contactEmail,
        contactPhone: phone || row.contactPhone,
        updatedAt: new Date(),
      })
      .where(eq(intakeSessions.token, row.token));

    row.crmContactId = contactId;
    // The share-link field is only writable once a contact exists.
    await syncIntakeLinkToCrm(config, row, locale);
    return contactId;
  } catch (e) {
    console.warn(`[${config.lob}-intake] CRM contact ensure failed:`, e);
    return null;
  }
}

/**
 * The native fields that are still EMPTY on the contact. A completion-only line never overwrites a
 * contact (often one of Isaac's own, matched by email or phone): it only fills what's missing.
 * When the contact can't be read, nothing is written.
 */
export async function fillBlanksOnly(
  contactId: string,
  native: AgentCrmNativeFields,
  token: string
): Promise<AgentCrmNativeFields> {
  const current = await agentCrmGetContactNative(contactId, token);
  if (!current) return {};
  const out: AgentCrmNativeFields = {};
  for (const [key, value] of Object.entries(native) as [keyof AgentCrmNativeFields, string][]) {
    const existing = (current as unknown as Record<string, unknown>)[key];
    if (typeof existing === "string" && existing.trim()) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Push the current (decrypted) intake data to the linked CRM contact. Best-effort: returns false
 * and logs on any miss (missing creds/contact, API error) without throwing, so it can run on every
 * autosave without breaking the save.
 */
export async function syncIntakeToCrm(
  config: IntakeLobConfig,
  row: IntakeSessionRow,
  decrypted: IntakeData
): Promise<boolean> {
  // A completion-only line (Legal Shield) writes nothing to the CRM while the form is being
  // filled: the completion route does it once, filling blanks only.
  if (config.crmSync === "completion-fill-blanks") return false;
  const contactId = await ensureCrmContactForSession(config, row, decrypted);
  if (!contactId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  try {
    const { native, customFields, skippedSlugs } = buildCrmPayloadFromData(config, decrypted);
    if (skippedSlugs.length > 0) {
      console.warn(
        `[${config.lob}-intake] Custom fields not provisioned (run pnpm intake:fields ${config.lob}):`,
        Array.from(new Set(skippedSlugs)).join(", ")
      );
    }
    if (Object.keys(native).length === 0 && customFields.length === 0) return false;
    return await agentCrmUpdateContact(
      contactId,
      { native, customFields },
      creds.token,
      `[${config.slugPrefix.toUpperCase()}_INTAKE]`
    );
  } catch (e) {
    console.warn(`[${config.lob}-intake] CRM sync failed:`, e);
    return false;
  }
}
