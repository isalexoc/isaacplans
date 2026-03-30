/**
 * Allstate Health Solutions / National General — NatGen quick-quote URLs.
 *
 * - `allstateQuickQuoteUrl(product)` builds the enrollment link for a given `product` query param.
 * - `ALLSTATE_QUICK_QUOTE_URL` is the STM / “all products” default (same as `all-products`).
 *
 * Overrides:
 * - `NEXT_PUBLIC_ALLSTATE_QUICK_QUOTE_URL` — full URL (e.g. legacy STM link). When set, used as
 *   `ALLSTATE_QUICK_QUOTE_URL` only; product pages still use `NEXT_PUBLIC_ALLSTATE_AGENT` or the
 *   built-in agent for `allstateQuickQuoteUrl`.
 * - `NEXT_PUBLIC_ALLSTATE_AGENT` — agent token only (URL-encoded automatically). Use when the agent
 *   rotates but you do not want to change code.
 */

const NATGEN_QUICK_QUOTE_BASE = "https://customer.enroll.natgenhealth.com/quick-quote/";

/** Default agent (Isaac Plans) — matches official NatGen quick-quote links. */
export const ALLSTATE_DEFAULT_AGENT =
  "CfDJ8HnG7iviitJBoT9st8R33ESvJFU8_C8o-zKyOszwO7-Cq7OzbRfIvcX3lUEdMS8H7zbPBQ1ClUPpzdPM5JuZ8F0YHA";

function resolvedAgent(): string {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ALLSTATE_AGENT) ||
    ALLSTATE_DEFAULT_AGENT
  );
}

/** Build NatGen quick-quote URL for a `product` path segment (e.g. `dental`, `all-products`). */
export function allstateQuickQuoteUrl(product: string): string {
  const agent = resolvedAgent();
  const params = new URLSearchParams();
  params.set("agent", agent);
  params.set("product", product);
  return `${NATGEN_QUICK_QUOTE_BASE}?${params.toString()}`;
}

export const ALLSTATE_QUICK_QUOTE_URL =
  process.env.NEXT_PUBLIC_ALLSTATE_QUICK_QUOTE_URL ??
  allstateQuickQuoteUrl("all-products");
