/**
 * The three GHL calls Phone Finder makes: read the contact, write ONE custom field, add a tag.
 *
 * Not built on agentCrmUpdateContact / agentCrmAddContactTags because those have no timeout and log
 * GHL's raw error bodies. Only our one field is sent, never the whole customFields array: the same
 * single-field PUT that lib/intake-core/server.ts and lib/crankwheel/crm.ts already rely on, so a
 * stale read can never overwrite fields someone changed in between. The trigger checkbox is never
 * written here — the workflow's "Clear field data" step unticks it.
 */

import { AGENT_CRM_API_BASE, agentCrmAuthHeaders, agentCrmJsonHeaders } from "@/lib/agent-crm-contacts";

import { httpJson, type FetchLike } from "./http";
import { parseContactSnapshot, type ContactSnapshot } from "./inputs";

export type GhlReadResult =
  | { ok: true; contact: ContactSnapshot }
  | { ok: false; notFound: boolean; retryable: boolean; status: number };

export type GhlWriteResult = { ok: boolean; retryable: boolean; status: number };

export type GhlPort = {
  getContact(contactId: string): Promise<GhlReadResult>;
  writeTextField(contactId: string, fieldId: string, text: string): Promise<GhlWriteResult>;
  addTags(contactId: string, tags: string[]): Promise<boolean>;
};

function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

export function createGhlPort(options: { token: string; fetchImpl?: FetchLike; timeoutMs?: number }): GhlPort {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const http = { timeoutMs, fetchImpl: options.fetchImpl };
  const contactUrl = (id: string) => `${AGENT_CRM_API_BASE}/contacts/${encodeURIComponent(id)}`;

  return {
    async getContact(contactId) {
      const res = await httpJson(contactUrl(contactId), { method: "GET", headers: agentCrmAuthHeaders(options.token) }, http);
      if (res.status >= 200 && res.status < 300) {
        const contact = parseContactSnapshot(res.json);
        if (contact) return { ok: true, contact };
        return { ok: false, notFound: true, retryable: false, status: res.status };
      }
      const notFound = res.status === 400 || res.status === 404 || res.status === 422;
      return { ok: false, notFound, retryable: isRetryableStatus(res.status), status: res.status };
    },

    async writeTextField(contactId, fieldId, text) {
      const res = await httpJson(
        contactUrl(contactId),
        {
          method: "PUT",
          headers: agentCrmJsonHeaders(options.token),
          body: JSON.stringify({ customFields: [{ id: fieldId, field_value: text }] }),
        },
        http
      );
      const ok = res.status >= 200 && res.status < 300;
      return { ok, retryable: !ok && isRetryableStatus(res.status), status: res.status };
    },

    async addTags(contactId, tags) {
      if (tags.length === 0) return true;
      const res = await httpJson(
        `${contactUrl(contactId)}/tags`,
        { method: "POST", headers: agentCrmJsonHeaders(options.token), body: JSON.stringify({ tags }) },
        http
      );
      return res.status >= 200 && res.status < 300;
    },
  };
}
