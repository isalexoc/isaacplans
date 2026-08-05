/** Typed client wrapper for the Final Expense intake API (browser-side). */

import type { FeIntakeData } from "@/lib/fe-intake/schema";
import type { FeIntakeSession, FeIntakeSummary, FeIntakeStatus } from "@/lib/fe-intake/types";

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

export type FeIntakePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export async function listFeIntakes(
  opts: { search?: string; status?: FeIntakeStatus; page?: number; limit?: number } = {}
): Promise<{ sessions: FeIntakeSummary[]; pagination: FeIntakePagination }> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.status) params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await parseJson<{ success: boolean; sessions: FeIntakeSummary[]; pagination: FeIntakePagination }>(
    await fetch(`/api/fe-intake${qs ? `?${qs}` : ""}`, { credentials: "same-origin" })
  );
  return { sessions: data.sessions, pagination: data.pagination };
}

export async function deleteFeIntake(token: string): Promise<void> {
  await parseJson<{ success: boolean }>(
    await fetch(`/api/fe-intake/${token}`, {
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
    await fetch(`/api/fe-intake?${params.toString()}`, { credentials: "same-origin" })
  );
  return data.contacts ?? [];
}

export async function createFeIntake(input: {
  crmContactId?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
}): Promise<FeIntakeSummary> {
  const data = await parseJson<{ success: boolean; session: FeIntakeSummary }>(
    await fetch("/api/fe-intake", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  return data.session;
}

export async function resetFeIntakeLink(token: string): Promise<FeIntakeSummary> {
  const data = await parseJson<{ success: boolean; session: FeIntakeSummary }>(
    await fetch(`/api/fe-intake/${token}/reset`, {
      method: "POST",
      credentials: "same-origin",
    })
  );
  return data.session;
}

export async function reopenFeIntake(token: string, allow: boolean): Promise<FeIntakeSummary> {
  const data = await parseJson<{ success: boolean; session: FeIntakeSummary }>(
    await fetch(`/api/fe-intake/${token}/reopen`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow }),
    })
  );
  return data.session;
}

export async function sendFeIntakeLink(token: string): Promise<FeIntakeSummary> {
  const data = await parseJson<{ success: boolean; session: FeIntakeSummary }>(
    await fetch(`/api/fe-intake/${token}/send-link`, {
      method: "POST",
      credentials: "same-origin",
    })
  );
  return data.session;
}

export async function fetchFeIntake(token: string): Promise<FeIntakeSession> {
  const data = await parseJson<{ success: boolean; session: FeIntakeSession }>(
    await fetch(`/api/fe-intake/${token}`, { credentials: "same-origin" })
  );
  return data.session;
}

export async function saveFeIntakeData(
  token: string,
  formData: FeIntakeData
): Promise<FeIntakeSession> {
  const data = await parseJson<{ success: boolean; session: FeIntakeSession }>(
    await fetch(`/api/fe-intake/${token}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: formData }),
    })
  );
  return data.session;
}

export async function completeFeIntake(
  token: string
): Promise<{ success: boolean; missing?: string[]; message?: string }> {
  const res = await fetch(`/api/fe-intake/${token}/complete`, {
    method: "POST",
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, missing: data?.missing, message: data?.error ?? "Failed to complete." };
  }
  return { success: true };
}

/** Proxies NIH RxTerms — free, keyless drug-name autocomplete. Returns display names. */
export async function searchMedications(query: string): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q });
  const data = await parseJson<{ success: boolean; results: string[] }>(
    await fetch(`/api/fe-intake/medications/search?${params.toString()}`, { credentials: "same-origin" })
  );
  return data.results ?? [];
}
