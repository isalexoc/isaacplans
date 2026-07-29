/** Typed client wrapper for the ACA intake API (browser-side). */

import type { AcaIntakeData } from "@/lib/aca-intake/schema";
import type { AcaIntakeSession, AcaIntakeSummary, AcaIntakeStatus } from "@/lib/aca-intake/types";
import type { FileRef } from "@/lib/aca-intake/fields";

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      res.status === 401
        ? "Please sign in to continue."
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

export type AcaIntakePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export async function listAcaIntakes(
  opts: { search?: string; status?: AcaIntakeStatus; page?: number; limit?: number } = {}
): Promise<{ sessions: AcaIntakeSummary[]; pagination: AcaIntakePagination }> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.status) params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await parseJson<{ success: boolean; sessions: AcaIntakeSummary[]; pagination: AcaIntakePagination }>(
    await fetch(`/api/aca-intake${qs ? `?${qs}` : ""}`, { credentials: "same-origin" })
  );
  return { sessions: data.sessions, pagination: data.pagination };
}

export async function deleteAcaIntake(token: string): Promise<void> {
  await parseJson<{ success: boolean }>(
    await fetch(`/api/aca-intake/${token}`, {
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
    await fetch(`/api/aca-intake?${params.toString()}`, { credentials: "same-origin" })
  );
  return data.contacts ?? [];
}

export async function createAcaIntake(input: {
  crmContactId?: string;
  email?: string;
  phone?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
}): Promise<AcaIntakeSummary> {
  const data = await parseJson<{ success: boolean; session: AcaIntakeSummary }>(
    await fetch("/api/aca-intake", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  return data.session;
}

export async function resetAcaIntakeLink(token: string): Promise<AcaIntakeSummary> {
  const data = await parseJson<{ success: boolean; session: AcaIntakeSummary }>(
    await fetch(`/api/aca-intake/${token}/reset`, {
      method: "POST",
      credentials: "same-origin",
    })
  );
  return data.session;
}

export async function reopenAcaIntake(token: string, allow: boolean): Promise<AcaIntakeSummary> {
  const data = await parseJson<{ success: boolean; session: AcaIntakeSummary }>(
    await fetch(`/api/aca-intake/${token}/reopen`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow }),
    })
  );
  return data.session;
}

export async function sendAcaIntakeLink(token: string): Promise<AcaIntakeSummary> {
  const data = await parseJson<{ success: boolean; session: AcaIntakeSummary }>(
    await fetch(`/api/aca-intake/${token}/send-link`, {
      method: "POST",
      credentials: "same-origin",
    })
  );
  return data.session;
}

export async function fetchAcaIntake(token: string): Promise<AcaIntakeSession> {
  const data = await parseJson<{ success: boolean; session: AcaIntakeSession }>(
    await fetch(`/api/aca-intake/${token}`, { credentials: "same-origin" })
  );
  return data.session;
}

export async function saveAcaIntakeData(
  token: string,
  formData: AcaIntakeData
): Promise<AcaIntakeSession> {
  const data = await parseJson<{ success: boolean; session: AcaIntakeSession }>(
    await fetch(`/api/aca-intake/${token}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: formData }),
    })
  );
  return data.session;
}

/** Where a file upload lands: a top-level field, or a sub-field of one repeater row. */
export type FileTargetRef = {
  fieldKey: string;
  repeaterKey?: string;
  rowIndex?: number;
};

export async function uploadAcaIntakeFile(
  token: string,
  target: FileTargetRef,
  file: File
): Promise<{ files: FileRef[] }> {
  const form = new FormData();
  form.append("file", file);
  if (target.repeaterKey !== undefined && target.rowIndex !== undefined) {
    form.append("repeaterKey", target.repeaterKey);
    form.append("rowIndex", String(target.rowIndex));
    form.append("rowField", target.fieldKey);
  } else {
    form.append("fieldKey", target.fieldKey);
  }
  const data = await parseJson<{ success: boolean; files: FileRef[] }>(
    await fetch(`/api/aca-intake/${token}/files`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    })
  );
  return { files: data.files };
}

export async function removeAcaIntakeFile(
  token: string,
  target: FileTargetRef,
  url: string
): Promise<{ files: FileRef[] }> {
  const params = new URLSearchParams({ url });
  if (target.repeaterKey !== undefined && target.rowIndex !== undefined) {
    params.set("repeaterKey", target.repeaterKey);
    params.set("rowIndex", String(target.rowIndex));
    params.set("rowField", target.fieldKey);
  } else {
    params.set("field", target.fieldKey);
  }
  const data = await parseJson<{ success: boolean; files: FileRef[] }>(
    await fetch(`/api/aca-intake/${token}/files?${params.toString()}`, {
      method: "DELETE",
      credentials: "same-origin",
    })
  );
  return { files: data.files };
}

export async function completeAcaIntake(
  token: string
): Promise<{ success: boolean; missing?: string[]; message?: string }> {
  const res = await fetch(`/api/aca-intake/${token}/complete`, {
    method: "POST",
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, missing: data?.missing, message: data?.error ?? "Failed to complete." };
  }
  return { success: true };
}
