/**
 * Syncs newsletter subscription state to Agent CRM (LeadConnector API) using the same
 * Private Integration as create-contact: tag `newsletter_subscribed` on confirm, remove on unsubscribe.
 */

import {
  AGENT_CRM_API_BASE,
  agentCrmFetchContactById,
  agentCrmFindContactByEmail,
  agentCrmGetBaseCredentials,
  agentCrmIsDuplicateContactError,
  agentCrmJsonHeaders,
  type AgentCrmCreateContactErrorBody,
} from "@/lib/agent-crm-contacts";

const LOG = "[AGENT_CRM_NEWSLETTER]";

/** Default tag for smart lists in Agent CRM; override with AGENT_CRM_NEWSLETTER_TAG */
function getNewsletterCrmTag(): string {
  return process.env.AGENT_CRM_NEWSLETTER_TAG?.trim() || "newsletter_subscribed";
}

function getCredentials():
  | { token: string; locationId: string }
  | { skip: true; reason: string } {
  const base = agentCrmGetBaseCredentials();
  if (!base) {
    return { skip: true, reason: "AGENT_CRM_PI or AGENT_CRM_LOCATION_ID not set" };
  }
  if (process.env.AGENT_CRM_SYNC_NEWSLETTER === "false") {
    return { skip: true, reason: "AGENT_CRM_SYNC_NEWSLETTER is false" };
  }
  return base;
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
      console.log(`${LOG} Skip sync:`, cred.reason);
    }
    return;
  }

  const { token, locationId } = cred;
  const email = params.email.toLowerCase().trim();
  const tag = getNewsletterCrmTag();

  try {
    const existing = await agentCrmFindContactByEmail(email, locationId, token, LOG);

    if (existing) {
      const merged = [...new Set([...existing.tags, tag])];
      const putRes = await fetch(`${AGENT_CRM_API_BASE}/contacts/${existing.id}`, {
        method: "PUT",
        headers: agentCrmJsonHeaders(token),
        body: JSON.stringify({ tags: merged }),
      });
      if (!putRes.ok) {
        console.error(`${LOG} Failed to update contact tags:`, putRes.status, await putRes.text());
        return;
      }
      console.log(`${LOG} Applied tag "${tag}" to existing contact ${existing.id}`);
      return;
    }

    const body: Record<string, unknown> = {
      email,
      locationId,
      source: "newsletter",
      tags: [tag],
      firstName: "Newsletter",
      lastName: "Subscriber",
    };

    const postRes = await fetch(`${AGENT_CRM_API_BASE}/contacts/`, {
      method: "POST",
      headers: agentCrmJsonHeaders(token),
      body: JSON.stringify(body),
    });

    if (postRes.ok) {
      console.log(`${LOG} Created contact with tag "${tag}" for ${email}`);
      return;
    }

    const errText = await postRes.text();
    let errJson: AgentCrmCreateContactErrorBody = {};
    try {
      errJson = JSON.parse(errText) as AgentCrmCreateContactErrorBody;
    } catch {
      /* ignore */
    }

    if (agentCrmIsDuplicateContactError(postRes.status, errJson)) {
      const fromMeta = errJson.meta?.contactId;
      let target: { id: string; tags: string[] } | null = null;

      if (fromMeta) {
        target = await agentCrmFetchContactById(fromMeta, locationId, token);
      }
      if (!target) {
        target = await agentCrmFindContactByEmail(email, locationId, token, LOG);
      }

      if (target) {
        const merged = [...new Set([...target.tags, tag])];
        const putRes = await fetch(`${AGENT_CRM_API_BASE}/contacts/${target.id}`, {
          method: "PUT",
          headers: agentCrmJsonHeaders(token),
          body: JSON.stringify({ tags: merged }),
        });
        if (putRes.ok) {
          console.log(
            `${LOG} Duplicate on create; merged tag onto ${target.id}` + (fromMeta ? " (used meta.contactId)" : "")
          );
        } else {
          console.error(`${LOG} Merge after duplicate failed:`, await putRes.text());
        }
      } else {
        console.error(`${LOG} Duplicate but could not resolve contact:`, errText);
      }
      return;
    }

    console.error(`${LOG} Create contact failed:`, postRes.status, errText);
  } catch (e) {
    console.error(`${LOG} applyNewsletterTag error:`, e);
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
    const existing = await agentCrmFindContactByEmail(email, locationId, token, LOG);
    if (!existing) {
      console.log(`${LOG} No CRM contact for unsubscribe:`, email);
      return;
    }

    const next = existing.tags.filter((t) => t !== tag);
    if (next.length === existing.tags.length) {
      console.log(`${LOG} Tag "${tag}" not present on ${existing.id}, skip update`);
      return;
    }

    const putRes = await fetch(`${AGENT_CRM_API_BASE}/contacts/${existing.id}`, {
      method: "PUT",
      headers: agentCrmJsonHeaders(token),
      body: JSON.stringify({ tags: next }),
    });

    if (!putRes.ok) {
      console.error(`${LOG} Failed to remove newsletter tag:`, putRes.status, await putRes.text());
      return;
    }
    console.log(`${LOG} Removed tag "${tag}" from contact ${existing.id}`);
  } catch (e) {
    console.error(`${LOG} removeNewsletterTag error:`, e);
  }
}
