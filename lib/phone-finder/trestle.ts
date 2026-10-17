/**
 * Trestle Real Contact (GET /2.0/real_contact): given a name and a phone, is the number valid,
 * active, registered to that name, and does it belong to a TCPA litigator?
 *
 * $0.03 + $0.005 litigator add-on per query, and EVERY HTTP 200 is billed (even an invalid phone).
 * 4xx/5xx are free. Docs: https://docs.trestleiq.com/api-reference/real-contact-api
 *
 * The parser is pure and tolerant. Two quirks it handles:
 *  - the litigator flag is `phone_is_litigator_risk` on Real Contact but a LITERAL dotted key
 *    `"phone.is_litigator_risk"` on Phone Validation / Caller ID;
 *  - `name_match: null` means "no name data", NOT "someone else's number".
 */

import { httpJson, sleep, type FetchLike } from "./http";

export const TRESTLE_API_BASE = "https://api.trestleiq.com";

export type TrestleFailure =
  | "auth" // 403 AUTHENTICATION_FAILED: bad key, no product access, or empty wallet
  | "quota" // 429 QUOTA_EXCEEDED: billing-period cap
  | "rate_limit"
  | "bad_request"
  | "server"
  | "timeout"
  | "network"
  | "unknown";

export type TrestleCheck =
  | {
      ok: true;
      isValid: boolean | null;
      /** A-F; F also covers litigators and dead numbers. */
      grade: string | null;
      /** 0-100. ≥70 likely connected, ≤30 likely disconnected. */
      activityScore: number | null;
      /** Landline | Mobile | FixedVOIP | NonFixedVOIP | Premium | TollFree | Voicemail | Other */
      lineType: string | null;
      /** true = registered to this name; false = to someone else; null = no data. */
      nameMatch: boolean | null;
      /** null = the check timed out or wasn't returned: unknown, NOT clean. */
      litigator: boolean | null;
    }
  | { ok: false; failure: TrestleFailure; status: number };

export type RealContactQuery = {
  name: string;
  /** E.164 */
  phone: string;
  email?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  sourceId: string;
};

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Litigator flag across Trestle's three shapes; a litigator warning wins. */
export function parseLitigatorFlag(addOns: unknown, warnings: unknown): boolean | null {
  if (Array.isArray(warnings) && warnings.some((w) => typeof w === "string" && /lead is a litigator/i.test(w))) {
    return true;
  }
  if (!addOns || typeof addOns !== "object") return null;
  const lit = (addOns as Record<string, unknown>).litigator_checks;
  if (!lit || typeof lit !== "object") return null;
  const l = lit as Record<string, unknown>;
  const nested = l.phone && typeof l.phone === "object" ? (l.phone as Record<string, unknown>).is_litigator_risk : undefined;
  for (const candidate of [l.phone_is_litigator_risk, l["phone.is_litigator_risk"], nested]) {
    if (typeof candidate === "boolean") return candidate;
  }
  return null;
}

/** Parse a 200 Real Contact body. Partial-error responses still carry usable fields. */
export function parseRealContact(json: unknown): Extract<TrestleCheck, { ok: true }> {
  const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const phone = (body.phone && typeof body.phone === "object" ? body.phone : {}) as Record<string, unknown>;
  return {
    ok: true,
    isValid: bool(phone.is_valid),
    grade: strOrNull(phone.contact_grade),
    activityScore: num(phone.activity_score),
    lineType: strOrNull(phone.line_type),
    nameMatch: bool(phone.name_match),
    litigator: parseLitigatorFlag(body.add_ons, body.warnings),
  };
}

export function classifyTrestleFailure(status: number, json: unknown, error: "timeout" | "network" | null): TrestleFailure {
  if (error === "timeout") return "timeout";
  if (error === "network") return "network";
  const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const code = String(body.errorCode ?? body.error ?? "").toUpperCase();
  if (status === 403 || status === 401) return "auth";
  if (status === 429) return code.includes("QUOTA") ? "quota" : "rate_limit";
  if (status === 400) return "bad_request";
  if (status >= 500) return "server";
  return "unknown";
}

/** Literal dotted keys (address.city) and %20 for spaces, as Trestle's docs show. */
export function buildRealContactUrl(q: RealContactQuery): string {
  const params: [string, string][] = [
    ["name", q.name],
    ["phone", q.phone],
  ];
  if (q.email) params.push(["email", q.email]);
  if (q.address?.street) params.push(["address.street_line_1", q.address.street]);
  if (q.address?.city) params.push(["address.city", q.address.city]);
  if (q.address?.state) params.push(["address.state_code", q.address.state]);
  if (q.address?.zip) params.push(["address.postal_code", q.address.zip]);
  if (q.address && (q.address.street || q.address.city || q.address.state || q.address.zip)) {
    params.push(["address.country_code", "US"]);
  }
  params.push(["add_ons", "litigator_checks"]);
  params.push(["source_id", q.sourceId]);
  const qs = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${TRESTLE_API_BASE}/2.0/real_contact?${qs}`;
}

export type TrestleClient = {
  realContact(query: RealContactQuery): Promise<TrestleCheck>;
};

export function createTrestleClient(options: {
  apiKey: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Override for tests. */
  wait?: (ms: number) => Promise<void>;
}): TrestleClient {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const wait = options.wait ?? sleep;
  return {
    async realContact(query) {
      const url = buildRealContactUrl(query);
      // Only a QPS 429 is retried in-call: it is not billed and clears within seconds. A timeout is
      // NOT retried here, because Trestle may already have answered (and billed) it.
      for (let attempt = 0; ; attempt++) {
        const res = await httpJson(
          url,
          { method: "GET", headers: { Accept: "application/json", "x-api-key": options.apiKey } },
          { timeoutMs, fetchImpl: options.fetchImpl }
        );
        if (res.status === 200) return parseRealContact(res.json);
        const failure = classifyTrestleFailure(res.status, res.json, res.error);
        if (failure === "rate_limit" && attempt < 2) {
          await wait(1_000 * (attempt + 1) + Math.floor(Math.random() * 400));
          continue;
        }
        return { ok: false, failure, status: res.status };
      }
    },
  };
}
