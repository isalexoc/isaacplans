/**
 * Browser-side wrappers for the admin mailing-label endpoints. Kept free of server-only imports
 * so the admin components can import it directly.
 */

import type {
  LabelSheetOptions,
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
  const res = await fetch(`${BASE}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data?.error || `Could not build the PDF (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank");
  if (!opened) {
    // Popup blocked — fall back to a download so the work isn't lost.
    const a = document.createElement("a");
    a.href = url;
    a.download = "mailing-labels.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Give the new tab time to load the blob before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
