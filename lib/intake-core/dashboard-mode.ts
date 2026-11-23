/**
 * What the shared intake dashboard (components/intake/intake-dashboard.tsx) offers in each place
 * it is drawn. Pure, so the offline tests can pin it.
 *
 *  - "site": Isaac's intake dashboards, exactly as before: find the client in his CRM (GHL), the
 *    Impact welcome panel, the CRM "Send link".
 *  - "agent": the agent area's (/agent). Nothing that reaches Isaac's CRM: no contact search (it
 *    runs in his GHL), no Impact welcome panel (its API is his, keyed by his CRM contacts), no CRM
 *    "Send link". An application starts from a name, email or phone, and its links point at the
 *    agent area and the product domain. The API refuses all three to agents anyway
 *    (app/api/intake/[lob]/route.ts, /api/admin/*); the dashboard never asks.
 */

export type DashboardMode = "site" | "agent";

export type DashboardFeatures = {
  /** "Find or add a client": the search in Isaac's CRM. */
  crmSearch: boolean;
  /** The Impact enrollment (welcome) panel and its status badges. */
  impactEnrollment: boolean;
  /** "Send link" through the CRM's workflow. */
  crmSendLink: boolean;
};

export function dashboardFeatures(mode: DashboardMode): DashboardFeatures {
  return mode === "agent"
    ? { crmSearch: false, impactEnrollment: false, crmSendLink: false }
    : { crmSearch: true, impactEnrollment: true, crmSendLink: true };
}
