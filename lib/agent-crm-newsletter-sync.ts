/**
 * Syncs newsletter subscription state to Agent CRM (LeadConnector API) using the same
 * Private Integration as create-contact: tag `newsletter_subscribed` on confirm, remove on unsubscribe.
 */

const BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

/** Default tag for smart lists in Agent CRM; override with AGENT_CRM_NEWSLETTER_TAG */
function getNewsletterCrmTag(): string {
  return process.env.AGENT_CRM_NEWSLETTER_TAG?.trim() || "newsletter_subscribed";
}

function getCredentials():
  | { token: string; locationId: string }
  | { skip: true; reason: string } {
  const token = process.env.AGENT_CRM_PI;
  const locationId = process.env.AGENT_CRM_LOCATION_ID;
  if (!token || !locationId) {
    return { skip: true, reason: "AGENT_CRM_PI or AGENT_CRM_LOCATION_ID not set" };
  }
  if (process.env.AGENT_CRM_SYNC_NEWSLETTER === "false") {
    return { skip: true, reason: "AGENT_CRM_SYNC_NEWSLETTER is false" };
  }
  return { token, locationId };
}

function authHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    Version: API_VERSION,
  };
}

function jsonHeaders(token: string): HeadersInit {
  return {
    ...authHeaders(token),
    "Content-Type": "application/json",
  };
}

