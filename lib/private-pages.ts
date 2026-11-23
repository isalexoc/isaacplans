/**
 * Pages where a client's personal data is typed or shown, or whose URL is itself a credential.
 *
 * No third-party script runs on them: Meta Pixel, Google Analytics and Agent CRM's chat and
 * external tracking all report the page URL (a token here), and the CRM script also captures
 * forms — on a page collecting a Social Security number. None of the intake flows fire conversion
 * events, so nothing is lost. They also refuse to be framed by another site (clickjacking).
 *
 * Covers every line of business's intake (dashboard, client form, summary, the Impact deck), the
 * secure and document links, the ACA signing page, /admin, and the agent platform's agent area
 * (/agent, es /agente: agents' clients' applications; never /agent-crm, a public page). One
 * pattern, used by middleware (server) and by the tracking components (client-side navigation).
 * Pathnames may carry the locale prefix or not, and may be next-intl templates
 * (`/aca/intake/[token]`).
 */
const PRIVATE_PAGE_RE = new RegExp(
  "^(?:/(?:en|es))?/(?:" +
    // Every line's intake: /aca/intake, /alternativa-de-salud/admision/<token>/view, …
    "(?:[^/]+/)?(?:intake|admision)(?:/.*)?" +
    // Secure links (/secure, /seguro, /iul/secure, /iul/seguro) and document uploads
    "|(?:iul/)?(?:secure|seguro|documents|documentos)/[^/]+" +
    "|aca/(?:confirmation|confirmacion)/[^/]+" +
    "|admin(?:/.*)?" +
    // The agent area: /agent, /agente and everything under them.
    "|agente?(?:/.*)?" +
    ")/?$",
  "i"
);

export function isPrivatePagePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PRIVATE_PAGE_RE.test(pathname);
}
