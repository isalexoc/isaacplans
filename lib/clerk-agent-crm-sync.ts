/**
 * Upserts a LeadConnector contact when a Clerk user is created or updated (webhook).
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

const LOG = "[AGENT_CRM_CLERK]";

function getClerkTag(): string {
  return process.env.AGENT_CRM_CLERK_TAG?.trim() || "clerk_user";
}

function getCredentials(): { token: string; locationId: string } | null {
  if (process.env.AGENT_CRM_SYNC_CLERK === "false") {
    return null;
  }
  return agentCrmGetBaseCredentials();
}

type ClerkEmailAddr = { id: string; email_address: string };
type ClerkPhone = { id: string; phone_number: string };

function primaryEmail(data: {
  email_addresses?: ClerkEmailAddr[];
  primary_email_address_id?: string | null;
}): string | null {
  const list = data.email_addresses ?? [];
  const primaryId = data.primary_email_address_id;
  const hit = primaryId ? list.find((e) => e.id === primaryId) : null;
  const addr = hit ?? list[0];
  const email = addr?.email_address?.toLowerCase().trim();
  return email || null;
}

function primaryPhone(data: {
  phone_numbers?: ClerkPhone[];
  primary_phone_number_id?: string | null;
}): string | undefined {
  const list = data.phone_numbers ?? [];
  const primaryId = data.primary_phone_number_id;
  const hit = primaryId ? list.find((p) => p.id === primaryId) : null;
  const p = hit ?? list[0];
  return p?.phone_number?.trim() || undefined;
}

/**
 * Sync Clerk user JSON (`evt.data`) to Agent CRM: create or update contact, merge `clerk_user` tag.
 */
export async function syncClerkUserToAgentCrm(userData: Record<string, unknown>): Promise<void> {
  const cred = getCredentials();
  if (!cred) {
    if (process.env.NODE_ENV === "development") {
      console.log(`${LOG} Skip: AGENT_CRM_SYNC_CLERK=false or missing AGENT_CRM_PI / AGENT_CRM_LOCATION_ID`);
    }
    return;
  }

  const { token, locationId } = cred;
  const tag = getClerkTag();

  const email = primaryEmail(userData as Parameters<typeof primaryEmail>[0]);
  if (!email) {
    console.warn(`${LOG} No email on Clerk user, skip CRM sync`, { id: userData.id });
    return;
  }

  const fnRaw = typeof userData.first_name === "string" ? userData.first_name.trim() : "";
  const lnRaw = typeof userData.last_name === "string" ? userData.last_name.trim() : "";
  const firstName = fnRaw || "Website";
  const lastName = lnRaw || "Member";
  const phone = primaryPhone(userData as Parameters<typeof primaryPhone>[0]);
  const clerkUserId = typeof userData.id === "string" ? userData.id : "";

  const payloadBase: Record<string, unknown> = {
    email,
    locationId,
    source: "clerk",
    firstName,
    lastName,
    tags: [tag],
  };
  if (phone) payloadBase.phone = phone;

  try {
    const existing = await agentCrmFindContactByEmail(email, locationId, token, LOG);

    if (existing) {
      const mergedTags = [...new Set([...existing.tags, tag])];
      const putBody: Record<string, unknown> = {
        firstName,
        lastName,
        email,
        tags: mergedTags,
        source: "clerk",
      };
      if (phone) putBody.phone = phone;

      const putRes = await fetch(`${AGENT_CRM_API_BASE}/contacts/${existing.id}`, {
        method: "PUT",
        headers: agentCrmJsonHeaders(token),
        body: JSON.stringify(putBody),
      });
      if (!putRes.ok) {
        console.error(`${LOG} Update contact failed:`, putRes.status, await putRes.text());
        return;
      }
      console.log(`${LOG} Updated contact ${existing.id} for Clerk user ${clerkUserId || email}`);
      return;
    }

    const postRes = await fetch(`${AGENT_CRM_API_BASE}/contacts/`, {
      method: "POST",
      headers: agentCrmJsonHeaders(token),
      body: JSON.stringify({
        ...payloadBase,
        tags: [tag],
      }),
    });

    if (postRes.ok) {
      console.log(`${LOG} Created contact for Clerk user ${clerkUserId || email}`);
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
      let target = fromMeta ? await agentCrmFetchContactById(fromMeta, locationId, token) : null;
      if (!target) {
        target = await agentCrmFindContactByEmail(email, locationId, token, LOG);
      }
      if (!target) {
        console.error(`${LOG} Duplicate create but could not load contact:`, errText);
        return;
      }
      const mergedTags = [...new Set([...target.tags, tag])];
      const putBody: Record<string, unknown> = {
        firstName,
        lastName,
        email,
        tags: mergedTags,
        source: "clerk",
      };
      if (phone) putBody.phone = phone;

      const putRes = await fetch(`${AGENT_CRM_API_BASE}/contacts/${target.id}`, {
        method: "PUT",
        headers: agentCrmJsonHeaders(token),
        body: JSON.stringify(putBody),
      });
      if (putRes.ok) {
        console.log(`${LOG} Merged after duplicate onto ${target.id}${fromMeta ? " (meta.contactId)" : ""}`);
      } else {
        console.error(`${LOG} Merge after duplicate failed:`, await putRes.text());
      }
      return;
    }

    console.error(`${LOG} Create contact failed:`, postRes.status, errText);
  } catch (e) {
    console.error(`${LOG} sync error:`, e);
  }
}
