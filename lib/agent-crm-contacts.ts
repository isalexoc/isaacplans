/**
 * Shared LeadConnector (Agent CRM) contact helpers: search, fetch, duplicate handling.
 * Used by newsletter sync, Clerk webhooks, and can be reused by create-contact flows.
 */

export const AGENT_CRM_API_BASE = "https://services.leadconnectorhq.com";
export const AGENT_CRM_API_VERSION = "2021-07-28";

export function agentCrmAuthHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    Version: AGENT_CRM_API_VERSION,
  };
}

export function agentCrmJsonHeaders(token: string): HeadersInit {
  return {
    ...agentCrmAuthHeaders(token),
    "Content-Type": "application/json",
  };
}

/** PI + location only (callers add feature flags like AGENT_CRM_SYNC_NEWSLETTER). */
export function agentCrmGetBaseCredentials(): { token: string; locationId: string } | null {
  const token = process.env.AGENT_CRM_PI;
  const locationId = process.env.AGENT_CRM_LOCATION_ID;
  if (!token || !locationId) return null;
  return { token, locationId };
}

export function agentCrmNormalizeContactTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t === "string" && t.trim()) out.push(t);
    else if (t && typeof t === "object" && "name" in t && typeof (t as { name: unknown }).name === "string") {
      const n = (t as { name: string }).name.trim();
      if (n) out.push(n);
    }
  }
  return out;
}

type LcContact = { id?: string; email?: string; tags?: unknown };

function parseContactsSearchResponse(data: unknown): LcContact[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const contacts = d.contacts ?? (d.data as Record<string, unknown> | undefined)?.contacts;
  if (Array.isArray(contacts)) return contacts as LcContact[];
  return [];
}

export async function agentCrmFetchContactById(
  contactId: string,
  locationId: string,
  token: string
): Promise<{ id: string; tags: string[] } | null> {
  const q = new URLSearchParams({ locationId });
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}?${q}`, {
    method: "GET",
    headers: agentCrmAuthHeaders(token),
  });
  if (!res.ok) {
    console.warn("[AGENT_CRM] Get contact failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const c = (data.contact ?? data) as LcContact;
  if (!c?.id) return null;
  return { id: c.id, tags: agentCrmNormalizeContactTags(c.tags) };
}

/** POST /contacts/search — GET ?email= is no longer supported. */
export async function agentCrmFindContactByEmail(
  email: string,
  locationId: string,
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<{ id: string; tags: string[] } | null> {
  const lower = email.toLowerCase().trim();
  const searchBodies: Record<string, unknown>[] = [
    {
      locationId,
      page: 1,
      pageLimit: 20,
      filters: [{ field: "email", operator: "eq", value: lower }],
    },
    {
      locationId,
      page: 1,
      pageLimit: 20,
      filters: [
        {
          group: "AND",
          filters: [{ field: "email", operator: "eq", value: lower }],
        },
      ],
    },
    {
      locationId,
      page: 1,
      pageLimit: 20,
      query: lower,
    },
  ];

  for (const body of searchBodies) {
    const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/search`, {
      method: "POST",
      headers: agentCrmJsonHeaders(token),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`${logPrefix} Contact search failed:`, res.status, text);
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    const list = parseContactsSearchResponse(data);
    if (list.length === 0) continue;
    const match =
      list.find((c) => c.email?.toLowerCase() === lower) ??
      list.find((c) => c.email?.toLowerCase().includes(lower)) ??
      list[0];
    if (!match?.id) continue;
    const full = await agentCrmFetchContactById(match.id, locationId, token);
    if (full) return full;
    return { id: match.id, tags: agentCrmNormalizeContactTags(match.tags) };
  }

  return null;
}

export type AgentCrmCreateContactErrorBody = {
  message?: string | string[];
  statusCode?: number;
  meta?: { contactId?: string; matchingField?: string };
};

export function agentCrmErrorMessageString(err: AgentCrmCreateContactErrorBody): string {
  const m = err.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(" ");
  return "";
}

export function agentCrmIsDuplicateContactError(status: number, err: AgentCrmCreateContactErrorBody): boolean {
  const msg = agentCrmErrorMessageString(err).toLowerCase();
  return (
    status === 409 ||
    (status === 400 && (msg.includes("duplicat") || msg.includes("already exist"))) ||
    msg.includes("duplicate") ||
    msg.includes("duplicated")
  );
}
