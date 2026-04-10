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

async function findContactByEmail(
  email: string,
  locationId: string,
  token: string
): Promise<{ id: string; tags: string[] } | null> {
  const url = `${BASE_URL}/contacts/?email=${encodeURIComponent(email)}&locationId=${encodeURIComponent(locationId)}`;
  const res = await fetch(url, { method: "GET", headers: authHeaders(token) });
  if (!res.ok) {
    console.warn("[AGENT_CRM_NEWSLETTER] Contact search failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const contacts = data.contacts ?? data;
  if (!Array.isArray(contacts) || contacts.length === 0) return null;
  const lower = email.toLowerCase();
  const match =
    contacts.find((c: { email?: string }) => c.email?.toLowerCase() === lower) ?? contacts[0];
  if (!match?.id) return null;
  return { id: match.id, tags: normalizeContactTags(match.tags) };
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
    let errJson: { message?: string } = {};
    try {
      errJson = JSON.parse(errText);
    } catch {
      /* ignore */
    }
    const msg = (errJson.message || errText || "").toLowerCase();
    const looksDuplicate =
      postRes.status === 409 ||
      msg.includes("duplicate") ||
      msg.includes("already exist");

    if (looksDuplicate) {
      const again = await findContactByEmail(email, locationId, token);
      if (again) {
        const merged = [...new Set([...again.tags, tag])];
        const putRes = await fetch(`${BASE_URL}/contacts/${again.id}`, {
          method: "PUT",
          headers: jsonHeaders(token),
          body: JSON.stringify({ tags: merged }),
        });
        if (putRes.ok) {
          console.log(`[AGENT_CRM_NEWSLETTER] Duplicate on create; merged tag onto ${again.id}`);
        } else {
          console.error("[AGENT_CRM_NEWSLETTER] Merge after duplicate failed:", await putRes.text());
        }
      } else {
        console.error("[AGENT_CRM_NEWSLETTER] Duplicate but contact not found by email:", errText);
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
