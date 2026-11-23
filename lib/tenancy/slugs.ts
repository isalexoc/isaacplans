/**
 * Agent slugs: an agent's address on the product domain, `product.com/{locale}/{slug}`.
 *
 * Rules, checked here and nowhere else:
 *  - 3 to 40 of `a-z`, `0-9` and `-` (`^[a-z0-9-]{3,40}$`), starting and ending with a letter or
 *    digit, never two hyphens in a row;
 *  - not a reserved word. That is every first path segment of `i18n/routing.ts` in both locales
 *    (next-intl redirects a path that matches a localized pathname BEFORE the product middleware
 *    can rewrite it to the agent's page, so such a slug would never reach the agent), plus a fixed
 *    list of routes, app words and words that would read as one of the site's own pages;
 *  - no provider name (ACN P&P §III.6(e): an IBO's web address may not contain a provider's name).
 *    A long name like "impact" is refused anywhere in the slug; a short one like "acn" only as a
 *    hyphen-separated part or at either end of a part, so a surname that happens to contain those
 *    three letters ("isaacnunez") is not refused.
 *
 * Pure (no server-only import; `i18n/routing.ts` is plain config) so the offline tests can import it.
 */

import { routing } from "@/i18n/routing";
import { normalizeAgentSlug, SLUG_PATTERN } from "./slug-format";

export { normalizeAgentSlug, SLUG_PATTERN };

const EDGES = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Routes, app words and page-like words, in both languages, besides the localized pathnames. */
export const FIXED_RESERVED_SLUGS: readonly string[] = [
  // Routing: the product rewrite target, API and framework paths, Studio, locales.
  "a", "c", "api", "trpc", "studio", "en", "es", "www", "app", "static", "assets", "images",
  "public", "robots", "sitemap", "favicon", "not-found", "unauthorized", "auth", "oauth", "callback",
  "webhooks", "webhook", "queue", "cron",
  // The agent area and admin.
  "admin", "agent", "agente", "agents", "agentes", "dashboard", "panel", "account", "cuenta",
  "settings", "ajustes", "profile", "perfil", "billing", "facturacion", "leads", "prospectos",
  "sign-in", "sign-up", "signin", "signup", "login", "logout", "register", "registro",
  // Client pages and their localized segments.
  "impact", "impacto", "intake", "admision", "secure", "seguro", "apply", "aplicar", "privacy",
  "privacidad", "info", "informacion", "presentation", "presentacion", "presentations", "guide",
  "guia", "quote", "cotizacion", "terms", "terminos", "legal", "help", "ayuda", "support",
  "soporte", "contact", "contacto", "about",
  // Provider and program names (also refused by the provider rule; listed for clarity).
  "acn",
];

/** Provider names a slug may not contain (ACN P&P §III.6(e)). */
export const PROVIDER_NAMES: readonly string[] = ["impact", "acn"];

type Pathnames = Record<string, string | Record<string, string>>;

/** The first segment of every pathname, in every locale ("/contact-me/calendar" → "contact-me"). */
export function topLevelPathSegments(pathnames: Pathnames): string[] {
  const out = new Set<string>();
  for (const value of Object.values(pathnames)) {
    const paths = typeof value === "string" ? [value] : Object.values(value);
    for (const path of paths) {
      const first = path.split("/").filter(Boolean)[0];
      if (first && !first.startsWith("[")) out.add(first.toLowerCase());
    }
  }
  return Array.from(out);
}

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...FIXED_RESERVED_SLUGS,
  ...topLevelPathSegments(routing.pathnames as unknown as Pathnames),
]);

export function containsProviderName(slug: string): boolean {
  const parts = slug.split("-").filter(Boolean);
  return PROVIDER_NAMES.some((name) =>
    name.length >= 5
      ? slug.includes(name)
      : parts.some((part) => part === name || part.startsWith(name) || part.endsWith(name))
  );
}

export type SlugCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: "format" | "reserved" | "provider_name" };

/** Normalizes (trim, lowercase), then applies every rule above. */
export function checkAgentSlug(input: unknown): SlugCheck {
  const slug = normalizeAgentSlug(input);
  if (!SLUG_PATTERN.test(slug) || !EDGES.test(slug) || slug.includes("--")) {
    return { ok: false, reason: "format" };
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: "reserved" };
  if (containsProviderName(slug)) return { ok: false, reason: "provider_name" };
  return { ok: true, slug };
}
