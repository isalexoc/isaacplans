/**
 * Browser-side wrapper for the script PDF endpoint, mirroring lib/mailing-labels/api.ts.
 * Kept free of server-only imports so the presentations components can import it directly.
 */

import type { ObjectionLob } from "@/lib/objections/types";
import {
  presentationScriptFilename,
  type ScriptPdfLanguage,
} from "./format";

const ENDPOINT = "/api/admin/presentation-scripts/pdf";

export type DownloadScriptPdfParams = {
  lineOfBusiness: ObjectionLob;
  language: ScriptPdfLanguage;
};

/**
 * Builds the PDF and saves it.
 *
 * A download rather than the new-tab-then-print flow lib/mailing-labels/api.ts uses: a label sheet
 * is printed once and thrown away, whereas the ask here is literally "download a PDF version of
 * the script" — a file to keep, print later, and carry to the desk.
 *
 * POST + blob (rather than navigating to a GET URL) keeps the route uniform with the rest of
 * /api/admin and leaves room for the options object to grow without turning into a query string.
 */
export async function downloadScriptPdf(params: DownloadScriptPdfParams): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data?.error || `Could not build the PDF (${res.status})`);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  // The server names the file in Content-Disposition; this is the fallback the anchor needs.
  link.download = filenameFrom(res) ?? scriptPdfFilename(params);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari needs the URL to outlive the click before it is revoked.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function scriptPdfFilename(params: DownloadScriptPdfParams): string {
  return presentationScriptFilename(params.lineOfBusiness, params.language);
}

function filenameFrom(res: Response): string | null {
  const header = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(header);
  return match ? match[1] : null;
}
