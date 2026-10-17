/**
 * EnformionGO Contact Enrichment (POST /Contact/Enrich): name + 1 or more of phone/email/address in,
 * the best-matching person's top 5 phones out. Billed only on a match; a miss is free (but counts
 * toward the plan's monthly search cap).
 * Docs: https://enformiongo.readme.io/reference/contact-enrichment
 *
 * The docs show no no-match or error example, so the parser is deliberately defensive:
 *  - 200 + isError / inputErrors       -> input_error (don't retry)
 *  - 200 + a person with id or name    -> match (billed, even when it lists no phones)
 *  - 200 without a person              -> miss
 *  - 404 with EnformionGO's envelope   -> miss; a bare 404 means a wrong URL -> error
 *  - 401/403                           -> account problem (don't retry)
 *  - 429/5xx/timeout                   -> retryable
 * `pagination.totalResults` is NOT used: the official example reports 0 next to a real person.
 */

import { toE164Nanp } from "@/lib/telegram/parse";

import { httpJson, sleep, type FetchLike } from "./http";
import type { EnformionRequestBody } from "./inputs";

export const ENFORMION_API_BASE = "https://devapi.enformion.com";

export type EnformionPhone = {
  /** null when the number is not a valid NANP number (dropped later). */
  e164: string | null;
  /** EnformionGO's own line type ("mobile", "landline", "Wireless"…). Trestle's wins when present. */
  type: string;
  isConnected: boolean | null;
  /** "YYYY-MM-DD" or null. */
  lastReported: string | null;
  /** Position in EnformionGO's list (their ranking). */
  index: number;
};

export type EnformionResult =
  | {
      kind: "match";
      /** 0-100 confidence that this record is the person searched for. */
      identityScore: number | null;
      phones: EnformionPhone[];
    }
  | { kind: "miss" }
  | { kind: "input_error" }
  | {
      kind: "error";
      retryable: boolean;
      code: "auth" | "rate_limit" | "server" | "timeout" | "network" | "unexpected";
      status: number;
    };

/** EnformionGO dates come back as "3/25/2005". */
export function parseEnformionDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}

function isEnvelope(body: Record<string, unknown>): boolean {
  return "requestType" in body || "isError" in body || "identityScore" in body;
}

export function parseEnrichResponse(
  status: number,
  json: unknown,
  transportError: "timeout" | "network" | null
): EnformionResult {
  if (transportError) return { kind: "error", retryable: true, code: transportError, status: 0 };
  const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;

  if (status === 200) {
    const error = (body.error && typeof body.error === "object" ? body.error : {}) as Record<string, unknown>;
    const inputErrors = Array.isArray(error.inputErrors) ? error.inputErrors : [];
    if (body.isError === true || inputErrors.length > 0) return { kind: "input_error" };

    const person = body.person && typeof body.person === "object" ? (body.person as Record<string, unknown>) : null;
    const name = person?.name && typeof person.name === "object" ? (person.name as Record<string, unknown>) : null;
    const isPerson =
      Boolean(person) &&
      (typeof person!.personId === "string" ||
        (typeof name?.firstName === "string" && name.firstName !== "") ||
        (typeof name?.lastName === "string" && name.lastName !== ""));
    if (!isPerson) return { kind: "miss" };

    const phones: EnformionPhone[] = [];
    if (Array.isArray(person!.phones)) {
      person!.phones.forEach((p, index) => {
        if (!p || typeof p !== "object") return;
        const ph = p as Record<string, unknown>;
        const raw = typeof ph.number === "string" ? ph.number : "";
        if (!raw) return;
        phones.push({
          e164: toE164Nanp(raw),
          type: typeof ph.type === "string" ? ph.type : "",
          isConnected: typeof ph.isConnected === "boolean" ? ph.isConnected : null,
          lastReported: parseEnformionDate(ph.lastReportedDate),
          index,
        });
      });
    }
    const score = Number(body.identityScore);
    return { kind: "match", identityScore: Number.isFinite(score) ? score : null, phones };
  }

  if (status === 404) {
    return isEnvelope(body)
      ? { kind: "miss" }
      : { kind: "error", retryable: false, code: "unexpected", status };
  }
  if (status === 400) return { kind: "input_error" };
  if (status === 401 || status === 403) return { kind: "error", retryable: false, code: "auth", status };
  if (status === 429) return { kind: "error", retryable: true, code: "rate_limit", status };
  if (status >= 500) return { kind: "error", retryable: true, code: "server", status };
  return { kind: "error", retryable: false, code: "unexpected", status };
}

export type EnformionClient = {
  /** `sessionId` goes in galaxy-client-session-id for EnformionGO's logs — never PII. */
  enrich(body: EnformionRequestBody, sessionId: string): Promise<EnformionResult>;
};

export function createEnformionClient(options: {
  apName: string;
  apPassword: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  wait?: (ms: number) => Promise<void>;
}): EnformionClient {
  const timeoutMs = options.timeoutMs ?? 25_000;
  const wait = options.wait ?? sleep;
  return {
    async enrich(body, sessionId) {
      // One in-call retry on 429/503 only. A timeout is NOT retried here: the search may already
      // have matched (and been billed) on EnformionGO's side.
      for (let attempt = 0; ; attempt++) {
        const res = await httpJson(
          `${ENFORMION_API_BASE}/Contact/Enrich`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "galaxy-ap-name": options.apName,
              "galaxy-ap-password": options.apPassword,
              "galaxy-search-type": "DevAPIContactEnrich",
              "galaxy-client-session-id": sessionId,
            },
            body: JSON.stringify(body),
          },
          { timeoutMs, fetchImpl: options.fetchImpl }
        );
        if ((res.status === 429 || res.status === 503) && attempt === 0) {
          await wait(1_500);
          continue;
        }
        return parseEnrichResponse(res.status, res.json, res.error);
      }
    },
  };
}
