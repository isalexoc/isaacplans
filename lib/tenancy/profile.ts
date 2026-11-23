/**
 * An agent's public identity: everything the deck, the guide, the quote image and the product
 * domain's shell show about the person behind them. Pure (no server-only import, no database) so
 * server components and the offline tests can import it. Client components import
 * lib/tenancy/agent-contact.ts instead (re-exported here), so this file's env reads never ship to a
 * browser.
 *
 *  - Isaac's profile is built in lib/tenancy/isaac-agent.ts from `ISAAC_AGENT` (today's card),
 *    `IMPACT_AGENT_IBO` and the licensed-state count, so his pages render exactly as before.
 *  - An agent's comes from their `agents` row (migration 0046). Only what is safe to print on a
 *    public page survives: an https photo on a public host (never one of Isaac's own: his site or
 *    his Cloudinary account), an E.164 WhatsApp number, the two supported languages, and an Impact
 *    referral link on Impact's own hosts (`safeImpactReferralUrl`). "Licensed" wording appears only
 *    when the row says licensed. Each agent shows only their own IBO number (ACN P&P §I.6).
 */

import type { AgentLanguage, AgentPronoun } from "@/components/impact-presentation/copy";
import type { AgentContact } from "./agent-contact";
import { DEFAULT_SITE_URL, mainSiteUrl, productHostLabel } from "./site-urls";

export type { AgentLanguage, AgentPronoun };
export { whatsappHref, type AgentContact } from "./agent-contact";

export type AgentPublicProfile = {
  /** The agent's address on the product domain; null for Isaac's own pages. */
  slug: string | null;
  firstName: string;
  lastName: string;
  /** "Isaac Orraiz" */
  displayName: string;
  /** The photo as an absolute https URL, or null (initials show instead). */
  photoUrl: string | null;
  /**
   * The same photo as a path under this app's public/ folder, when it ships with the app (Isaac's):
   * next/image optimizes it as it always did. Null for an agent's uploaded photo.
   */
  photoPath: string | null;
  /** "+15406813507", or null (no WhatsApp buttons). */
  whatsappE164: string | null;
  /** "15406813507", for wa.me links. */
  whatsappDigits: string | null;
  /** The languages the agent serves clients in, in their order of preference. */
  languages: AgentLanguage[];
  licensed: boolean;
  /** Licensed states (0 when not licensed, or licensed with no states listed). */
  licensedStateCount: number;
  /** The agent's own Impact IBO number (ACN Business ID). */
  iboNumber: string | null;
  /** The agent's Impact referral link, only on Impact's own https hosts. */
  impactReferralUrl: string | null;
  /** The site line on the credential card ("isaacplans.com", "<product>/<slug>"); null hides it. */
  siteLabel: string | null;
  /** For the one English sentence that needs a pronoun; null words it without one. */
  pronoun: AgentPronoun | null;
};

/** What the client-side guide needs to put the agent's name in a WhatsApp message. */
export function agentContact(profile: AgentPublicProfile): AgentContact {
  return { firstName: profile.firstName, whatsappDigits: profile.whatsappDigits, pronoun: profile.pronoun };
}

/* ─── field rules ─────────────────────────────────────────────────────────── */

const clean = (value: string | null | undefined, max = 80): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

const E164 = /^\+[1-9]\d{7,14}$/;

/** "+1 (540) 681-3507" → "+15406813507"; anything that isn't a plausible E.164 number → null. */
export function normalizeE164(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/[\s().-]/g, "");
  return E164.test(compact) ? compact : null;
}

/** "(540) 681-3507" for a US/Canada number, else the E.164 number as stored. */
export function formatWhatsapp(e164: string | null): string | null {
  if (!e164) return null;
  const us = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : e164;
}

export const LANGUAGE_NAMES: Readonly<Record<AgentLanguage, string>> = { es: "Español", en: "English" };

/** Only "en" and "es", once each, in the order given. */
export function normalizeLanguages(values: readonly string[] | null | undefined): AgentLanguage[] {
  const out: AgentLanguage[] = [];
  for (const value of values ?? []) {
    const code = typeof value === "string" ? value.trim().toLowerCase() : "";
    if ((code === "en" || code === "es") && !out.includes(code)) out.push(code);
  }
  return out;
}

/** "Español · English" (each language in its own words, as on Isaac's card). */
export function languagesLabel(languages: readonly AgentLanguage[]): string {
  return languages.map((code) => LANGUAGE_NAMES[code]).join(" · ");
}

/**
 * Impact's own hosts for a referral link: impacthealthsharing.com and mysharable.com, or any of
 * their subdomains. Over https, with no credentials or port in the URL; anything else is dropped,
 * so a profile can never send clients to a look-alike site.
 */
