/**
 * Browser calls for the client's signing page (/api/aca-confirmation/[token]). Every outcome is a
 * value, never a throw, so the page can switch on `kind`.
 */

import type {
  AcaConfirmationDeadCode,
  AcaConfirmationPublicView,
  AcaConfirmationSignInput,
  AcaConfirmationSignResult,
} from "./types";

export type DeadOutcome = {
  kind: "dead";
  code: AcaConfirmationDeadCode;
  agentName: string | null;
  agentPhone: string | null;
  signedAtLocal: string | null;
};

export type ViewOutcome = { kind: "ok"; view: AcaConfirmationPublicView } | DeadOutcome | { kind: "error" };

export type SignOutcome =
  | { kind: "ok"; result: AcaConfirmationSignResult }
  | DeadOutcome
  | { kind: "invalid"; issue: string | null }
  | { kind: "error" };

const DEAD_CODES = new Set<AcaConfirmationDeadCode>(["not_found", "signed", "cancelled", "expired"]);

function asDead(data: unknown): DeadOutcome | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.code !== "string" || !DEAD_CODES.has(d.code as AcaConfirmationDeadCode)) return null;
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    kind: "dead",
    code: d.code as AcaConfirmationDeadCode,
    agentName: str(d.agentName),
    agentPhone: str(d.agentPhone),
    signedAtLocal: str(d.signedAtLocal),
  };
}

const url = (token: string) => `/api/aca-confirmation/${encodeURIComponent(token)}`;

export async function fetchConfirmationView(token: string): Promise<ViewOutcome> {
  try {
    const res = await fetch(url(token), { credentials: "same-origin", cache: "no-store" });
    const data: unknown = await res.json().catch(() => null);
    if (res.ok && data && typeof data === "object" && (data as { success?: unknown }).success === true) {
      return { kind: "ok", view: (data as { view: AcaConfirmationPublicView }).view };
    }
    return asDead(data) ?? { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export async function submitConfirmationSignature(token: string, input: AcaConfirmationSignInput): Promise<SignOutcome> {
  try {
    const res = await fetch(url(token), {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data: unknown = await res.json().catch(() => null);
    if (res.ok && data && typeof data === "object" && (data as { success?: unknown }).success === true) {
      return { kind: "ok", result: (data as { result: AcaConfirmationSignResult }).result };
    }
    if (res.status === 400) {
      const issue = (data as { issue?: unknown } | null)?.issue;
      return { kind: "invalid", issue: typeof issue === "string" ? issue : null };
    }
    return asDead(data) ?? { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
