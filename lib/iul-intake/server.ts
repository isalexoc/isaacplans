/**
 * Server-side data layer for IUL intake sessions: DB access, access control, and the
 * CRM payload builder used on completion. Server-only (touches the DB + env secrets).
 */

import "server-only";
import { and, desc, eq, or, ilike } from "drizzle-orm";
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
  type AgentCrmCustomFieldValue,
  type AgentCrmNativeFields,
} from "@/lib/agent-crm-contacts";
import { buildIntakeShareUrl } from "./share-url";

/** Tag added to the contact when the agent sends the link — triggers the GHL workflow. */
export const IUL_INTAKE_LINK_SENT_TAG = "iul_intake_link_sent";

/** Contact tag that marks a Spanish-speaking client → the saved link uses the /es locale. */
export const IUL_SPANISH_TAG = "spanish";

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
  crmContactId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locale?: string;
  data?: IntakeData;
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

export async function getIntakeByToken(token: string): Promise<IntakeSessionRow | null> {
  const [row] = await db
    .select()
    .from(iulIntakeSessions)
    .where(eq(iulIntakeSessions.token, token))
    .limit(1);
  return row ?? null;
}

export async function listIntakeSessionsForOwner(
  ownerUserId: string,
  opts: { search?: string; status?: IntakeStatus } = {}
): Promise<IntakeSessionRow[]> {
  const conditions = [eq(iulIntakeSessions.ownerUserId, ownerUserId)];
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
  return db
    .select()
    .from(iulIntakeSessions)
    .where(and(...conditions))
    .orderBy(desc(iulIntakeSessions.updatedAt))
    .limit(200);
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
    .set({ token: nanoid(24), clientUserId: null, updatedAt: new Date() })
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

/** Access rule: owner agent always; the bound client; or an unclaimed session (to claim). */
export function canAccessIntake(
  row: IntakeSessionRow,
  userId: string
): { allowed: boolean; shouldClaim: boolean } {
  if (row.ownerUserId === userId) return { allowed: true, shouldClaim: false };
  if (row.clientUserId === userId) return { allowed: true, shouldClaim: false };
  if (!row.clientUserId) return { allowed: true, shouldClaim: true };
  return { allowed: false, shouldClaim: false };
}

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
export async function syncIntakeToCrm(
  row: IntakeSessionRow,
  decrypted: IntakeData
): Promise<boolean> {
  if (!row.crmContactId) return false;
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
    return await agentCrmUpdateContact(
      row.crmContactId,
      { native, customFields },
      creds.token,
      "[IUL_INTAKE]"
    );
  } catch (e) {
    console.warn("[iul-intake] CRM sync failed:", e);
    return false;
  }
}
