/**
 * The agent area on isaacplans.com: `/{l}/agent` (es `/agente`) and its pages, as pure rules that
 * middleware.ts (sign-in, the page frame header), the pages (their links) and the offline tests
 * share. The localized words mirror i18n/routing.ts, and scripts/test-tenancy.ts fails if the two
 * ever disagree.
 *
 *   /en/agent                                   /es/agente                                dashboard
 *   /en/agent/profile                           /es/agente/perfil                         profile
 *   /en/agent/agreements                        /es/agente/acuerdos                       ToS + DPA
 *   /en/agent/applications/{token}              /es/agente/solicitudes/{token}            the form
 *   /en/agent/applications/{token}/presentation /es/agente/solicitudes/{token}/presentacion  the deck
 *   /en/agent/applications/{token}/summary      /es/agente/solicitudes/{token}/resumen    summary
 *
 * The page frame (components/site-shell/main-shell.tsx) is chosen by the request header
 * `x-shell`, which middleware sets on EVERY page response of isaacplans.com: "agent" (or
 * "agent-present" for the deck a client watches) inside the agent area, "site" everywhere else.
 * Next.js copies a middleware response header over the request header of the same name, so a value
 * a browser sends itself is always replaced and can't put Isaac's pages in the agent frame or the
 * agent area in his. (Paths the middleware matcher skips, those with a dot, never render either
 * frame differently for anyone but the sender: a request header only shapes its own response.)
 *
 * Pure (no server-only import) so the offline tests can import it.
 */

export type AgentAreaLocale = "en" | "es";

export type AgentAreaPage = "dashboard" | "profile" | "agreements";
export type AgentApplicationView = "form" | "presentation" | "summary";

/** The localized words of each segment (i18n/routing.ts has the same, as pathnames). */
export const AGENT_AREA_SEGMENTS = {
  root: { en: "agent", es: "agente" },
  profile: { en: "profile", es: "perfil" },
  agreements: { en: "agreements", es: "acuerdos" },
  applications: { en: "applications", es: "solicitudes" },
  presentation: { en: "presentation", es: "presentacion" },
  summary: { en: "summary", es: "resumen" },
} as const satisfies Record<string, Record<AgentAreaLocale, string>>;

const W = AGENT_AREA_SEGMENTS;

export function agentAreaLocale(value: string | null | undefined): AgentAreaLocale {
  return value === "es" ? "es" : "en";
}

/** "/es/agente/perfil" */
export function agentAreaPath(locale: AgentAreaLocale, page: AgentAreaPage = "dashboard"): string {
  const root = `/${locale}/${W.root[locale]}`;
  return page === "dashboard" ? root : `${root}/${W[page][locale]}`;
}

/** "/es/agente/solicitudes/{token}/resumen" */
export function agentApplicationPath(
  locale: AgentAreaLocale,
  token: string,
  view: AgentApplicationView = "form"
): string {
  const base = `/${locale}/${W.root[locale]}/${W.applications[locale]}/${encodeURIComponent(token)}`;
  return view === "form" ? base : `${base}/${W[view][locale]}`;
}

/**
 * Templates for a client component that builds an application's links from a token it only learns
 * later (the dashboard's list): "{token}" stands for the token.
 */
export const TOKEN_PLACEHOLDER = "{token}";

export function agentApplicationTemplate(locale: AgentAreaLocale, view: AgentApplicationView = "form"): string {
  return agentApplicationPath(locale, "TOKEN", view).replace("TOKEN", TOKEN_PLACEHOLDER);
}

export function fillTokenTemplate(template: string, token: string): string {
  return template.split(TOKEN_PLACEHOLDER).join(encodeURIComponent(token));
}

/**
 * Every path of the agent area, in any spelling a request may arrive with: with or without the
 * locale prefix (next-intl adds it), and in either language's word (next-intl redirects to the
 * locale's own). `/agent-crm`, Isaac's public affiliate page, is NOT in it: the word must end the
 * path or be followed by a slash. Case-insensitive, so a miscased path is protected too.
 */
export const AGENT_AREA_PATH_RE = /^(?:\/(?:en|es))?\/agente?(?:\/.*)?$/i;

export function isAgentAreaPath(pathname: string | null | undefined): boolean {
  return typeof pathname === "string" && AGENT_AREA_PATH_RE.test(pathname);
}

const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

export type ParsedAgentAreaPath =
  | { locale: AgentAreaLocale; page: AgentAreaPage }
  | { locale: AgentAreaLocale; token: string; view: AgentApplicationView };

