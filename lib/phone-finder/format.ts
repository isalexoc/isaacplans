/**
 * The text written into the "Additional Possible Phones" field (multi-line, plain text — GHL does
 * not render Markdown). One number per line, best first, so Isaac can copy straight into Kixie:
 *
 *   ✓ 786-555-0199 · Mobile · registered to this name · active 92/100 · seen 2026
 *   • 305-555-0123 · Landline · active 61/100 · seen 2024
 *   ⛔ 954-555-0170 · DO NOT CALL: TCPA litigator
 *
 *   ⚠ The phone on file is registered to someone else.
 *   Searched Oct 16, 2026, 3:02 PM · EnformionGO (people search) + Trestle (phone checks)
 *   ✓ = registered to this name. No consent from the client for these numbers: call by hand, don't text.
 *
 * The source line is required: Trestle's terms say data merged into other records must be tagged
 * with Trestle as its source.
 */

import type { FoundNumber, PrimaryVerdict } from "./classify";

export type PhoneFinderOutcome =
  | "found" // at least one new number
  | "none" // the record matched but listed nothing new
  | "no_match" // no public record for this person
  | "not_enough_info" // nothing to search with
  | "daily_limit"
  | "failed";

export type ResultsView = {
  outcome: PhoneFinderOutcome;
  /** Ranked, invalid numbers already removed. */
  numbers: FoundNumber[];
  primaryVerdict: PrimaryVerdict;
  primaryLitigator: boolean;
  identityScore: number | null;
  minIdentityScore: number;
  /** Numbers whose Trestle check failed. */
  uncheckedCount: number;
  /** Plain-language reason for not_enough_info / daily_limit / failed. */
  detail?: string;
};

/** Field values have no documented limit; stay far below anything plausible. */
export const MAX_RESULTS_LENGTH = 4000;

export function formatPhoneDashed(e164: string): string {
  const d = e164.replace(/\D/g, "").slice(-10);
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

export function formatSearchedAt(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

function numberLine(n: FoundNumber): string {
  const phone = formatPhoneDashed(n.e164);
  if (n.bucket === "litigator") return `⛔ ${phone} · DO NOT CALL: TCPA litigator`;
  const parts = [`${n.bucket === "verified" ? "✓" : "•"} ${phone}`];
  if (n.lineType) parts.push(n.lineType);
  if (n.bucket === "verified") parts.push("registered to this name");
  if (n.activityScore !== null) parts.push(`active ${n.activityScore}/100`);
  if ((n.activityScore !== null && n.activityScore <= 30) || n.isConnected === false) {
    parts.push("may be disconnected");
  }
  if (n.lastReported) parts.push(`seen ${n.lastReported.slice(0, 4)}`);
  return parts.join(" · ");
}

function primaryLines(view: ResultsView): string[] {
  const lines: string[] = [];
  if (view.primaryLitigator) {
    lines.push("⛔ The phone on file belongs to a TCPA litigator: do not call. (tagged tcpa_litigator_risk)");
  }
  switch (view.primaryVerdict) {
    case "confirmed":
      lines.push("The phone on file is registered to this lead.");
      break;
    case "other_person":
      lines.push("⚠ The phone on file is registered to someone else.");
      break;
    case "invalid":
      lines.push("⚠ The phone on file is not a working number.");
      break;
    case "non_us":
      lines.push("The phone on file is not a US number (not checked).");
      break;
    default:
      break;
  }
  return lines;
}

export function formatResultsText(view: ResultsView, at: Date, timeZone: string): string {
  const when = formatSearchedAt(at, timeZone);
  const lines: string[] = [];

  switch (view.outcome) {
    case "found":
      lines.push(...view.numbers.map(numberLine));
      break;
    case "none":
      lines.push("No new numbers: the public record only lists numbers already on this contact.");
      break;
    case "no_match":
      lines.push("No public record matched this name with the email, address or phone on file.");
      break;
    case "not_enough_info":
      lines.push(`Not enough info to search: ${view.detail ?? "add an email or a street address/ZIP"}.`);
      break;
    case "daily_limit":
      lines.push(`Daily search limit reached${view.detail ? ` (${view.detail})` : ""}. Tick the box again tomorrow.`);
      return [...lines, `Tried ${when}`].join("\n");
    case "failed":
      lines.push(`Search failed: ${view.detail ?? "temporary problem"}. Tick the box again to retry.`);
      return [...lines, `Tried ${when}`].join("\n");
  }

  const notes: string[] = [...primaryLines(view)];
  if (view.outcome === "found" && view.identityScore !== null && view.identityScore < view.minIdentityScore) {
    notes.push(`⚠ Weak record match (score ${view.identityScore}/100): confirm who you're talking to.`);
  }
  if (view.uncheckedCount > 0) {
    notes.push(`${view.uncheckedCount} number(s) could not be checked by Trestle.`);
  }
  if (notes.length > 0) lines.push("", ...notes);

  const searched = view.outcome === "not_enough_info" ? `Checked ${when}` : `Searched ${when} · EnformionGO (people search) + Trestle (phone checks)`;
  lines.push("", searched);
  if (view.outcome === "found") {
    lines.push("✓ = registered to this name. No consent from the client for these numbers: call by hand, don't text.");
  }

  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > MAX_RESULTS_LENGTH ? `${text.slice(0, MAX_RESULTS_LENGTH - 1)}…` : text;
}