export const IMPACT_LINK_HOSTS: readonly string[] = ["impacthealthsharing.com", "mysharable.com"];

export function safeImpactReferralUrl(value: string | null | undefined): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > 500) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const allowed = IMPACT_LINK_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
  return allowed ? url.toString() : null;
}

/** An IPv4 address (the URL parser has already turned "2130706433" or "0x7f.1" into one) or IPv6. */
const IP_HOST = /^(\d{1,3}\.){3}\d{1,3}$|^\[/;
const PRIVATE_SUFFIXES = ["localhost", "local", "internal", "lan", "home", "intranet"];

/**
 * Isaac's Cloudinary account, already public in next.config.mjs (images.remotePatterns). With
 * `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` when set (unset on the product deployment, hence the name).
 */
const MAIN_SITE_CLOUDINARY_CLOUDS: readonly string[] = ["isaacdev"];

/**
 * Isaac's own media: his site (and its subdomains) or his Cloudinary account. An agent's photo from
 * there would print his site or account name on the agent's pages.
 */
function isMainSiteMedia(url: URL, host: string, env: Record<string, string | undefined>): boolean {
  const bare = host.replace(/^www\./, "");
  for (const site of [mainSiteUrl(env), DEFAULT_SITE_URL]) {
    let main = "";
    try {
      main = new URL(site).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (main && (bare === main || bare.endsWith(`.${main}`))) return true;
  }
  if (host !== "cloudinary.com" && !host.endsWith(".cloudinary.com")) return false;
  const clouds = new Set(
    [...MAIN_SITE_CLOUDINARY_CLOUDS, env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""]
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean)
  );
  // res.cloudinary.com/<cloud>/…, or a private CDN host <cloud>-res.cloudinary.com.
  const firstSegment = decodeURIComponent(url.pathname.split("/")[1] ?? "").toLowerCase();
  const subdomainCloud = host.endsWith("-res.cloudinary.com") ? host.slice(0, -"-res.cloudinary.com".length) : "";
  return clouds.has(firstSegment) || clouds.has(subdomainCloud);
}

/**
 * An agent's photo: an absolute https URL on a public host name, never an IP address or a local
 * name (the quote image fetches it from the server), and never Isaac's own media. Anything else is
 * dropped and initials show.
 */
export function safePhotoUrl(
  value: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > 1000) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const tld = host.split(".").pop() ?? "";
    if (!host.includes(".") || IP_HOST.test(host) || PRIVATE_SUFFIXES.includes(tld)) return null;
    if (isMainSiteMedia(url, host, env)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Up to two initials for a photo-less avatar ("María López" → "ML"). */
export function profileInitials(profile: Pick<AgentPublicProfile, "firstName" | "lastName" | "displayName">): string {
  const letters = [profile.firstName, profile.lastName]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join("");
  return (letters || profile.displayName.trim().charAt(0) || "?").toUpperCase();
}

/* ─── builders ────────────────────────────────────────────────────────────── */

/** The parts of an `agents` row a public profile is made of. */
export type AgentProfileSource = {
  slug: string;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  whatsappE164: string | null;
  languages: readonly string[] | null;
  licensed: boolean;
  licensedStates: readonly string[] | null;
  iboNumber: string | null;
  impactReferralUrl: string | null;
};

export function agentPublicProfile(
  row: AgentProfileSource,
  env: Record<string, string | undefined> = process.env
): AgentPublicProfile {
  const slug = clean(row.slug, 40).toLowerCase();
  const first = clean(row.firstName);
  const last = clean(row.lastName);
  const displayName = [first, last].filter(Boolean).join(" ") || slug;
  const e164 = normalizeE164(row.whatsappE164);
  const states = new Set(
    (row.licensedStates ?? []).map((s) => (typeof s === "string" ? s.trim().toUpperCase() : "")).filter((s) => /^[A-Z]{2}$/.test(s))
  );
  const host = productHostLabel(env);
  return {
    slug,
    firstName: first || displayName,
    lastName: last,
    displayName,
    photoUrl: safePhotoUrl(row.photoUrl, env),
    photoPath: null,
    whatsappE164: e164,
    whatsappDigits: e164 ? e164.slice(1) : null,
    languages: normalizeLanguages(row.languages),
    licensed: row.licensed === true,
    licensedStateCount: row.licensed === true ? states.size : 0,
    iboNumber: clean(row.iboNumber, 40) || null,
    impactReferralUrl: safeImpactReferralUrl(row.impactReferralUrl),
    siteLabel: host && slug ? `${host}/${slug}` : null,
    pronoun: null,
  };
}
