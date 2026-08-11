import "server-only";
import {
  AGENT_CRM_API_BASE,
  agentCrmAuthHeaders,
  agentCrmGetBaseCredentials,
} from "@/lib/agent-crm-contacts";

/**
 * Read a contact's notes from Agent CRM (GHL). The write side already lives in
 * lib/agent-crm-call-summary.ts (`createContactNote`); this is the read counterpart, used by the
 * mailing-label letter generator to personalize a draft from what was actually said on past calls.
 *
 * Non-throwing by design: a letter is still useful without call history, so every failure path
 * returns an empty list rather than blowing up the request.
 */

export type AgentCrmNote = {
  id: string;
  body: string;
  /** ISO timestamp when available; notes are returned newest-first after sorting. */
  createdAt: string | null;
};

type RawNote = {
  id?: unknown;
  body?: unknown;
  dateAdded?: unknown;
  createdAt?: unknown;
};

function unwrapNotes(raw: unknown): RawNote[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  for (const key of ["notes", "data"] as const) {
    const value = r[key];
    if (Array.isArray(value)) return value as RawNote[];
  }
  return Array.isArray(raw) ? (raw as RawNote[]) : [];
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function agentCrmFetchContactNotes(
  contactId: string,
  token?: string
): Promise<AgentCrmNote[]> {
  const trimmed = contactId?.trim();
  if (!trimmed) return [];

  const authToken = token ?? agentCrmGetBaseCredentials()?.token;
  if (!authToken) return [];

  try {
    const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${encodeURIComponent(trimmed)}/notes`, {
      method: "GET",
      headers: agentCrmAuthHeaders(authToken),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[agent-crm-notes] GET notes failed (${res.status}) for ${trimmed}`);
      return [];
    }

    const notes = unwrapNotes(await res.json())
      .map((n) => ({
        id: typeof n.id === "string" ? n.id : "",
        body: typeof n.body === "string" ? n.body.trim() : "",
        createdAt: toIso(n.dateAdded) ?? toIso(n.createdAt),
      }))
      .filter((n) => n.body.length > 0);

    // Newest first, so a truncated context window keeps the most recent conversations.
    notes.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return notes;
  } catch (error) {
    console.warn("[agent-crm-notes] Could not read notes:", error);
    return [];
  }
}
