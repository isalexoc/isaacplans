/**
 * Agent CRM affiliate page — the one place every link, video, and share image lives.
 *
 * The page at /agent-crm is aimed at other insurance agents, not at clients. Everything an
 * outsider would want to swap (the walkthrough video, its poster, the social card) is a constant
 * in this file rather than a literal buried in JSX, so replacing the placeholder creative is a
 * one-line edit per language instead of a hunt through a 600-line page.
 *
 * Same approach as `lib/referral-partners/images.ts`, for the same reason: the artwork lands
 * later than the layout does.
 */

/**
 * The affiliate link, verbatim.
 *
 * Deliberately used exactly as issued, with nothing appended. `fpr` is the FirstPromoter referral
 * parameter that credits the signup, and no per-button UTM we could bolt on would ever show up in
 * that dashboard — so extra params would add risk to the one thing on this page that must not
 * break, and buy nothing. Every button on the page points here.
 */
export const AGENT_CRM_AFFILIATE_URL = "https://www.agent-crm.com/?fpr=isaacplans";

/** Contact `source` stamped on agents captured by the "questions first" form. */
export const AGENT_CRM_AFFILIATE_LEAD_SOURCE = "agent_crm_affiliate";

/** CRM tag applied to those contacts, so recruits never mix into a client workflow. */
export const AGENT_CRM_AFFILIATE_LEAD_TAG = "agent-crm-affiliate";

/* ────────────────────────── Creative (placeholders) ────────────────────────── */

/**
 * The walkthrough video, per language.
 *
 * `url` is null until the real clips are recorded — the player renders a designed "coming soon"
 * frame instead of a play button that does nothing. Drop a YouTube link or a Cloudinary/direct
 * `.mp4` in and the same slot becomes a click-to-play player with no other change.
 *
 * `posterUrl` is the still shown before play; null falls back to a brand gradient. It goes through
 * `next/image`, so it must be on a host listed in next.config.mjs `remotePatterns` — today that's
 * Cloudinary or Sanity. A YouTube thumbnail (`i.ytimg.com`) would need that host added first, so
 * uploading the frame to Cloudinary is the cheaper path.
 */
export type AgentCrmVideo = {
  url: string | null;
  posterUrl: string | null;
};

/** PLACEHOLDER — replace `url` with the English walkthrough once it is recorded. */
export const AGENT_CRM_VIDEO_EN: AgentCrmVideo = {
  url: null,
  posterUrl: null,
};

/** PLACEHOLDER — replace `url` with the Spanish walkthrough once it is recorded. */
export const AGENT_CRM_VIDEO_ES: AgentCrmVideo = {
  url: null,
  posterUrl: null,
};

export function agentCrmVideo(locale: "en" | "es"): AgentCrmVideo {
  return locale === "es" ? AGENT_CRM_VIDEO_ES : AGENT_CRM_VIDEO_EN;
}

/**
 * Social share cards, per language. Purpose-designed artwork carrying its own headline — an agent
 * forwarding this link to another agent sees a card written in the language the link opens in.
 *
 * Both masters are 1731×909 PNGs of about 1.5 MB, which is far too heavy for a WhatsApp preview,
 * so they are delivered through this transformation chain:
 *
 * - `w_1200,c_limit` — scales down to the 1200 px OG width. `c_limit` rather than `c_fill`
 *   because the source is already 1.904:1 against OG's 1.905:1; there is nothing to crop, and
 *   `c_fill` would only risk shaving a pixel row off text that sits near the card's edge.
 * - `f_auto,q_auto` — measured, not assumed: a scraper sending no modern-format `Accept` gets
 *   **JPEG at ~107 KB** (Cloudinary falls back to JPEG, not to the 296 KB PNG), and a browser gets
 *   WebP at ~78 KB. A 93% cut with no format-support risk to the crawlers that matter.
 *
 * Dimensions are intentionally left out of the page metadata — crawlers read them from the file,
 * so a differently-sized replacement can't leave a stale width/height behind.
 */
const OG_TRANSFORM = "w_1200,c_limit,f_auto,q_auto";

export const AGENT_CRM_OG_IMAGE_EN = `https://res.cloudinary.com/isaacdev/image/upload/${OG_TRANSFORM}/v1787281762/a7ba13a3-0bfd-44ee-8bd7-68f572e7b53d_sqn19f.png`;

export const AGENT_CRM_OG_IMAGE_ES = `https://res.cloudinary.com/isaacdev/image/upload/${OG_TRANSFORM}/v1787281763/0341ac60-8dce-4d30-b358-78b7238cee4c_m9kcwm.png`;

export function agentCrmOgImage(locale: "en" | "es"): string {
  return locale === "es" ? AGENT_CRM_OG_IMAGE_ES : AGENT_CRM_OG_IMAGE_EN;
}

/**
 * Isaac's headshot for the "who is telling you this" strip — re-exported from the get-covered
 * constants rather than pasted, so a new photo is swapped in one place for the whole site.
 */
export { FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT as AGENT_CRM_ISAAC_PHOTO } from "@/lib/get-covered-fast/constants";

/* ────────────────────────── Video URL parsing ────────────────────────── */

export type ParsedAgentCrmVideo = {
  /** `embed` renders an iframe (YouTube/Vimeo); `file` renders a native `<video>`. */
  kind: "embed" | "file";
  src: string;
};

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];
const VIDEO_FILE_EXTENSION = /\.(mp4|webm|ogv|ogg|mov|m4v)$/i;

/**
 * Turn a pasted video URL into something renderable, or null if it isn't one.
 *
 * Intentionally standalone rather than importing the blog's richer parser: this page must build
 * on `main` on its own, and coupling a marketing page's hero to an unrelated feature branch would
 * mean a video post's schema change could blank the CRM pitch. It only needs the three shapes the
 * walkthrough will ever be published in — a YouTube link, a Vimeo link, or a direct file.
 *
 * Embed URLs come back carrying their own autoplay params because the player only ever mounts
 * them in response to a click.
 */
export function parseAgentCrmVideoUrl(raw: string | null | undefined): ParsedAgentCrmVideo | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = segments[0];
    return id ? { kind: "embed", src: youtubeEmbed(id) } : null;
  }

  if (YOUTUBE_HOSTS.includes(host)) {
    const id =
      url.searchParams.get("v") ||
      (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live"
        ? segments[1]
        : null);
    return id ? { kind: "embed", src: youtubeEmbed(id) } : null;
  }

  if (VIMEO_HOSTS.includes(host)) {
    const id = segments.find((s) => /^\d+$/.test(s));
    return id
      ? { kind: "embed", src: `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0` }
      : null;
  }

  if (VIDEO_FILE_EXTENSION.test(url.pathname)) {
    return { kind: "file", src: url.toString() };
  }

  return null;
}

function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`;
}
