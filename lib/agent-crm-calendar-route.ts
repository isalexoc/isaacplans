/** Set on `<html>` by booking embed (useLayoutEffect) so `AgentCrmChat` skips DOM sweep. */
export const AGENT_CRM_NO_SWEEP_HTML_ATTR = "data-isaacplans-no-agentcrm-sweep";

/**
 * True when the URL is any Agent CRM booking / appointment calendar page.
 * Covers localized slugs (e.g. /gastos-finales/calendario) and next-intl internal pathnames.
 */
export function isAgentCrmBookingCalendarPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = pathname.replace(/^\/(en|es)(?=\/)/i, "").toLowerCase();
  return p.includes("/calendar") || p.includes("calendario");
}
