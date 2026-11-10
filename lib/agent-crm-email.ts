/**
 * Send an email to a CRM contact through the Agent CRM (GoHighLevel) Conversations API, so it is
 * delivered by the CRM and shows up in the contact's conversation like any other message.
 *
 * Shared by the Impact welcome and the ACA application review confirmation. Callers word their
 * own error messages from `reason`, because only they know what "nothing was sent" means for them.
 *
 * Needs the `conversations/message.write` scope on the Private Integration key (`AGENT_CRM_PI`).
 * Server-only.
 */

import "server-only";
import { AGENT_CRM_API_BASE } from "@/lib/agent-crm-contacts";

/** The Conversations endpoints are documented against this API version. */
export const CONVERSATIONS_API_VERSION = "2021-04-15";
const DEFAULT_TIMEOUT_MS = 20_000;

export type CrmEmailResult =
  | { ok: true; messageId: string | null; conversationId: string | null }
  | {
      ok: false;
      /** `scope`: the key may not send (401/403). `rejected`: any other non-2xx. `network`: no answer. */
      reason: "scope" | "rejected" | "network";
      status: number | null;
      /** The CRM's own `message`, when it sent one. */
      detail: string;
    };

export async function sendCrmEmail(params: {
  contactId: string;
  token: string;
  subject: string;
  html: string;
  /** Publicly reachable URLs (the CRM fetches them). Omitted from the request when empty. */
  attachments?: string[];
  /** Sender address; when empty, the CRM uses its default sender. */
  emailFrom?: string | null;
  logPrefix?: string;
  timeoutMs?: number;
}): Promise<CrmEmailResult> {
  const { contactId, token, subject, html, attachments, emailFrom, logPrefix = "[AGENT_CRM_EMAIL]" } = params;
  try {
    const res = await fetch(`${AGENT_CRM_API_BASE}/conversations/messages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Version: CONVERSATIONS_API_VERSION,
      },
      body: JSON.stringify({
        type: "Email",
        contactId,
        subject,
        html,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
        ...(emailFrom ? { emailFrom } : {}),
      }),
      signal: AbortSignal.timeout(params.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    // Never let an unreadable body turn a sent email into a reported failure.
    const text = await res.text().catch(() => "");
    if (res.ok) {
      let messageId: string | null = null;
      let conversationId: string | null = null;
      try {
        const parsed = JSON.parse(text) as { messageId?: unknown; conversationId?: unknown };
        messageId = typeof parsed.messageId === "string" ? parsed.messageId : null;
        conversationId = typeof parsed.conversationId === "string" ? parsed.conversationId : null;
      } catch {
        /* 2xx without a JSON body still means sent */
      }
      return { ok: true, messageId, conversationId };
    }
    console.warn(`${logPrefix} Email send rejected:`, res.status, text.slice(0, 300));
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      detail = typeof parsed.message === "string" ? parsed.message : "";
    } catch {
      /* not JSON */
    }
    return {
      ok: false,
      reason: res.status === 401 || res.status === 403 ? "scope" : "rejected",
      status: res.status,
      detail,
    };
  } catch (error) {
    console.warn(`${logPrefix} Email send failed:`, error);
    return { ok: false, reason: "network", status: null, detail: "" };
  }
}
