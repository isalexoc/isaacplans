/**
 * Browser-side wrappers for the admin mailing-label endpoints. Kept free of server-only imports
 * so the admin components can import it directly.
 */

import type {
  LabelSheetOptions,
  LetterKind,
  MailingLabelInput,
  MailingLabelRecord,
  MailingLabelSettings,
  MailingLabelSource,
  MailingLabelStatus,
} from "./types";

const BASE = "/api/admin/mailing-labels";

type Envelope<T> = { success: boolean; error?: string } & T;

async function readJson<T>(res: Response): Promise<Envelope<T>> {
  const data = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export type FetchLabelsResult = {
  labels: MailingLabelRecord[];
  settings: MailingLabelSettings;
};

export async function fetchMailingLabels(filters: {
  status?: MailingLabelStatus | "all";
  source?: MailingLabelSource | "all";
  q?: string;
}): Promise<FetchLabelsResult> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.q?.trim()) params.set("q", filters.q.trim());

  const res = await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" });
  const data = await readJson<FetchLabelsResult>(res);
  return { labels: data.labels, settings: data.settings };
}

export async function createMailingLabelRequest(
  label: MailingLabelInput
): Promise<MailingLabelRecord> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  const data = await readJson<{ label: MailingLabelRecord }>(res);
  return data.label;
}

export async function updateMailingLabelRequest(
  id: string,
  label: Partial<MailingLabelInput> & { status?: MailingLabelStatus }
): Promise<MailingLabelRecord> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  const data = await readJson<{ label: MailingLabelRecord }>(res);
  return data.label;
}

export async function bulkMailingLabelAction(
  ids: string[],
  action: { status: MailingLabelStatus } | { action: "delete" }
): Promise<number> {
  const res = await fetch(BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, ...action }),
  });
  const data = await readJson<{ affected: number }>(res);
  return data.affected;
}

export type CrmContactSummary = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type CrmContactNative = CrmContactSummary & {
  address1: string;
  city: string;
  state: string;
  postalCode: string;
};

export async function searchCrmContacts(q: string): Promise<CrmContactSummary[]> {
  const res = await fetch(`${BASE}/crm-search?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });
  const data = await readJson<{ contacts: CrmContactSummary[] }>(res);
  return data.contacts;
}

export async function loadCrmContact(contactId: string): Promise<CrmContactNative> {
  const res = await fetch(`${BASE}/crm-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contactId }),
  });
  const data = await readJson<{ contact: CrmContactNative }>(res);
  return data.contact;
}

/** Draft or redraft the letter for one prospect. Slow — it calls the model. */
export async function generateLetterRequest(id: string): Promise<MailingLabelRecord> {
  const res = await fetch(`${BASE}/${id}/letter`, { method: "POST" });
  const data = await readJson<{ label: MailingLabelRecord }>(res);
  return data.label;
}

/** Mark the person a client (or back to a prospect). Drives which letter gets drafted. */
export async function setLetterKindRequest(
  id: string,
  letterKind: LetterKind
): Promise<MailingLabelRecord> {
  const res = await fetch(`${BASE}/${id}/letter`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ letterKind }),
  });
  const data = await readJson<{ label: MailingLabelRecord }>(res);
  return data.label;
}

export async function saveLetterRequest(
  id: string,
  letterBody: string
): Promise<MailingLabelRecord> {
  const res = await fetch(`${BASE}/${id}/letter`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ letterBody }),
  });
  const data = await readJson<{ label: MailingLabelRecord }>(res);
  return data.label;
}

export async function saveMailingLabelSettingsRequest(
  patch: Partial<{ sender: unknown; defaults: unknown }>
): Promise<MailingLabelSettings> {
  const res = await fetch(`${BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await readJson<{ settings: MailingLabelSettings }>(res);
  return data.settings;
}

/**
 * Build the PDF and open it in a new tab, which lands the user straight in the browser's print
 * dialog. A blob URL (rather than navigating to the endpoint) keeps this a POST — the selection
 * can be dozens of ids, which doesn't belong in a query string.
 */
export async function printMailingLabels(params: {
  ids: string[];
  preset: string;
  options: Partial<LabelSheetOptions>;
  markPrinted?: boolean;
}): Promise<void> {
  return openPdf(`${BASE}/print`, params, "mailing-labels.pdf");
}

/** Build a PDF of the selected prospects' letters and open it for printing. */
export async function printProspectLetters(ids: string[]): Promise<void> {
  return openPdf(`${BASE}/letters/print`, { ids }, "prospect-letters.pdf");
}

async function openPdf(url: string, payload: unknown, filename: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data?.error || `Could not build the PDF (${res.status})`);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const opened = window.open(blobUrl, "_blank");
  if (!opened) {
    // Popup blocked — fall back to a download so the work isn't lost.
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Give the new tab time to load the blob before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
