/**
 * Typed browser-side wrapper for the shared intake API.
 *
 * Every call is scoped by `lob` because all engine lines share one `/api/intake/[lob]/**` route
 * tree — the caller passes the slug it was rendered for, so a Dental form can never PATCH a Life
 * session even if it somehow held the token.
 */

import type {
  FileRef,
  IntakeData,
  IntakeSession,
  IntakeStatus,
  IntakeSummary,
} from "@/lib/intake-core/types";

/** Route base for one line of business — every call below hangs off this. */
const base = (lob: string): string => `/api/intake/${lob}`;

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // 401 no longer means "sign in" for clients — the form is token-scoped and passwordless, so a
    // non-JSON 401 here is an agent-only endpoint being hit without a session.
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
  lob: string,
  opts: { search?: string; status?: IntakeStatus; page?: number; limit?: number } = {}
): Promise<{ sessions: IntakeSummary[]; pagination: IntakePagination }> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.status) params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const data = await parseJson<{ success: boolean; sessions: IntakeSummary[]; pagination: IntakePagination }>(
    await fetch(`${base(lob)}${qs ? `?${qs}` : ""}`, { credentials: "same-origin" })
  );
  return { sessions: data.sessions, pagination: data.pagination };
}

export async function deleteIntake(lob: string, token: string): Promise<void> {
  await parseJson<{ success: boolean }>(
    await fetch(`${base(lob)}/${token}`, {
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

export async function searchCrmContacts(lob: string, query: string): Promise<CrmContactMatch[]> {
  const params = new URLSearchParams({ contactSearch: query });
  const data = await parseJson<{ success: boolean; contacts: CrmContactMatch[] }>(
    await fetch(`${base(lob)}?${params.toString()}`, { credentials: "same-origin" })
  );
  return data.contacts ?? [];
}

export async function createIntake(lob: string, input: {
  crmContactId?: string;
  email?: string;
  phone?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
}): Promise<IntakeSummary> {
  const data = await parseJson<{ success: boolean; session: IntakeSummary }>(
    await fetch(base(lob), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
  return data.session;
}

export async function resetIntakeLink(lob: string, token: string): Promise<IntakeSummary> {
  const data = await parseJson<{ success: boolean; session: IntakeSummary }>(
    await fetch(`${base(lob)}/${token}/reset`, {
      method: "POST",
      credentials: "same-origin",
    })
  );
  return data.session;
}

export async function reopenIntake(lob: string, token: string, allow: boolean): Promise<IntakeSummary> {
  const data = await parseJson<{ success: boolean; session: IntakeSummary }>(
    await fetch(`${base(lob)}/${token}/reopen`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow }),
    })
  );
  return data.session;
}

export async function sendIntakeLink(lob: string, token: string): Promise<IntakeSummary> {
  const data = await parseJson<{ success: boolean; session: IntakeSummary }>(
    await fetch(`${base(lob)}/${token}/send-link`, {
      method: "POST",
      credentials: "same-origin",
    })
  );
  return data.session;
}

export async function fetchIntake(lob: string, token: string): Promise<IntakeSession> {
  const data = await parseJson<{ success: boolean; session: IntakeSession }>(
    await fetch(`${base(lob)}/${token}`, { credentials: "same-origin" })
  );
  return data.session;
}

/**
 * Autosave: send only the answers that changed (`{ key: value }`, top-level keys). The server
 * merges them into the stored answers, so keys left out are kept. `keepalive` lets the request
 * outlive the page (tab hidden or closing).
 */
export async function saveIntakePatch(
  lob: string,
  token: string,
  patch: IntakeData,
  opts: { keepalive?: boolean } = {}
): Promise<IntakeSession> {
  const data = await parseJson<{ success: boolean; session: IntakeSession }>(
    await fetch(`${base(lob)}/${token}/patch`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch }),
      keepalive: opts.keepalive ?? false,
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

export async function uploadIntakeFile(
  lob: string,
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
    await fetch(`${base(lob)}/${token}/files`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    })
  );
  return { files: data.files };
}

export async function removeIntakeFile(
  lob: string,
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
    await fetch(`${base(lob)}/${token}/files?${params.toString()}`, {
      method: "DELETE",
      credentials: "same-origin",
    })
  );
  return { files: data.files };
}

export async function completeIntake(
  lob: string,
  token: string
): Promise<{ success: boolean; missing?: string[]; message?: string; code?: string }> {
  const res = await fetch(`${base(lob)}/${token}/complete`, {
    method: "POST",
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      missing: data?.missing,
      message: data?.error ?? "Failed to complete.",
      code: typeof data?.code === "string" ? data.code : undefined,
    };
  }
  return { success: true };
}

/**
 * One sensitive value of an agent's application, in full, for the agent who owns it (audited on the
 * server). `field` is "ssn" or "dependents.ssn" with `rowIndex`. Never cached.
 */
export async function revealIntakeValue(
  lob: string,
  token: string,
  target: { field: string; rowIndex?: number }
): Promise<string> {
  const data = await parseJson<{ success: boolean; value: string }>(
    await fetch(`${base(lob)}/${token}/reveal`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    })
  );
  return typeof data.value === "string" ? data.value : "";
}

/** The agent's "Entered in Impact": erases the application's sensitive values (completed only). */
export async function markEnteredInImpact(lob: string, token: string): Promise<{ enteredInImpactAt: string }> {
  const data = await parseJson<{ success: boolean; enteredInImpactAt: string }>(
    await fetch(`${base(lob)}/${token}/purge`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
  );
  return { enteredInImpactAt: data.enteredInImpactAt };
}
