/**
 * The product domain's address book (`APP_SURFACE=product`): which request paths exist there and
 * where each one goes, plus where an intake's token pages are served from on each surface. Pure,
 * so the offline tests walk the whole table; middleware.ts and the token pages apply it.
 *
 * On the product domain, after next-intl has settled the locale prefix:
 *  - /{l}/{slug}                          → /{l}/a/{slug}           the agent's guide
 *  - /{l}/{slug}/apply  (es: /aplicar)    → /{l}/a/{slug}/apply     starts an application
 *  - /{l}/{slug}/privacy (es: /privacidad)→ /{l}/a/{slug}/privacy
 *    (either word works in either language; the links use the locale's own)
 *  - the client's own links pass through as next-intl resolved them: the Health Coverage
 *    application (/en/health-alternative/intake/{token}, /es/alternativa-de-salud/admision/{token})
 *    and the secure link (/en/secure/{token}, /es/seguro/{token}). Spelled in the other language's
 *    words (/es/secure/{token}), next-intl redirects them to the locale's own;
 *  - API: only /api/intake/health-alternative/… (the application's own calls). /api/intake-capture
 *    and /api/impact/quote, which the secure page and the guide also call, are outside the
 *    middleware matcher and never come through here;
 *  - everything else is a 404, answered without next-intl: Studio, the admin and other lines' APIs,
 *    Isaac's pages, /{l}/a/… itself. next-intl would first redirect a page name of Isaac's site to
 *    its other spelling (/es/about → /es/sobre-mi), spelling out his site map on this domain. A
 *    path without a locale prefix (or with a miscased one) goes to next-intl only when it would land
 *    on one of the pages above.
 * A slug is whatever `checkAgentSlug` accepts, so a page name next-intl would localize or redirect
 * first (every top-level segment of i18n/routing.ts, in both languages) never reaches an agent.
 */

import { agentMayOperate, isAgentLob, type AgentGateFields, type TenancyGates } from "./gates";
import { checkAgentSlug } from "./slugs";
import type { AppSurface } from "./surface";

export type ProductLocale = "en" | "es";

export const PRODUCT_LOCALES: readonly ProductLocale[] = ["en", "es"];

/** The only API prefix the product domain answers through middleware. */
export const PRODUCT_API_PREFIX = "/api/intake/health-alternative/";

/** The agent's pages under /{l}/a/{slug}, and the words a visitor may type for them. */
export type AgentPage = "guide" | "apply" | "privacy";

const SUBPAGE_WORDS: Record<string, AgentPage> = {
  apply: "apply",
  aplicar: "apply",
  privacy: "privacy",
  privacidad: "privacy",
};

const LOCALIZED_SUBPAGE: Record<Exclude<AgentPage, "guide">, Record<ProductLocale, string>> = {
  apply: { en: "apply", es: "aplicar" },
  privacy: { en: "privacy", es: "privacidad" },
};

/** The client's token pages, per locale, as `/{l}/<segments…>/{token}`. */
const TOKEN_PAGES: Record<ProductLocale, readonly (readonly string[])[]> = {
  en: [["health-alternative", "intake"], ["secure"]],
  es: [["alternativa-de-salud", "admision"], ["seguro"]],
};

const TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

export type ProductRoute =
  /** An allowed API call: straight through, never into next-intl. */
  | { kind: "api" }
  /** An agent's page: rewrite to the internal /{l}/a/{slug}… route. */
  | { kind: "rewrite"; locale: ProductLocale; to: string }
  /**
   * A client's token page: served as next-intl resolved it (or, in the other language's words,
   * redirected by next-intl to the locale's own).
   */
  | { kind: "pass"; locale: ProductLocale }
  /**
   * No locale prefix, or a miscased one, on a path that exists with the right one: next-intl
   * redirects it (/{slug} → /es/{slug}, /ES/{slug} → /es/{slug}).
   */
  | { kind: "intl" }
  /** Answered with a 404 straight away (never by next-intl, whose redirects name Isaac's pages). */
  | { kind: "not_found"; api: boolean; locale: ProductLocale | null };

function asLocale(value: string | undefined): ProductLocale | null {
  return value === "en" || value === "es" ? value : null;
}

/** Served under a locale prefix: an agent's page or a client's token page. */
function servedWithLocale(path: string): boolean {
  const kind = productRoute(path).kind;
  return kind === "rewrite" || kind === "pass";
}

