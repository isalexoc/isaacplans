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
import { and, asc, count, desc, eq, inArray, isNull, lt, notInArray, or, ilike, sql, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { agents, intakeSessions } from "@/lib/db/schema";
import {
  agentCrmUpdateContact,
  agentCrmGetContactTags,
  agentCrmEnsureContact,
  agentCrmAddContactTags,
  type AgentCrmCustomFieldValue,
  type AgentCrmNativeFields,
} from "@/lib/agent-crm-contacts";
import {
  crmCredsForOwner,
  isListedPlatformOwner,
  listedPlatformOwnerIds,
  type CrmOwnerOptions,
} from "@/lib/tenancy/crm";
import { isMissingTableError } from "@/lib/tenancy/db-errors";
import { publicOriginForOwner } from "@/lib/tenancy/urls";
import { isIntakeExpired, intakeLinkExpiry } from "@/lib/intake-shared/access";
import { isFieldVisible, isRowFilled, allRepeaterFields, sensitiveRowKeys, sensitiveScalarKeys } from "./fields";
import { crmFieldId, intakeLinkSlug } from "./ghl-field-ids";
import { buildIntakeShareUrl } from "./share-url";
import type {
  IntakeData,
  IntakeLobConfig,
  IntakeSession,
  IntakeStatus,
  IntakeSummary,
  RepeaterRow,
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
    locale: row.locale ?? "en",
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

/** Owner Clerk id for self-started sessions: the line's own env var, else the shared default. */
export function intakeOwnerUserId(config: IntakeLobConfig): string {
  const owner =
    process.env[config.ownerEnvVar]?.trim() || process.env.INTAKE_DEFAULT_OWNER_USER_ID?.trim();
  if (!owner) {
    throw new Error(
      `Neither ${config.ownerEnvVar} nor INTAKE_DEFAULT_OWNER_USER_ID is configured.`
    );
  }
  return owner;
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
      data: input.data ?? {},
      locale: input.locale ?? "en",
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

/**
 * Only the owner of the session behind a token, for a page that must know whose it is before it
 * renders (lib/tenancy/pages.ts): one column, never the client's answers.
 */
export async function getIntakeOwnerByToken(
  config: IntakeLobConfig,
  token: string
): Promise<{ ownerUserId: string } | null> {
  const [row] = await db
    .select({ ownerUserId: intakeSessions.ownerUserId })
    .from(intakeSessions)
    .where(and(eq(intakeSessions.lob, config.lob), eq(intakeSessions.token, token)))
    .limit(1);
  return row ?? null;
}

/**
 * Whose applications a device may resume: exactly one owner's (an agent's "Apply", so one agent's
 * guide never reopens another agent's application on the shared product domain), or "platform"
 * (Isaac's own pages: any session owned by an id listed in env, or by anyone without an `agents`
 * row, which is every session until agents exist).
 */
export type DeviceResumeScope = { ownerUserId: string } | "platform";

/** Find a session already claimed by this browser, so "Apply" resumes instead of duplicating. */
export async function findSessionByDevice(
  config: IntakeLobConfig,
  deviceId: string,
  scope: DeviceResumeScope
): Promise<IntakeSessionRow | null> {
  const byDevice = [eq(intakeSessions.lob, config.lob), eq(intakeSessions.clientDeviceId, deviceId)];
  const latest = async (extra?: SQL) => {
    const [row] = await db
      .select()
      .from(intakeSessions)
      .where(and(...byDevice, ...(extra ? [extra] : [])))
      .orderBy(desc(intakeSessions.updatedAt))
      .limit(1);
    return row ?? null;
  };

  if (scope !== "platform") return latest(eq(intakeSessions.ownerUserId, scope.ownerUserId));
  const ownerHasNoAgentRow = sql`not exists (select 1 from ${agents} where ${agents.clerkUserId} = ${intakeSessions.ownerUserId})`;
  // Isaac's own ids stay his even if an `agents` row were ever linked to one of them, the same way
  // lib/tenancy/context.ts never looks a listed owner up.
  const listed = listedPlatformOwnerIds();
  const platform = listed.length
    ? or(inArray(intakeSessions.ownerUserId, listed), ownerHasNoAgentRow)
    : ownerHasNoAgentRow;
  try {
    return await latest(platform);
  } catch (error) {
    // Before migration 0046 there is no `agents` table, so no session can be an agent's: the
    // query without the filter is exactly today's.
    if (!isMissingTableError(error)) throw error;
    return latest();
  }
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
 * `ownerUserId` is the agent whose "Apply" this is (an agent's guide on the product domain); left
 * out, it is today's owner, `intakeOwnerUserId(config)`. A device only resumes that owner's
 * application, and with the default only a session that isn't an agent's.
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
    ownerUserId?: string | null;
  }
): Promise<IntakeSessionRow> {
  const explicitOwner = input.ownerUserId?.trim() || null;
  const ownerUserId = explicitOwner ?? intakeOwnerUserId(config);
  const tags = intakeTags(config);

  // 1. Resume the application this browser already started (for this owner).
  const byDevice = await findSessionByDevice(
    config,
    input.clientDeviceId,
    explicitOwner ? { ownerUserId: explicitOwner } : "platform"
  );
  if (byDevice && !isIntakeExpired(byDevice)) return byDevice;

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
  // Isaac's CRM for his own applications only; an agent's gets none (lib/tenancy/crm.ts).
  const creds = await crmCredsForOwner(ownerUserId);
  // Without an account there is nothing to identify an anonymous starter by, and creating a
  // contact from nothing would litter the CRM with blank records on every "Apply" tap. The contact
  // is created lazily instead, on the first autosave carrying an email or phone — see
  // ensureCrmContactForSession.
  if (creds && (email || phone)) {
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
  } else if (!creds && isListedPlatformOwner(ownerUserId)) {
    console.warn(`[${config.lob}-intake] Agent CRM credentials missing; session is unlinked.`);
  }

  const prefill: IntakeData = {};
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

function ownerListConditions(
  config: IntakeLobConfig,
  ownerUserId: string,
  opts: { search?: string; status?: IntakeStatus }
): SQL[] {
  const conditions: SQL[] = [
    eq(intakeSessions.lob, config.lob),
    eq(intakeSessions.ownerUserId, ownerUserId),
  ];
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
  ownerUserId: string,
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
  ownerUserId: string,
  opts: { search?: string; status?: IntakeStatus } = {}
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(intakeSessions)
    .where(and(...ownerListConditions(config, ownerUserId, opts)));
  return row?.value ?? 0;
}

/**
 * How many applications each of these owners has, on every line: a count per owner id and nothing
 * else (Isaac's /admin/agents shows agents' numbers, never their clients).
 */
export async function countIntakeSessionsByOwners(ownerUserIds: readonly string[]): Promise<Map<string, number>> {
  const ids = Array.from(new Set(ownerUserIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ owner: intakeSessions.ownerUserId, value: count() })
    .from(intakeSessions)
    .where(inArray(intakeSessions.ownerUserId, ids))
    .groupBy(intakeSessions.ownerUserId);
  return new Map(rows.map((row) => [row.owner, Number(row.value)]));
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

/** `data -> group` when it is an object, else an empty one (so a merge never builds an array). */
function flagGroup(group: string): SQL {
  return sql`case when jsonb_typeof(${intakeSessions.data} -> ${group}::text) = 'object' then ${intakeSessions.data} -> ${group}::text else '{}'::jsonb end`;
}

/**
 * Set a flag inside one of the platform's hidden objects in `data` (`data.agentAlerts.started`, …;
 * lib/tenancy/agent-data.ts) only if it isn't set yet, in ONE statement, so exactly one of any
 * number of concurrent callers gets true. `updated_at` is left alone: the dashboard orders by edits.
 */
export async function claimSessionDataFlag(
  sessionId: string,
  group: string,
  flag: string,
  value: string
): Promise<boolean> {
  const rows = await db
    .update(intakeSessions)
    .set({
      data: sql`jsonb_set(coalesce(${intakeSessions.data}, '{}'::jsonb), array[${group}::text], ${flagGroup(group)} || jsonb_build_object(${flag}::text, ${value}::text), true)`,
    })
    .where(
      and(eq(intakeSessions.id, sessionId), sql`(${intakeSessions.data} -> ${group}::text -> ${flag}::text) is null`)
    )
    .returning({ id: intakeSessions.id });
  return rows.length > 0;
}

/** Undo `claimSessionDataFlag` (the work it guarded failed and should be tried again). */
export async function releaseSessionDataFlag(sessionId: string, group: string, flag: string): Promise<void> {
  await db
    .update(intakeSessions)
    .set({
      data: sql`jsonb_set(${intakeSessions.data}, array[${group}::text], (${intakeSessions.data} -> ${group}::text) - ${flag}::text)`,
    })
    .where(
      and(eq(intakeSessions.id, sessionId), sql`jsonb_typeof(${intakeSessions.data} -> ${group}::text) = 'object'`)
    );
}

/**
 * The 30-day purge's daily backstop (lib/tenancy/agent-jobs.ts `reconcileAgentPurges`): an AGENT's
 * applications completed before `completedBefore` that still hold a sensitive value (a non-empty
 * string in a sensitive field, or in a sensitive sub-field of a repeater row; the keys come from the
 * config, like encryption and masking), oldest first. Never Isaac's: the owner needs an `agents`
 * row and isn't one of the ids listed in env as his (the same rule as `findSessionByDevice`).
 * Before migration 0046 there is no `agents` table, so no application is an agent's: none.
 */
export async function listAgentSessionsHoldingSensitive(
  config: IntakeLobConfig,
  completedBefore: Date,
  limit: number
): Promise<IntakeSessionRow[]> {
  const nonEmpty = (value: SQL, key: string) =>
    sql`(jsonb_typeof(${value} -> ${key}::text) = 'string' and ${value} ->> ${key}::text <> '')`;
  const held: SQL[] = [
    ...sensitiveScalarKeys(config.sections).map((key) => nonEmpty(sql`${intakeSessions.data}`, key)),
    ...sensitiveRowKeys(config.sections).map(([repeaterKey, subKeys]) => {
      const rows = sql`case when jsonb_typeof(${intakeSessions.data} -> ${repeaterKey}::text) = 'array' then ${intakeSessions.data} -> ${repeaterKey}::text else '[]'::jsonb end`;
      const anySub = sql.join(
        subKeys.map((sub) => nonEmpty(sql.raw("purge_row.item"), sub)),
        sql` or `
      );
      return sql`exists (select 1 from jsonb_array_elements(${rows}) as purge_row(item) where ${anySub})`;
    }),
  ];
  if (held.length === 0) return [];

  const ownerIsAgent = sql`exists (select 1 from ${agents} where ${agents.clerkUserId} = ${intakeSessions.ownerUserId})`;
  const listed = listedPlatformOwnerIds();
  try {
    return await db
      .select()
      .from(intakeSessions)
      .where(
        and(
          eq(intakeSessions.lob, config.lob),
          eq(intakeSessions.status, "completed"),
          lt(intakeSessions.completedAt, completedBefore),
          ownerIsAgent,
          ...(listed.length ? [notInArray(intakeSessions.ownerUserId, listed)] : []),
          or(...held)
        )
      )
      .orderBy(asc(intakeSessions.completedAt))
      .limit(limit);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

/**
 * Reset a share link: rotate the token (old link dies immediately) and clear the bound client so
 * the next person to open the new link claims it. Also the recovery path when a client loses the
 * browser they started on. Owner-only at the route layer (lib/tenancy/context.ts `operatorOwns`).
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

/** The owner grants (or revokes) the client's ability to edit an already-submitted form. */
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

// Token-route access lives in lib/intake-core/route-helpers.ts `loadAuthorizedSession` (the
// operator and agent rules of lib/tenancy/operator.ts on top of lib/intake-shared/access.ts); there
// is deliberately no bare access helper here that a new route could call instead.

export { isIntakeExpired };

// ── CRM sync ─────────────────────────────────────────────────────────────────

/**
 * Write the session's current share link to the line's `<prefix>_intake_link` custom field so a
 * GHL workflow can text/email it. The link locale follows the contact's Spanish tag (tag present
 * → /es, else /en); pass `localeOverride` to skip the tag lookup. Never throws. Only for sessions
 * whose owner may use Isaac's CRM; `crm` lets an operator route vouch for its admin caller.
 */
export async function syncIntakeLinkToCrm(
  config: IntakeLobConfig,
  row: IntakeSessionRow,
  localeOverride?: "en" | "es",
  crm?: CrmOwnerOptions
): Promise<boolean> {
  if (!row.crmContactId) return false;
  const fieldId = crmFieldId(config.lob, intakeLinkSlug(config.slugPrefix));
  if (!fieldId) return false;
  const creds = await crmCredsForOwner(row.ownerUserId, crm);
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
    const url = buildIntakeShareUrl(config, row.token, locale, await publicOriginForOwner(row.ownerUserId, crm));
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

/** Default row rendering: `Label: value` pairs, unambiguous when read in the CRM. */
function defaultRowFormat(
  field: { rowFields?: { key: string; type: string; labelEn: string; crmLabel?: string }[] },
  row: RepeaterRow,
  index: number
): string {
  const parts: string[] = [];
  for (const sub of field.rowFields ?? []) {
    if (sub.type === "file") continue;
    const value = str(row[sub.key]);
    if (value) parts.push(`${sub.crmLabel ?? sub.labelEn}: ${value}`);
  }
  return parts.length ? `${index + 1}. ${parts.join(" | ")}` : "";
}

/**
 * Build the CRM update payload from DECRYPTED intake data.
 *
 * Native fields go on the contact body; custom fields resolve slug→id (unprovisioned ids are
 * collected into `skippedSlugs` and skipped, so a half-provisioned line still syncs). Repeaters
 * flatten either into one slot per row (`crmSlots`) or into a single newline-joined text field
 * (`crm`), because a GHL contact cannot hold a nested list.
 */
export function buildCrmPayloadFromData(
  config: IntakeLobConfig,
  data: IntakeData
): {
  native: AgentCrmNativeFields;
  customFields: AgentCrmCustomFieldValue[];
  skippedSlugs: string[];
} {
  const native: AgentCrmNativeFields = {};
  const customFields: AgentCrmCustomFieldValue[] = [];
  const skippedSlugs: string[] = [];

  const pushCustom = (slug: string, value: string) => {
    const id = crmFieldId(config.lob, slug);
    if (!id) {
      skippedSlugs.push(slug);
      return;
    }
    customFields.push({ id, field_value: value });
  };

  for (const section of config.sections) {
    for (const field of section.fields) {
      if (!isFieldVisible(field, data)) continue;
      // Repeaters are handled below; file uploads are written by the files route.
      if (field.type === "repeater" || field.type === "file") continue;
      if (!field.crm) continue;

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

  // GHL's contact record has no native slot for a second surname or an apartment line, and both
  // belong with the value they extend — a carrier name match needs both surnames, and mail needs
  // the unit number. Compose them into the native fields rather than dropping them; they stay
  // separate in our own record. Idempotent: the composition always rebuilds from our stored
  // fields, never from what is already on the contact.
  const secondLastName = str(data.secondLastName);
  if (secondLastName) {
    native.lastName = native.lastName ? `${native.lastName} ${secondLastName}` : secondLastName;
  }
  const address2 = str(data.address2);
  if (address2 && native.address1) {
    native.address1 = `${native.address1}, ${address2}`;
  }

  for (const field of allRepeaterFields(config.sections)) {
    if (!isFieldVisible(field, data)) continue;
    const raw = data[field.key];
    const rows: RepeaterRow[] = Array.isArray(raw) ? (raw as RepeaterRow[]) : [];
    const filled = rows.filter((r) => isRowFilled(field, r ?? {}));
    if (!filled.length) continue;

    const format = field.rowFormat ?? ((r: RepeaterRow, i: number) => defaultRowFormat(field, r, i));

    if (field.crmSlots?.length) {
      // One CRM field per row — readable at a glance in the contact record.
      field.crmSlots.forEach((slug, i) => {
        const row = filled[i];
        if (!row) return;
        const line = format(row, i);
        if (line) pushCustom(slug, line);
      });
    } else if (field.crm?.kind === "custom") {
      // Collapse every row into one text field.
      const text = filled.map((r, i) => format(r, i)).filter(Boolean).join("\n");
      if (text) pushCustom(field.crm.slug, text);
    }
  }

  return { native, customFields, skippedSlugs };
}

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

  const creds = await crmCredsForOwner(row.ownerUserId);
  if (!creds) return null;

  const logTag = `[${config.slugPrefix.toUpperCase()}_INTAKE]`;
  const firstName = str(decrypted.firstName);
  const lastName = str(decrypted.lastName);
  try {
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
 * Push the current (decrypted) intake data to the linked CRM contact. Best-effort: returns false
 * and logs on any miss (missing creds/contact, API error) without throwing, so it can run on every
 * autosave without breaking the save.
 */
export async function syncIntakeToCrm(
  config: IntakeLobConfig,
  row: IntakeSessionRow,
  decrypted: IntakeData
): Promise<boolean> {
  const contactId = await ensureCrmContactForSession(config, row, decrypted);
  if (!contactId) return false;
  const creds = await crmCredsForOwner(row.ownerUserId);
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
