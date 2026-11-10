/**
 * Browser calls for the agent's confirmation dialog (admin routes under
 * /api/admin/aca-confirmation). Failures throw an Error carrying the server's sentence, like
 * lib/impact-enrollment/api-client.ts, except the one outcome the dialog handles as data: creating
 * a request while one is already waiting (409 pending_exists).
 */

import type {
  AcaConfirmationAction,
  AcaConfirmationBadge,
  AcaConfirmationBadgesResponse,
  AcaConfirmationCreateInput,
  AcaConfirmationCreateResponse,
  AcaConfirmationDetail,
  AcaConfirmationDetailResponse,
  AcaConfirmationPendingExistsResponse,
  AcaConfirmationRecord,
  AcaConfirmationRecordResponse,
} from "./types";

const BASE = "/api/admin/aca-confirmation";

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as (T & { success?: boolean; error?: string }) | null;
  if (!res.ok || !data || data.success !== true) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchAcaConfirmationBadges(contactIds: string[]): Promise<Record<string, AcaConfirmationBadge>> {
  if (contactIds.length === 0) return {};
  const res = await fetch(`${BASE}?contactIds=${encodeURIComponent(contactIds.join(","))}`, { cache: "no-store" });
  return (await readJson<AcaConfirmationBadgesResponse>(res)).badges;
}

export async function fetchAcaConfirmationDetail(contactId: string, intakeSessionId?: string): Promise<AcaConfirmationDetail> {
  const query = intakeSessionId ? `?intake=${encodeURIComponent(intakeSessionId)}` : "";
  const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}${query}`, { cache: "no-store" });
  return (await readJson<AcaConfirmationDetailResponse>(res)).detail;
}

export type CreateOutcome =
  | { kind: "created"; record: AcaConfirmationRecord; emailSent: boolean; emailError: string | null }
  | { kind: "pending_exists"; record: AcaConfirmationRecord; error: string };

export async function createAcaConfirmation(contactId: string, input: AcaConfirmationCreateInput): Promise<CreateOutcome> {
  const res = await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const data = (await res.json().catch(() => null)) as AcaConfirmationPendingExistsResponse | null;
    if (data?.code === "pending_exists" && data.record) {
      return { kind: "pending_exists", record: data.record, error: data.error };
    }
  }
  const data = await readJson<AcaConfirmationCreateResponse>(res);
  return { kind: "created", record: data.record, emailSent: data.emailSent, emailError: data.emailError };
}

export async function fetchAcaConfirmationRecord(id: string): Promise<AcaConfirmationRecord> {
  const res = await fetch(`${BASE}/requests/${encodeURIComponent(id)}`, { cache: "no-store" });
  return (await readJson<AcaConfirmationRecordResponse>(res)).record;
}

export async function actOnAcaConfirmation(
  id: string,
  action: AcaConfirmationAction
): Promise<{ record: AcaConfirmationRecord; emailSent?: boolean; emailError?: string | null }> {
  const res = await fetch(`${BASE}/requests/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = await readJson<AcaConfirmationRecordResponse>(res);
  return { record: data.record, emailSent: data.emailSent, emailError: data.emailError };
}

export function acaConfirmationPdfHref(id: string, download = false): string {
  return `${BASE}/requests/${encodeURIComponent(id)}/pdf${download ? "?download=1" : ""}`;
}