/** Normalize tags from LeadConnector (string[] or mixed shapes). */
function normalizeContactTags(tags: unknown): string[] {
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

/** GET /contacts/:id — load tags for merge/remove */
async function fetchContactById(
  contactId: string,
  locationId: string,
  token: string
): Promise<{ id: string; tags: string[] } | null> {
  const q = new URLSearchParams({ locationId });
  const res = await fetch(`${BASE_URL}/contacts/${contactId}?${q}`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) {
    console.warn("[AGENT_CRM_NEWSLETTER] Get contact failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const c = (data.contact ?? data) as LcContact;
  if (!c?.id) return null;
  return { id: c.id, tags: normalizeContactTags(c.tags) };
}

/**
 * LeadConnector no longer accepts GET /contacts/?email= (422 "property email should not exist").
 * Use POST /contacts/search with filters.
 */
async function findContactByEmail(
  email: string,
  locationId: string,
  token: string
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
    const res = await fetch(`${BASE_URL}/contacts/search`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn("[AGENT_CRM_NEWSLETTER] Contact search failed:", res.status, text);
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
    // Search hits may omit tags; PUT replaces tags — load full contact before merge.
    const full = await fetchContactById(match.id, locationId, token);
    if (full) return full;
    return { id: match.id, tags: normalizeContactTags(match.tags) };
  }

  return null;
}

type CreateContactErrorBody = {
  message?: string | string[];
  statusCode?: number;
  meta?: { contactId?: string; matchingField?: string };
};

function errorMessageString(err: CreateContactErrorBody): string {
  const m = err.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(" ");
  return "";
}

function isDuplicateContactError(status: number, err: CreateContactErrorBody): boolean {
  const msg = errorMessageString(err).toLowerCase();
  return (
    status === 409 ||
    (status === 400 && (msg.includes("duplicat") || msg.includes("already exist"))) ||
    msg.includes("duplicate") ||
    msg.includes("duplicated")
  );
}

/**
 * After double opt-in: ensure contact exists and has `newsletter_subscribed` (merged with existing tags).
 */
export async function agentCrmApplyNewsletterTag(params: {
  email: string;
  locale?: string | null;
}): Promise<void> {
  const cred = getCredentials();
  if ("skip" in cred) {
    if (process.env.NODE_ENV === "development") {
      console.log("[AGENT_CRM_NEWSLETTER] Skip sync:", cred.reason);
    }
    return;
  }

  const { token, locationId } = cred;
  const email = params.email.toLowerCase().trim();
  const tag = getNewsletterCrmTag();

  try {
    const existing = await findContactByEmail(email, locationId, token);

    if (existing) {
      const merged = [...new Set([...existing.tags, tag])];
      const putRes = await fetch(`${BASE_URL}/contacts/${existing.id}`, {
        method: "PUT",
        headers: jsonHeaders(token),
        body: JSON.stringify({ tags: merged }),
      });
      if (!putRes.ok) {
        console.error(
          "[AGENT_CRM_NEWSLETTER] Failed to update contact tags:",
          putRes.status,
          await putRes.text()
        );
        return;
      }
      console.log(`[AGENT_CRM_NEWSLETTER] Applied tag "${tag}" to existing contact ${existing.id}`);
      return;
    }

    // New contact: email-only signups use neutral placeholders (API may require names).
    const body: Record<string, unknown> = {
      email,
      locationId,
      source: "newsletter",
      tags: [tag],
      firstName: "Newsletter",
      lastName: "Subscriber",
    };

    const postRes = await fetch(`${BASE_URL}/contacts/`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(body),
    });

    if (postRes.ok) {
      console.log(`[AGENT_CRM_NEWSLETTER] Created contact with tag "${tag}" for ${email}`);
      return;
    }

    const errText = await postRes.text();
    let errJson: CreateContactErrorBody = {};
    try {
      errJson = JSON.parse(errText) as CreateContactErrorBody;
    } catch {
      /* ignore */
    }

    if (isDuplicateContactError(postRes.status, errJson)) {
      const fromMeta = errJson.meta?.contactId;
      let target: { id: string; tags: string[] } | null = null;

      if (fromMeta) {
        target = await fetchContactById(fromMeta, locationId, token);
      }
      if (!target) {
        target = await findContactByEmail(email, locationId, token);
      }

      if (target) {
        const merged = [...new Set([...target.tags, tag])];
        const putRes = await fetch(`${BASE_URL}/contacts/${target.id}`, {
          method: "PUT",
          headers: jsonHeaders(token),
          body: JSON.stringify({ tags: merged }),
        });
        if (putRes.ok) {
          console.log(
            `[AGENT_CRM_NEWSLETTER] Duplicate on create; merged tag onto ${target.id}` +
              (fromMeta ? " (used meta.contactId)" : "")
          );
        } else {
          console.error("[AGENT_CRM_NEWSLETTER] Merge after duplicate failed:", await putRes.text());
        }
      } else {
        console.error("[AGENT_CRM_NEWSLETTER] Duplicate but could not resolve contact:", errText);
      }
      return;
    }

    console.error("[AGENT_CRM_NEWSLETTER] Create contact failed:", postRes.status, errText);
  } catch (e) {
    console.error("[AGENT_CRM_NEWSLETTER] applyNewsletterTag error:", e);
  }
}

/**
 * On unsubscribe: remove `newsletter_subscribed` from contact tags (other tags preserved).
 */
export async function agentCrmRemoveNewsletterTag(params: { email: string }): Promise<void> {
  const cred = getCredentials();
  if ("skip" in cred) {
    return;
  }

  const { token, locationId } = cred;
  const email = params.email.toLowerCase().trim();
  const tag = getNewsletterCrmTag();

  try {
    const existing = await findContactByEmail(email, locationId, token);
    if (!existing) {
      console.log("[AGENT_CRM_NEWSLETTER] No CRM contact for unsubscribe:", email);
      return;
    }

    const next = existing.tags.filter((t) => t !== tag);
    if (next.length === existing.tags.length) {
      console.log(`[AGENT_CRM_NEWSLETTER] Tag "${tag}" not present on ${existing.id}, skip update`);
      return;
    }

    const putRes = await fetch(`${BASE_URL}/contacts/${existing.id}`, {
      method: "PUT",
      headers: jsonHeaders(token),
      body: JSON.stringify({ tags: next }),
    });

    if (!putRes.ok) {
      console.error(
        "[AGENT_CRM_NEWSLETTER] Failed to remove newsletter tag:",
        putRes.status,
        await putRes.text()
      );
      return;
    }
    console.log(`[AGENT_CRM_NEWSLETTER] Removed tag "${tag}" from contact ${existing.id}`);
  } catch (e) {
    console.error("[AGENT_CRM_NEWSLETTER] removeNewsletterTag error:", e);
  }
}
