/**
 * Pivot Health STM direct quote (agent link).
 * Override with NEXT_PUBLIC_PIVOT_DIRECT_QUOTE_URL if the link changes.
 */
export const PIVOT_DIRECT_QUOTE_URL =
  process.env.NEXT_PUBLIC_PIVOT_DIRECT_QUOTE_URL ??
  "https://www.pivothealth.com/product/short-term-health-insurance/agent/4159/?utm_source=4159";

/**
 * Pivot Health self-enrollment (census) link — the same agent id, but it drops the visitor
 * straight into the enrollment flow instead of the product page. Offered after a lead form is
 * submitted, for people who would rather not wait for a call.
 *
 * Override with NEXT_PUBLIC_PIVOT_SELF_ENROLL_URL if the link changes.
 */
export const PIVOT_SELF_ENROLL_URL =
  process.env.NEXT_PUBLIC_PIVOT_SELF_ENROLL_URL ??
  "https://enroll.pivothealth.com/census/?agent_id=4159&utm_source=4159";