export function productRoute(pathname: string): ProductRoute {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (path === "/api" || path.startsWith("/api/")) {
    return path.startsWith(PRODUCT_API_PREFIX) && path.length > PRODUCT_API_PREFIX.length
      ? { kind: "api" }
      : { kind: "not_found", api: true, locale: null };
  }
  if (path === "/studio" || path.startsWith("/studio/")) return { kind: "not_found", api: false, locale: null };

  const [first, ...rest] = path.split("/").filter(Boolean);
  const locale = asLocale(first);
  if (!locale) {
    const tail = rest.length > 0 ? `/${rest.join("/")}` : "";
    const lower = asLocale(first?.toLowerCase());
    // "/ES/maria-lopez": next-intl fixes the prefix's case.
    if (lower) return servedWithLocale(`/${lower}${tail}`) ? { kind: "intl" } : { kind: "not_found", api: false, locale: lower };
    // "/maria-lopez", "/secure/{token}": next-intl adds the visitor's locale.
    const unprefixed = path === "/" ? "" : path;
    return servedWithLocale(`/en${unprefixed}`) || servedWithLocale(`/es${unprefixed}`)
      ? { kind: "intl" }
      : { kind: "not_found", api: false, locale: null };
  }

  // The client's own links, in this locale's words (as next-intl lets them through) or the other
  // locale's (next-intl redirects those to this locale's words; their names are no secret here).
  const token = rest[rest.length - 1];
  for (const prefix of [...TOKEN_PAGES.en, ...TOKEN_PAGES.es]) {
    if (
      rest.length === prefix.length + 1 &&
      prefix.every((segment, i) => rest[i] === segment) &&
      token !== undefined &&
      TOKEN.test(token)
    ) {
      return { kind: "pass", locale };
    }
  }

  // An agent's pages.
  if (rest.length === 1 || rest.length === 2) {
    const check = checkAgentSlug(rest[0]);
    const page: AgentPage | undefined = rest.length === 1 ? "guide" : SUBPAGE_WORDS[rest[1].toLowerCase()];
    if (check.ok && page) {
      return { kind: "rewrite", locale, to: `/${locale}/a/${check.slug}${page === "guide" ? "" : `/${page}`}` };
    }
  }
  return { kind: "not_found", api: false, locale };
}

/** The public address of an agent's page, in the locale's own words ("/es/maria-lopez/aplicar"). */
export function agentPagePath(locale: ProductLocale, slug: string, page: AgentPage = "guide"): string {
  return page === "guide" ? `/${locale}/${slug}` : `/${locale}/${slug}/${LOCALIZED_SUBPAGE[page][locale]}`;
}

/** Both languages' addresses of one agent page, for the shell's language links. */
export function agentPageAlternates(slug: string, page: AgentPage = "guide"): Record<ProductLocale, string> {
  return { en: agentPagePath("en", slug, page), es: agentPagePath("es", slug, page) };
}

/**
 * Headers on every product-domain response that goes through middleware: private (the layout's
 * private-page rule; it carries no trackers there anyway), never indexed, never framed, and no
 * Referer leaves a page whose URL may be a credential. next.config.mjs sets the same on the rest
 * of the product deployment's responses.
 */
export const PRODUCT_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "x-private-page": "1",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

/** The product domain's plain 404 page: no app, no brand, the visitor's language when known. */
export function productNotFoundHtml(locale: ProductLocale | null): string {
  const es = locale === "es";
  const title = es ? "Página no encontrada" : "Page not found";
  const body = es ? "Esta página no existe o ya no está disponible." : "This page doesn't exist or is no longer available.";
  return (
    `<!doctype html><html lang="${es ? "es" : "en"}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">` +
    `<title>${title}</title></head>` +
    `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#fbf6f2;color:#0b2a4a">` +
    `<main style="padding:24px;text-align:center"><p style="margin:0;font-size:56px;font-weight:800">404</p>` +
    `<h1 style="margin:8px 0 0;font-size:22px">${title}</h1>` +
    `<p style="margin:8px 0 0;color:#56657a">${body}</p></main></body></html>`
  );
}

/* ─── token pages on each surface ─────────────────────────────────────────── */

/**
 * Who owns the session behind a token page: no such token, the lookup failed, one of Isaac's
 * sessions, or an agent's (their gate fields).
 */
export type TokenPageOwnerFact = "missing" | "unknown" | "platform" | AgentGateFields;

/**
 *  - "render": isaacplans.com renders the page as it always did (the API then decides who gets in);
 *  - "tenant": the product domain renders it inside the agent's shell;
 *  - "redirect": isaacplans.com sends the client to the same path on the product domain (307):
 *    an agent's clients open and claim their links only there;
 *  - "not_found": nothing to show here (Isaac's tokens on the product domain, a closed agent,
 *    no product domain to send an agent's client to);
 *  - "retry": the owner lookup failed on the product domain, so the shell can't be drawn.
 */
export type TokenPageVerdict = "render" | "tenant" | "redirect" | "not_found" | "retry";

export function decideTokenPage(input: {
  surface: AppSurface;
  lob: string;
  owner: TokenPageOwnerFact;
  gates: TenancyGates;
  /**
   * isaacplans.com only: the caller is the session's owner or a signed-in operator. They keep their
   * own view there (the owner's form; anyone else gets the API's audited denial) instead of being
   * sent to the product domain, where nobody is signed in and they would look like the client.
   */
  keepsMainView: boolean;
  productConfigured: boolean;
}): TokenPageVerdict {
  const { owner } = input;
  const open = owner !== "missing" && owner !== "unknown" && owner !== "platform"
    ? isAgentLob(input.lob) && agentMayOperate(owner, input.gates)
    : false;
  if (input.surface === "product") {
    if (owner === "unknown") return "retry";
    return open ? "tenant" : "not_found";
  }
  if (owner === "missing" || owner === "unknown" || owner === "platform") return "render";
  if (input.keepsMainView) return "render";
  return open && input.productConfigured ? "redirect" : "not_found";
}
