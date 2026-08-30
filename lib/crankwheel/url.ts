/**
 * Pure helpers for CrankWheel meeting URLs.
 *
 * Split out of `client.ts` because that module is `server-only` (it holds API keys) and these two
 * functions hold nothing — which makes them the parts most worth testing directly.
 */

/**
 * The link's own id, taken from the `c=` parameter of the URL CrankWheel returned.
 *
 * `make_noauth_link` answers with a URL and no uid, but the delete API needs one, and the docs are
 * explicit that they are the same value. It is base64-ish and routinely ends in `=`, so it must be
 * read with a real URL parser rather than a regex on the query string.
 */
export function uidFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("c");
  } catch {
    return null;
  }
}

/**
 * Point the viewer's join page at the client's own language.
 *
 * Always worth calling, not only for Spanish: this account's links come back as `hl=es` by
 * default, so an English-speaking client would otherwise land on a Spanish page.
 */
export function withViewerLocale(url: string, locale: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("hl", locale === "es" ? "es" : "en");
    return parsed.toString();
  } catch {
    return url;
  }
}
