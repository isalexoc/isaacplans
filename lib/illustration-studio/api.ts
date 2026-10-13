/**
 * Browser-side wrappers for the Illustration Studio endpoints. Free of server-only imports so the
 * admin components can import it directly.
 */

import type { IllustrationSummaryRecord, PresentationData } from "./types";

const BASE = "/api/admin/illustration-studio";

type Envelope<T> = { success: boolean; error?: string } & T;

async function readJson<T>(res: Response): Promise<Envelope<T>> {
  const data = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

/** Sends the PDF's text (never the PDF) for extraction; resolves to the new summary's id. */
export async function extractIllustrationRequest(input: { fileName: string; pages: string[] }): Promise<string> {
  const res = await fetch(`${BASE}/extract`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await readJson<{ id: string }>(res);
  return data.id;
}

export async function updatePresentationRequest(
  id: string,
  presentation: PresentationData
): Promise<IllustrationSummaryRecord> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ presentation }),
  });
  const data = await readJson<{ summary: IllustrationSummaryRecord }>(res);
  return data.summary;
}

export async function deleteSummaryRequest(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE", credentials: "same-origin" });
  await readJson<Record<string, never>>(res);
}

/** Direct link, for "Open" (presenting in a new tab) and "Download". */
export function summaryPdfUrl(id: string, options: { download?: boolean } = {}): string {
  return `${BASE}/${id}/pdf${options.download ? "?download=1" : ""}`;
}

/**
 * The PDF as an object URL for the preview iframe. Fetched rather than pointed at directly so a
 * failure shows as a message instead of raw JSON in the frame, and so an expiring Clerk session
 * can't turn into a sign-in redirect chain inside the iframe. Caller revokes the URL.
 */
export async function fetchPdfObjectUrl(id: string): Promise<string> {
  const res = await fetch(summaryPdfUrl(id), { credentials: "same-origin", cache: "no-store" });
  if (!res.ok || !res.headers.get("Content-Type")?.includes("application/pdf")) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Couldn't load the preview (${res.status}).`);
  }
  return URL.createObjectURL(await res.blob());
}
