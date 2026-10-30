/** Typed browser-side wrapper for /api/admin/impact-enrollment. */

import type { ImpactEnrollmentInput } from "./format";
import type { ImpactEnrollmentDetail, ImpactEnrollmentStatus, ImpactSendResult } from "./types";

const BASE = "/api/admin/impact-enrollment";

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export async function fetchImpactStatuses(contactIds: string[]): Promise<Record<string, ImpactEnrollmentStatus>> {
  if (contactIds.length === 0) return {};
  const params = new URLSearchParams({ contactIds: contactIds.join(",") });
  const data = await parseJson<{ statuses: Record<string, ImpactEnrollmentStatus> }>(
    await fetch(`${BASE}?${params.toString()}`, { credentials: "same-origin" })
  );
  return data.statuses ?? {};
}

export async function fetchImpactEnrollment(contactId: string): Promise<ImpactEnrollmentDetail> {
  return parseJson<ImpactEnrollmentDetail>(
    await fetch(`${BASE}/${encodeURIComponent(contactId)}`, { credentials: "same-origin" })
  );
}

/** `card` null reuses the card stored with the last send. */
export async function sendImpactWelcome(
  contactId: string,
  input: ImpactEnrollmentInput,
  card: { pdf: File; image: Blob } | null
): Promise<ImpactSendResult> {
  const form = new FormData();
  form.append("data", JSON.stringify(input));
  if (card) {
    form.append("cardPdf", card.pdf, card.pdf.name || "id-card.pdf");
    form.append("cardImage", card.image, "id-card.jpg");
  }
  return parseJson<ImpactSendResult>(
    await fetch(`${BASE}/${encodeURIComponent(contactId)}`, {
      method: "POST",
      credentials: "same-origin",
      body: form,
    })
  );
}
