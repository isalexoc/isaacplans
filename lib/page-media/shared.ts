/**
 * Shared types + constants for admin-editable page media (hero and social-share images, and now
 * hero video). Client-safe — the admin UI and the `<HeroMedia>` renderer both import it.
 *
 * Supersedes the former `lib/ads-images/shared.ts` (now retired), widening the same idea from the five `get-covered` ads
 * funnels to three surfaces on every line of business.
 */

import { LOBS, LOB_SLUGS, type LobSlug } from "@/lib/lob/registry";

/** Which page on a line of business the media belongs to. */
export type MediaSurface = "main" | "apply" | "ads";

/**
 * Hero art, or the social-share card. `og` is image-only: a social card has to be a still, and
 * Facebook/iMessage/WhatsApp will not play a video in a link preview.
 */
export type MediaKind = "hero" | "og";

export type MediaLocale = "en" | "es";

/** How a hero video behaves. Chosen per page in the admin tool. */
export type VideoPlayback = "loop" | "click";

/**
 * What a page actually renders. A still image is the default and the fallback everywhere; video is
 * only ever produced when the admin has uploaded one.
 */
export type HeroMedia =
  | { type: "image"; url: string }
  | {
      type: "video";
      url: string;
      /** Still shown before playback — the video's own first frame, or an image Isaac chose. */
      posterUrl: string;
      /**
       * True when `posterUrl` is an uploaded image rather than the auto-extracted first frame.
       * Uploading a NEW video resets this: a poster belongs to the clip it introduces, and
       * silently keeping the previous one would leave a still that no longer matches.
       */
      posterCustom?: boolean;
      playback: VideoPlayback;
    };

/** Normalize any locale (e.g. "es-US") to the two we key media on. */
export function mediaLocaleOf(locale: string): MediaLocale {
  return locale?.toLowerCase().startsWith("es") ? "es" : "en";
}

export const MEDIA_SURFACES: MediaSurface[] = ["main", "apply", "ads"];
export const MEDIA_KINDS: MediaKind[] = ["hero", "og"];
export const MEDIA_LOCALES: MediaLocale[] = ["en", "es"];

export const SURFACE_LABELS: Record<MediaSurface, string> = {
  main: "Main page",
  apply: "Apply page",
  ads: "Ads page",
};

export const SURFACE_HINTS: Record<MediaSurface, string> = {
  main: "The line-of-business landing page people reach from your menu and from search.",
  apply: "The page the “Ready to apply now?” button goes to.",
  ads: "The paid-traffic funnel your Meta ads point at.",
};

export const KIND_LABELS: Record<MediaKind, string> = {
  hero: "Hero (image or video)",
  og: "Social share image",
};

export const KIND_HINTS: Record<MediaKind, string> = {
  hero: "The big visual at the top of the page. Upload a video here to use one instead of a photo.",
  og: "Shown when the page link is shared on Facebook, iMessage, WhatsApp, etc. Standard size is 1200×630. Images only — link previews can't play video.",
};

/** Only the `ads` surface is conditional: five lines have a get-covered funnel, three don't. */
export function surfacesFor(lob: LobSlug): MediaSurface[] {
  return LOBS[lob].hasAdsFunnel ? MEDIA_SURFACES : ["main", "apply"];
}

/** Live page path for the admin's "View live page" link. */
export function livePathFor(lob: LobSlug, surface: MediaSurface, locale: MediaLocale): string {
  const def = LOBS[lob];
  switch (surface) {
    case "main":
      return `/${locale}${def.path[locale]}`;
    case "apply":
      return `/${locale}${def.applyPath[locale]}`;
    case "ads":
      return `/${locale}${def.path[locale]}/${locale === "es" ? "obtener-cobertura" : "get-covered"}`;
  }
}

/** One editable cell in the admin grid. */
export type PageMediaRow = {
  lob: LobSlug;
  surface: MediaSurface;
  kind: MediaKind;
  locale: MediaLocale;
  /** The admin's saved override, or null when the page is on its built-in default. */
  override: HeroMedia | null;
  /** What the page shows with no override — a still on nearly every cell, a video on the few
   *  that ship one (see `DEFAULT_HERO_VIDEO` in defaults.ts). */
  defaultMedia: HeroMedia;
};

export { LOBS, LOB_SLUGS, type LobSlug };
