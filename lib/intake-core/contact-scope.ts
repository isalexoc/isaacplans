/**
 * CRM contacts for a line whose operator is not Isaac (Legal Shield: his dad, Ysmael), all in
 * Isaac's one GHL location.
 *
 * The shared helpers are built for Isaac, who may see and touch any contact: they match a contact
 * loosely (first search hit) and the engine then copies its date of birth and address into the
 * form and writes the form's answers back over it. For a scoped line:
 *  - a contact is reused only on an EXACT email or phone match (or GHL's own duplicate verdict);
 *  - the caller learns whether it was created or matched, so the language tag only goes on a
 *    contact this line created (an existing contact keeps the language Isaac's workflows use);
 *  - search and start-from-contact only see contacts carrying the line's tags (see the route).
 *
 * Server-only.
 */

import "server-only";
import {
  AGENT_CRM_API_BASE,
  agentCrmFindContactByEmail,
  agentCrmFindContactByPhone,
  agentCrmIsDuplicateContactError,
  agentCrmJsonHeaders,
  type AgentCrmCreateContactErrorBody,
} from "@/lib/agent-crm-contacts";

const last10 = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-10);

/** An existing contact whose email or phone is exactly this one, else null. */
export async function findExactContact(
  input: { email?: string; phone?: string },
  locationId: string,
  token: string,
  logPrefix: string
): Promise<{ id: string; tags: string[] } | null> {
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone ? last10(input.phone) : "";
  if (email) {
    const found = await agentCrmFindContactByEmail(email, locationId, token, logPrefix);
    // The finder falls back to its first search hit; only a verified equal email counts here.
    const foundEmail = (found as { email?: string | null } | null)?.email?.trim().toLowerCase();
    if (found?.id && foundEmail === email) return { id: found.id, tags: found.tags ?? [] };
  }
  if (phone.length === 10) {
    const found = await agentCrmFindContactByPhone(phone, locationId, token, logPrefix);
    const foundPhone = last10((found as { phone?: string | null } | null)?.phone);
    if (found?.id && foundPhone === phone) return { id: found.id, tags: found.tags ?? [] };
  }
  return null;
}

/**
 * The contact for a new session: an exact existing match, or a new contact. `created` says which,
 * so the caller can tag the language only on its own contacts.
 */
export async function ensureScopedContact(
  input: { email?: string; phone?: string; firstName?: string; lastName?: string; source: string },
  locationId: string,
  token: string,
  logPrefix: string
): Promise<{ id: string | null; created: boolean }> {
  const existing = await findExactContact(input, locationId, token, logPrefix);
  if (existing) return { id: existing.id, created: false };

  const email = input.email?.trim();
  const phone = input.phone?.replace(/\D/g, "");
  const body: Record<string, unknown> = { locationId, source: input.source };
  if (email) body.email = email;
  if (phone) body.phone = phone.length === 10 ? `+1${phone}` : `+${phone}`;
  if (input.firstName?.trim()) body.firstName = input.firstName.trim();
  if (input.lastName?.trim()) body.lastName = input.lastName.trim();
  if (!email && !phone && !body.firstName && !body.lastName) return { id: null, created: false };

  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/`, {
    method: "POST",
    headers: agentCrmJsonHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (res.ok) {
    const data = parsed as { contact?: { id?: unknown }; id?: unknown } | null;
    const id = data?.contact?.id ?? data?.id;
    if (typeof id === "string") return { id, created: true };
  }
  // GHL's own duplicate rule (same email or phone in this location) names the contact: that is an
  // exact match by definition.
  const err = (parsed ?? {}) as AgentCrmCreateContactErrorBody;
  if (agentCrmIsDuplicateContactError(res.status, err) && typeof err.meta?.contactId === "string") {
    return { id: err.meta.contactId, created: false };
  }
  console.warn(`${logPrefix} Create contact failed:`, res.status, text.slice(0, 300));
  return { id: null, created: false };
}

/** True when the contact carries one of the line's tags (case-insensitive). */
export function hasAnyTag(tags: readonly string[] | null | undefined, wanted: readonly string[]): boolean {
  if (!tags?.length) return false;
  const have = new Set(tags.map((t) => t.toLowerCase()));
  return wanted.some((t) => have.has(t.toLowerCase()));
}