/**
 * A canonical agent-area path (the locale's own words, as next-intl serves it) as page and token,
 * or null for anything else, including the other language's words (next-intl redirects those).
 */
export function parseAgentAreaPath(pathname: string): ParsedAgentAreaPath | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const [first, root, ...rest] = path.split("/").filter(Boolean);
  if (first !== "en" && first !== "es") return null;
  const locale: AgentAreaLocale = first;
  if (root !== W.root[locale]) return null;
  if (rest.length === 0) return { locale, page: "dashboard" };
  if (rest.length === 1) {
    if (rest[0] === W.profile[locale]) return { locale, page: "profile" };
    if (rest[0] === W.agreements[locale]) return { locale, page: "agreements" };
    return null;
  }
  if (rest[0] !== W.applications[locale] || !TOKEN_RE.test(rest[1] ?? "")) return null;
  const token = rest[1];
  if (rest.length === 2) return { locale, token, view: "form" };
  if (rest.length === 3) {
    if (rest[2] === W.presentation[locale]) return { locale, token, view: "presentation" };
    if (rest[2] === W.summary[locale]) return { locale, token, view: "summary" };
  }
  return null;
}

/**
 * The same agent-area page in the other language (for the frame's language link), or the other
 * language's dashboard when the path isn't one this file can read. Null outside the agent area.
 */
export function agentAreaAlternate(pathname: string): string | null {
  if (!isAgentAreaPath(pathname)) return null;
  const parsed = parseAgentAreaPath(pathname);
  const current: AgentAreaLocale = /^\/es(?:\/|$)/i.test(pathname) ? "es" : "en";
  if (!parsed) return agentAreaPath(current === "es" ? "en" : "es");
  const other: AgentAreaLocale = parsed.locale === "es" ? "en" : "es";
  return "page" in parsed ? agentAreaPath(other, parsed.page) : agentApplicationPath(other, parsed.token, parsed.view);
}

/* ─── the page frame header ───────────────────────────────────────────────── */

/** The request header that picks the page frame on isaacplans.com. */
export const SHELL_HEADER = "x-shell";
/** The agent area page in the other language, for the frame's language link. */
export const SHELL_ALTERNATE_HEADER = "x-shell-alternate";

/**
 *  - "site": Isaac's frame (header, footer, trackers), exactly as before;
 *  - "agent": the agent area's own frame (the platform's name, the agent, the area's nav);
 *  - "agent-present": the same frame without the nav, for the deck the agent shares with a client.
 */
export type ShellKind = "site" | "agent" | "agent-present";

export function shellKindForPath(pathname: string): ShellKind {
  if (!isAgentAreaPath(pathname)) return "site";
  const parsed = parseAgentAreaPath(pathname);
  return parsed && "view" in parsed && parsed.view === "presentation" ? "agent-present" : "agent";
}

/** What a frame reads back: anything but the two agent values is Isaac's frame. */
export function parseShellHeader(value: string | null | undefined): ShellKind {
  return value === "agent" || value === "agent-present" ? value : "site";
}

/**
 * The frame headers for one isaacplans.com page response. `x-shell` is ALWAYS set (middleware
 * writes it on every page it answers), so whatever the browser sent under that name is
 * overwritten. The language link's header is set, never empty, wherever the agent frame reads it
 * (Next.js drops an empty middleware header instead of overwriting the request's); Isaac's frame
 * never reads it.
 */
export function shellHeadersForPath(pathname: string): Record<string, string> {
  const kind = shellKindForPath(pathname);
  if (kind === "site") return { [SHELL_HEADER]: kind };
  return {
    [SHELL_HEADER]: kind,
    [SHELL_ALTERNATE_HEADER]: agentAreaAlternate(pathname) ?? agentAreaPath("en"),
  };
}

/**
 * A Clerk invitation lands on the dashboard with its ticket (`?__clerk_ticket=…`), before the
 * invited person has an account: that one request reaches the page signed out, which shows Clerk's
 * sign-up for the ticket and nothing else. Every other agent-area request needs a sign-in.
 */
export const CLERK_TICKET_PARAM = "__clerk_ticket";

export function isAgentInvitationLanding(pathname: string, search: URLSearchParams): boolean {
  if (!search.get(CLERK_TICKET_PARAM)) return false;
  const parsed = isAgentAreaPath(pathname) ? parseAgentAreaPath(pathname) : null;
  return parsed !== null && "page" in parsed && parsed.page === "dashboard";
}
