/**
 * Shared helpers for "append data to an existing CRM contact" endpoints (Step 2 of a
 * two-step ad funnel, after the Lead has already been created + counted in Step 1).
 *
 * Mirrors the local helpers in app/api/contact-append-address/route.ts so new
 * append endpoints (e.g. IUL get-covered) can reuse the same verification +
 * lead_source_details merge logic without duplicating it.
 */

export const AGENT_CRM_API_BASE = "https://services.leadconnectorhq.com";

export function unwrapContactRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const c = r.contact;
  if (c && typeof c === "object") return c as Record<string, unknown>;
  const d = r.data;
  if (d && typeof d === "object") {
    const dc = (d as Record<string, unknown>).contact;
    if (dc && typeof dc === "object") return dc as Record<string, unknown>;
    return d as Record<string, unknown>;
  }
  return r as Record<string, unknown>;
}

export function extractCrmEmail(contact: Record<string, unknown>): string {
  for (const key of ["email", "primaryEmail", "primary_email"] as const) {
    const e = contact[key];
    if (typeof e === "string" && e.includes("@")) {
      return e.toLowerCase().trim();
    }
  }
  const additional = contact.additionalEmails;
  if (Array.isArray(additional)) {
    for (const item of additional) {
      if (typeof item === "string" && item.includes("@")) {
        return item.toLowerCase().trim();
      }
      if (item && typeof item === "object" && "email" in item) {
        const em = (item as { email?: string }).email;
        if (typeof em === "string" && em.includes("@")) {
          return em.toLowerCase().trim();
        }
      }
    }
  }
  return "";
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function last10(s: string): string {
  const d = digitsOnly(s);
  return d.length >= 10 ? d.slice(-10) : d;
}

export function phonesMatch(a: string, b: string): boolean {
  return last10(a) === last10(b) && last10(a).length === 10;
}

export const LEAD_SOURCE_DETAILS_FIELD_KEY = "lead_source_details";

function normalizeLeadConnectorFieldKeySegment(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("contact.")) return s.slice("contact.".length);
  return s;
}

function unwrapCustomFieldDefinition(field: unknown): Record<string, unknown> | null {
  if (!field || typeof field !== "object") return null;
  const o = field as Record<string, unknown>;
  const inner = o.customField;
  if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  return o;
}

function isLeadSourceDetailsFieldDefinition(def: Record<string, unknown>): boolean {
  const key = typeof def.key === "string" ? def.key.toLowerCase() : "";
  if (
    key === LEAD_SOURCE_DETAILS_FIELD_KEY ||
    key.replace(/[_\s-]/g, "") === "leadsourcedetails"
  ) {
    return true;
  }
  const fieldKeyRaw = typeof def.fieldKey === "string" ? def.fieldKey : "";
  const fk = normalizeLeadConnectorFieldKeySegment(fieldKeyRaw);
  if (
    fk === LEAD_SOURCE_DETAILS_FIELD_KEY ||
    fk.replace(/[_\s-]/g, "") === "leadsourcedetails"
  ) {
    return true;
  }
  const name = typeof def.name === "string" ? def.name.toLowerCase() : "";
  return name.includes("lead") && name.includes("source") && name.includes("detail");
}

export async function resolveLeadSourceDetailsCustomField(
  baseUrl: string,
  locationId: string,
  piToken: string
): Promise<{ id: string; key?: string } | null> {
  const envId = process.env.AGENT_CRM_CUSTOM_FIELD_LEAD_SOURCE_DETAILS_ID?.trim();
  if (envId) {
    return { id: envId, key: LEAD_SOURCE_DETAILS_FIELD_KEY };
  }

  try {
    const res = await fetch(`${baseUrl}/locations/${encodeURIComponent(locationId)}/customFields`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${piToken}`,
        Version: "2021-07-28",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { customFields?: unknown };
    const list = data.customFields ?? data;
    if (!Array.isArray(list)) return null;
    for (const field of list) {
      const def = unwrapCustomFieldDefinition(field);
      if (!def || !isLeadSourceDetailsFieldDefinition(def)) continue;
      const id = typeof def.id === "string" ? def.id : "";
      if (!id) continue;
      const key = typeof def.key === "string" ? def.key : undefined;
      return { id, key };
    }
  } catch (e) {
    console.warn("[agent-crm-contact-append] Could not resolve lead_source_details field:", e);
  }
  return null;
}

export type CrmCustomFieldRow = { id: string; field_value: string | string[]; key?: string };

export function getCustomFieldStringValue(
  existingOnContact: unknown,
  fieldId: string
): string {
  if (!Array.isArray(existingOnContact)) return "";
  for (const row of existingOnContact) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (r.id !== fieldId) continue;
    const raw = r.field_value ?? r.value;
    if (typeof raw === "string") return raw.trim();
    if (Array.isArray(raw)) return raw.map((v) => String(v)).join(", ").trim();
    return String(raw ?? "").trim();
  }
  return "";
}

/** Preserve existing contact custom fields when applying updates (PUT replaces the whole array). */
export function mergeCustomFieldsWithUpdates(
  existingOnContact: unknown,
  updates: CrmCustomFieldRow[]
): CrmCustomFieldRow[] {
  const out: CrmCustomFieldRow[] = [];
  const byId = new Map<string, CrmCustomFieldRow>();

  if (Array.isArray(existingOnContact)) {
    for (const row of existingOnContact) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      if (!id) continue;
      const raw = r.field_value ?? r.value;
      if (raw === undefined || raw === null) continue;
      byId.set(id, {
        id,
        key: typeof r.key === "string" ? r.key : undefined,
        field_value: Array.isArray(raw) ? raw : String(raw),
      });
    }
  }

  for (const update of updates) {
    byId.set(update.id, update);
  }

  for (const item of byId.values()) {
    out.push(item);
  }

  return out;
}
