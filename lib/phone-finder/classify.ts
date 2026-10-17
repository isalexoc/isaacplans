/**
 * Pure decisions: what the phone on file is, which found numbers are new, and how to rank them.
 *
 * Nothing here adds a number to GHL's phone list — every number found goes into the text field,
 * ranked, with ✓ on the ones Trestle ties to the lead's name. Invalid numbers are dropped and
 * litigator numbers are kept but flagged DO NOT CALL.
 */

import type { EnformionPhone } from "./enformion";
import { phoneKey, type LeadInputs } from "./inputs";
import type { TrestleCheck } from "./trestle";

export type PrimaryVerdict =
  | "none" // no phone on file
  | "non_us" // a non-US number: not checked, not searched with
  | "invalid" // not a real NANP number, or Trestle says invalid
  | "confirmed" // registered to this lead's name
  | "other_person" // registered to someone else
  | "unknown" // valid, but Trestle has no name for it
  | "unchecked"; // the Trestle check failed

export function derivePrimaryVerdict(inputs: LeadInputs, check: TrestleCheck | null): PrimaryVerdict {
  if (!inputs.primaryRaw) return "none";
  if (inputs.primaryNonUs) return "non_us";
  if (!inputs.primaryE164) return "invalid";
  if (!check || !check.ok) return "unchecked";
  if (check.isValid === false) return "invalid";
  if (check.nameMatch === true) return "confirmed";
  if (check.nameMatch === false) return "other_person";
  return "unknown";
}

export type FoundBucket = "verified" | "possible" | "litigator" | "invalid";

export type FoundNumber = {
  e164: string;
  /** "Mobile" | "Landline" | "VoIP" | "Toll-free" | "Other" | "" */
  lineType: string;
  activityScore: number | null;
  /** "YYYY-MM-DD" from EnformionGO, or null. */
  lastReported: string | null;
  isConnected: boolean | null;
  /** EnformionGO's own order. */
  index: number;
  bucket: FoundBucket;
  /** false when the Trestle check failed (shown without ✓). */
  checked: boolean;
};

export const MAX_CANDIDATES = 5;

/** New, valid numbers only: drops anything already on the contact and duplicates. */
export function extractCandidates(
  phones: EnformionPhone[],
  existingKeys: Set<string>,
  max = MAX_CANDIDATES
): (EnformionPhone & { e164: string })[] {
  const seen = new Set(existingKeys);
  const out: (EnformionPhone & { e164: string })[] = [];
  for (const p of phones) {
    if (!p.e164) continue;
    const key = phoneKey(p.e164);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p as EnformionPhone & { e164: string });
    if (out.length >= max) break;
  }
  return out;
}

export function normalizeLineType(trestleType: string | null, enformionType: string): string {
  const t = (trestleType ?? "").toLowerCase();
  if (t === "mobile") return "Mobile";
  if (t === "landline") return "Landline";
  if (t === "fixedvoip" || t === "nonfixedvoip") return "VoIP";
  if (t === "tollfree") return "Toll-free";
  if (t) return "Other";
  const e = enformionType.toLowerCase();
  if (/mobile|wireless|cell/.test(e)) return "Mobile";
  if (/land/.test(e)) return "Landline";
  if (/voip/.test(e)) return "VoIP";
  return "";
}

export function classifyFound(phone: EnformionPhone & { e164: string }, check: TrestleCheck | null): FoundNumber {
  const ok = check?.ok === true ? check : null;
  let bucket: FoundBucket = "possible";
  if (ok?.litigator === true) bucket = "litigator";
  else if (ok?.isValid === false) bucket = "invalid";
  else if (ok?.nameMatch === true) bucket = "verified";
  return {
    e164: phone.e164,
    lineType: normalizeLineType(ok?.lineType ?? null, phone.type),
    activityScore: ok?.activityScore ?? null,
    lastReported: phone.lastReported,
    isConnected: phone.isConnected,
    index: phone.index,
    bucket,
    checked: Boolean(ok),
  };
}

const BUCKET_ORDER: Record<FoundBucket, number> = { verified: 0, possible: 1, litigator: 2, invalid: 3 };
const LINE_ORDER: Record<string, number> = { Mobile: 0, Landline: 1, VoIP: 2 };
const CONNECTED_ORDER = (v: boolean | null) => (v === true ? 0 : v === null ? 1 : 2);

/** Best first; invalid numbers are dropped. */
export function rankFound(list: FoundNumber[]): FoundNumber[] {
  return list
    .filter((n) => n.bucket !== "invalid")
    .sort(
      (a, b) =>
        BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] ||
        (b.activityScore ?? 50) - (a.activityScore ?? 50) ||
        (LINE_ORDER[a.lineType] ?? 3) - (LINE_ORDER[b.lineType] ?? 3) ||
        CONNECTED_ORDER(a.isConnected) - CONNECTED_ORDER(b.isConnected) ||
        (b.lastReported ?? "").localeCompare(a.lastReported ?? "") ||
        a.index - b.index
    );
}
