/**
 * Lead Guard's decision: pure, no I/O (offline-tested in scripts/test-lead-guard.ts).
 *
 * BLOCK only on bot certainty — things a real browser using our real UI cannot produce, now or in
 * any deploy transition: the visitor gets the normal success screen, nothing is stored, nothing
 * reaches the CRM. That is a server action posted without React (how the spam bot submitted the
 * contact form), a JSON body with several lead types at once, and a JSON post with neither a form
 * token nor an Origin header (every browser sends Origin on a fetch POST; scripts usually don't).
 *
 * HOLD on anything merely doubtful: kept out of the CRM (no workflow email, no SMS, no opportunity,
 * no CAPI), stored encrypted, Isaac is told, one click releases it. The visitor sees the normal
 * success screen. Tokens (missing, forged, stale, instant) and the honeypot are HOLD-only on
 * purpose: a key change, an autofill or a slow phone must never silently lose a real person.
 *
 * ALLOW otherwise: today's flow, plus the `web_verified` tag.
 */

import type { LeadTokenCheck } from "./token";

export type LeadGuardVerdict = "allow" | "hold" | "block";

export type LeadGuardReason =
  // block
  | "no_js_post"
  | "multi_blob"
  | "scripted_post"
  // hold
  | "token_missing"
  | "token_stale"
  | "token_forged"
  | "no_blob"
  | "server_only_blob"
  | "honeypot"
  | "too_fast"
  | "phone_invalid"
  | "phone_unverified"
  | "name_junk"
  | "origin_foreign"
  | "strict_rate"
  | "daily_cap";

export type LeadGuardSignals = {
  /** Server actions only: true when React's client invoked it (`next-action` header). */
  jsSubmit: boolean | null;
  token: LeadTokenCheck;
  /** The browser had to fetch the token just now (old tab): its age says nothing about the person. */
  freshToken: boolean;
  honeypot: "empty" | "filled" | "absent";
  /** JSON routes only: the request carried no Origin header. */
  originMissing: boolean;
  originForeign: boolean;
  /** null when there is no phone to check, or the check itself failed. */
  phoneValid: boolean | null;
  /** The visitor saw "double-check this number" and sent the same number again. */
  phoneAcknowledged: boolean;
  nameJunk: boolean;
  blobIssue: null | "multi_blob" | "no_blob" | "server_only_blob";
  /** Too many allowed leads recently (computed only when everything else allows). */
  rateTripped: null | "strict_rate" | "daily_cap";
};

export type LeadGuardDecision = { verdict: LeadGuardVerdict; reasons: LeadGuardReason[] };

/** A human cannot fill and send a lead form this soon after the page rendered, even with autofill. */
export const MIN_FILL_MS = 1200;

export function decideLeadGuard(s: LeadGuardSignals): LeadGuardDecision {
  const noToken = s.token.state === "missing" || s.token.state === "forged";

  const block: LeadGuardReason[] = [];
  if (s.jsSubmit === false) block.push("no_js_post");
  if (s.blobIssue === "multi_blob") block.push("multi_blob");
  if (s.jsSubmit === null && s.originMissing && noToken) block.push("scripted_post");
  if (block.length > 0) return { verdict: "block", reasons: block };

  const hold: LeadGuardReason[] = [];
  if (s.token.state === "missing") hold.push("token_missing");
  if (s.token.state === "stale") hold.push("token_stale");
  if (s.token.state === "forged") hold.push("token_forged");
  if (s.blobIssue === "no_blob" || s.blobIssue === "server_only_blob") hold.push(s.blobIssue);
  if (s.honeypot === "filled") hold.push("honeypot");
  if (s.token.state === "valid" && s.token.ageMs < MIN_FILL_MS && !s.freshToken) hold.push("too_fast");
  if (s.phoneValid === false) hold.push(s.phoneAcknowledged ? "phone_unverified" : "phone_invalid");
  if (s.nameJunk) hold.push("name_junk");
  if (s.originForeign) hold.push("origin_foreign");
  if (s.rateTripped) hold.push(s.rateTripped);
  if (hold.length > 0) return { verdict: "hold", reasons: hold };

  return { verdict: "allow", reasons: [] };
}

const JUNK_NAME_RE =
  /(https?:\/\/|www\.|[<>{}[\]@|\\]|\d|\.(com|net|org|info|biz|ru|cn|xyz|top|site|online|link|ly|io|co)\b)/i;

/** URLs, markup, emails or digits in a name field: never a real name, often a spam payload. */
export function looksLikeJunkName(...names: Array<string | null | undefined>): boolean {
  return names.some((n) => typeof n === "string" && JUNK_NAME_RE.test(n));
}
