import "server-only";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { mailingLabels } from "@/lib/db/schema";
import { isPrintableAddress, normalizeMailingLabelInput, normalizeLanguage } from "./format";
import type {
  MailingLabelInput,
  MailingLabelRecord,
  MailingLabelSource,
  MailingLabelStatus,
} from "./types";

type MailingLabelRow = typeof mailingLabels.$inferSelect;

export function rowToMailingLabelRecord(row: MailingLabelRow): MailingLabelRecord {
  return {
    id: row.id,
    source: row.source as MailingLabelSource,
    sourceRef: row.sourceRef ?? null,
    firstName: row.firstName,
    lastName: row.lastName,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2 ?? "",
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    language: normalizeLanguage(row.language),
    phone: row.phone ?? "",
    email: row.email ?? "",
    status: row.status as MailingLabelStatus,
    printedAt: row.printedAt ? row.printedAt.toISOString() : null,
    notes: row.notes ?? "",
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export type ListMailingLabelsFilters = {
  status?: MailingLabelStatus | "all";
  source?: MailingLabelSource | "all";
  /** Free text matched against first/last name, city, and street. */
  q?: string;
};

export async function listMailingLabels(
  filters: ListMailingLabelsFilters = {}
): Promise<MailingLabelRecord[]> {
  const conditions = [];
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(mailingLabels.status, filters.status));
  }
  if (filters.source && filters.source !== "all") {
    conditions.push(eq(mailingLabels.source, filters.source));
  }
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(mailingLabels.firstName, like),
        ilike(mailingLabels.lastName, like),
        ilike(mailingLabels.city, like),
        ilike(mailingLabels.addressLine1, like)
      )!
    );
  }

  const rows = await db
    .select()
    .from(mailingLabels)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(mailingLabels.createdAt))
    .limit(500);

  return rows.map(rowToMailingLabelRecord);
}

/** Fetch by id, preserving the caller's `ids` order so the printed sheet matches the selection. */
export async function getMailingLabelsByIds(ids: string[]): Promise<MailingLabelRecord[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(mailingLabels).where(inArray(mailingLabels.id, ids));
  const byId = new Map(rows.map((row) => [row.id, rowToMailingLabelRecord(row)]));
  return ids.map((id) => byId.get(id)).filter((r): r is MailingLabelRecord => Boolean(r));
}

export async function createMailingLabel(
  input: MailingLabelInput,
  createdByUserId: string
): Promise<MailingLabelRecord | null> {
  const clean = normalizeMailingLabelInput(input);
  if (!clean) return null;

  const rows = await db
    .insert(mailingLabels)
    .values({
      id: nanoid(),
      source: "manual",
      sourceRef: null,
      createdByUserId,
      firstName: clean.firstName,
      lastName: clean.lastName,
      addressLine1: clean.addressLine1,
      addressLine2: clean.addressLine2 || null,
      city: clean.city,
      state: clean.state,
      postalCode: clean.postalCode,
      language: clean.language ?? "en",
      phone: clean.phone || null,
      email: clean.email || null,
      notes: clean.notes || null,
    })
    .returning();

  return rows[0] ? rowToMailingLabelRecord(rows[0]) : null;
}

