/** Typed client wrapper for the IUL intake API (browser-side). */

import type { IntakeData } from "@/lib/iul-intake/schema";
import type { IntakeSession, IntakeSummary, IntakeStatus } from "@/lib/iul-intake/types";

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      res.status === 401
        ? "You don't have access to this. Please use the link we sent you."
        : "Server returned an unexpected response. Try refreshing the page."
    );
  }
  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export type IntakePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export async function listIntakes(
  opts: { search?: string; status?: IntakeStatus; page?: number; limit?: number } = {}
): Promise<{ sessions: IntakeSummary[]; pagination: IntakePagination }> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.status) params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await parseJson<{ success: boolean; sessions: IntakeSummary[]; pagination: IntakePagination }>(
    await fetch(`/api/iul-intake${qs ? `?${qs}` : ""}`, { credentials: "same-origin" })
  );
  return { sessions: data.sessions, pagination: data.pagination };
}

export async function deleteIntake(token: string): Promise<void> {
  await parseJson<{ success: boolean }>(
    await fetch(`/api/iul-intake/${token}`, {
      method: "DELETE",
      credentials: "same-origin",
    })
  );
}

export type CrmContactMatch = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export async function searchCrmContacts(query: string): Promise<CrmContactMatch[]> {
  const params = new URLSearchParams({ contactSearch: query });
  const data = await parseJson<{ success: boolean; contacts: CrmContactMatch[] }>(
    await fetch(`/api/iul-intake?${params.toString()}`, { credentials: "same-origin" })
  );
  return data.contacts ?? [];
}

export async function createIntake(input: {
  crmContactId?: string;
  email?: string;
  phone?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
}): Promise<IntakeSummary> {
  const data = await parseJson<{ success: boolean; session: IntakeSummary }>(
    await fetch("/api/iul-intake", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  return data.session;
}

export async function resetIntakeLink(token: string): Promise<IntakeSummary> {
  const data = await parseJson<{ success: boolean; session: IntakeSummary }>(
    await fetch(`/api/iul-intake/${token}/reset`, {
      method: "POST",
      credentials: "same-origin",
    })
  );
  return data.session;
}

export async function reopenIntake(token: string, allow: boolean): Promise<IntakeSummary> {
  const data = await parseJson<{ success: boolean; session: IntakeSummary }>(
    await fetch(`/api/iul-intake/${token}/reopen`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow }),
    })
  );
  return data.session;
}

export async function sendIntakeLink(token: string): Promise<IntakeSummary> {
  const data = await parseJson<{ success: boolean; session: IntakeSummary }>(
    await fetch(`/api/iul-intake/${token}/send-link`, {
      method: "POST",
      credentials: "same-origin",
    })
  );
  return data.session;
}

export async function fetchIntake(token: string): Promise<IntakeSession> {
  const data = await parseJson<{ success: boolean; session: IntakeSession }>(
    await fetch(`/api/iul-intake/${token}`, { credentials: "same-origin" })
  );
  return data.session;
}

export async function saveIntakeData(token: string, formData: IntakeData): Promise<IntakeSession> {
  const data = await parseJson<{ success: boolean; session: IntakeSession }>(
    await fetch(`/api/iul-intake/${token}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: formData }),
    })
  );
  return data.session;
}

export async function uploadIntakeFile(
  token: string,
  fieldKey: string,
  file: File
): Promise<{ files: import("@/lib/iul-intake/fields").FileRef[] }> {
  const form = new FormData();
  form.append("file", file);
  form.append("fieldKey", fieldKey);
  const data = await parseJson<{ success: boolean; files: import("@/lib/iul-intake/fields").FileRef[] }>(
    await fetch(`/api/iul-intake/${token}/files`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    })
  );
  return { files: data.files };
}

export async function removeIntakeFile(
  token: string,
  fieldKey: string,
  url: string
): Promise<{ files: import("@/lib/iul-intake/fields").FileRef[] }> {
  const params = new URLSearchParams({ field: fieldKey, url });
  const data = await parseJson<{ success: boolean; files: import("@/lib/iul-intake/fields").FileRef[] }>(
    await fetch(`/api/iul-intake/${token}/files?${params.toString()}`, {
      method: "DELETE",
      credentials: "same-origin",
    })
  );
  return { files: data.files };
}

export async function completeIntake(
  token: string
): Promise<{ success: boolean; missing?: string[]; message?: string }> {
  const res = await fetch(`/api/iul-intake/${token}/complete`, {
    method: "POST",
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, missing: data?.missing, message: data?.error ?? "Failed to complete." };
  }
  return { success: true };
}

/**
 * Mint an instant meeting link for an intake and hand it to the CRM in one press.
 *
 * The dashboard's shortcut for the common case. The full two-option control lives in the intake
 * form's panel; putting both there and here would make an already-crowded row unreadable.
 *
 * Returns the link so the caller can copy it — a send that reaches the CRM is not proof the client
 * saw it, and the agent usually wants the URL to hand over on the call anyway.
 */
export async function startInstantMeeting(
  intakeToken: string
): Promise<{ id: string; url: string; sent: boolean }> {
  const created = await parseJson<{ success: boolean; meeting: { id: string; url: string } }>(
    await fetch("/api/crankwheel/meetings", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "now", intakeToken }),
    })
  );

  // The send is reported, not assumed. Until the `meeting_link` CRM field is provisioned it fails,
  // and an agent who believes a text went out when it did not is worse off than one who knows to
  // paste the link themselves.
  let sent = false;
  try {
    const res = await fetch(`/api/crankwheel/meetings/${created.meeting.id}/send`, {
      method: "POST",
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({}));
    sent = Boolean(res.ok && json?.success);
  } catch {
    sent = false;
  }

  return { ...created.meeting, sent };
}