export async function updateMailingLabel(
  id: string,
  patch: Partial<MailingLabelInput> & { status?: MailingLabelStatus }
): Promise<MailingLabelRecord | null> {
  const set: Partial<typeof mailingLabels.$inferInsert> = { updatedAt: new Date() };

  // Address edits are validated as a whole so a partial save can't leave an unmailable row.
  const touchesAddress = ["addressLine1", "city", "state", "postalCode"].some(
    (k) => k in patch
  );
  if (touchesAddress) {
    const current = await getMailingLabelById(id);
    if (!current) return null;
    const merged = normalizeMailingLabelInput({ ...current, ...patch });
    if (!merged) return null;
    Object.assign(set, {
      addressLine1: merged.addressLine1,
      addressLine2: merged.addressLine2 || null,
      city: merged.city,
      state: merged.state,
      postalCode: merged.postalCode,
    });
  } else if (patch.addressLine2 !== undefined) {
    set.addressLine2 = patch.addressLine2.trim() || null;
  }

  if (patch.firstName !== undefined) set.firstName = patch.firstName.trim();
  if (patch.lastName !== undefined) set.lastName = patch.lastName.trim();
  if (patch.language !== undefined) set.language = normalizeLanguage(patch.language);
  if (patch.phone !== undefined) set.phone = patch.phone.trim() || null;
  if (patch.email !== undefined) set.email = patch.email.trim().toLowerCase() || null;
  if (patch.notes !== undefined) set.notes = patch.notes.trim() || null;
  if (patch.status !== undefined) {
    set.status = patch.status;
    set.printedAt = patch.status === "printed" ? new Date() : null;
  }

  const rows = await db
    .update(mailingLabels)
    .set(set)
    .where(eq(mailingLabels.id, id))
    .returning();

  return rows[0] ? rowToMailingLabelRecord(rows[0]) : null;
}

export async function getMailingLabelById(id: string): Promise<MailingLabelRecord | null> {
  const rows = await db.select().from(mailingLabels).where(eq(mailingLabels.id, id)).limit(1);
  return rows[0] ? rowToMailingLabelRecord(rows[0]) : null;
}

export async function deleteMailingLabels(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .delete(mailingLabels)
    .where(inArray(mailingLabels.id, ids))
    .returning({ id: mailingLabels.id });
  return rows.length;
}

export async function setMailingLabelsStatus(
  ids: string[],
  status: MailingLabelStatus
): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(mailingLabels)
    .set({
      status,
      printedAt: status === "printed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(inArray(mailingLabels.id, ids))
    .returning({ id: mailingLabels.id });
  return rows.length;
}

export type MailingLabelLeadInput = MailingLabelInput & {
  source: Exclude<MailingLabelSource, "manual">;
  sourceRef: string;
};

/**
 * Queue (or refresh) a label the moment a lead's home address is captured.
 *
 * Idempotent on `(source, sourceRef)`: a re-submitted funnel step or a redelivered webhook
 * updates the existing row instead of queueing a duplicate, and the `where` clause means an
 * address that has ALREADY been printed is left alone — otherwise a late edit would silently
 * disagree with the sticker already stuck to an envelope.
 *
 * Never throws. This runs inside lead-capture request paths (the funnel's step 2, the intake
 * completion, the Leads the Way consumer) and a label is strictly a convenience — it must not
 * be able to fail a lead.
 */
export async function upsertMailingLabelFromLead(
  input: MailingLabelLeadInput
): Promise<void> {
  try {
    if (!input.sourceRef?.trim()) return;
    const clean = normalizeMailingLabelInput(input);
    if (!clean) return; // Not enough address to mail anything — nothing to queue.

    const values = {
      firstName: clean.firstName,
      lastName: clean.lastName,
      addressLine1: clean.addressLine1,
      addressLine2: clean.addressLine2 || null,
      city: clean.city,
      state: clean.state,
      postalCode: clean.postalCode,
      language: clean.language ?? "en",
      phone: clean.phone || null,
      email: clean.email || null,
    };

    await db
      .insert(mailingLabels)
      .values({
        id: nanoid(),
        source: input.source,
        sourceRef: input.sourceRef.trim(),
        createdByUserId: null,
        ...values,
      })
      .onConflictDoUpdate({
        target: [mailingLabels.source, mailingLabels.sourceRef],
        set: { ...values, updatedAt: new Date() },
        where: eq(mailingLabels.status, "pending"),
      });
  } catch (error) {
    console.warn(
      `[mailing-labels] Could not queue a label for ${input.source}:${input.sourceRef}`,
      error instanceof Error ? error.message : error
    );
  }
}

/** Re-exported so hooks can pre-check before assembling an input object. */
export { isPrintableAddress };
