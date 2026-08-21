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

/* ────────────────────────── Creative ────────────────────────── */

const CLOUDINARY_IMAGE = "https://res.cloudinary.com/isaacdev/image/upload";
const CLOUDINARY_VIDEO = "https://res.cloudinary.com/isaacdev/video/upload";

/**
 * Cloudinary public ids for the two designed cards. They do double duty: `og:image` for shares,
 * and on-page artwork in the hero-media slot (the Spanish video's poster, the English still).
 * Kept as bare ids so each use can pick its own transformation chain.
 */
const CARD_EN = "v1787281762/a7ba13a3-0bfd-44ee-8bd7-68f572e7b53d_sqn19f.png";
const CARD_ES = "v1787281763/0341ac60-8dce-4d30-b358-78b7238cee4c_m9kcwm.png";

/**
 * On-page artwork sizing. The slot is capped by a `max-w-5xl` column, so it never renders wider
 * than ~1024 CSS px; 1600 keeps it crisp on a 2× display without shipping the 1.5 MB master.
 * `c_limit` never upscales, so a smaller replacement card degrades gracefully.
 */
const HERO_IMAGE_TRANSFORM = "w_1600,c_limit,f_auto,q_auto";

/**
 * Delivery chain for the walkthrough. Measured against the real master, not assumed:
 *
 * | variant                       | dimensions | size     |
 * | ----------------------------- | ---------- | -------- |
 * | original                      | 1994×1080  | 493.9 MB |
 * | `w_1280,q_auto`               | 1280×692   |  32.1 MB |
 * | `w_1600,q_auto`  ← width kept | 1600×866   |  40.7 MB |
 * | `w_1280,q_auto:eco`           | 1280×692   |  27.3 MB |
 *
 * 1600 over the cheaper 1280 because this is a screen recording of a CRM: the whole point is
 * reading the pipeline and the automation steps, and downscaling a 1994 px capture to 1280
 * softens exactly the small UI text somebody pressed play to look at. The extra 8.6 MB buys back
 * that legibility and costs nothing to the visitors who never press play — the player is a
 * click-to-play facade, so the file is not fetched until it is asked for, and it then streams
 * progressively rather than downloading up front.
 *
 * ─── Why the format is PINNED rather than `f_auto` ───
 *
 * `f_auto` looks like free bandwidth and is a trap for a long video. Cloudinary derives a separate
 * asset per browser family, and each one is transcoded on the FIRST request that asks for it —
 * from a 493.9 MB master, which is minutes of waiting. Measured on this exact video:
 *
 * | client                       | delivered         | size                               |
 * | ---------------------------- | ----------------- | ---------------------------------- |
 * | Chrome / Firefox / Android   | `video/webm; vp9` | 31.5 MB                            |
 * | Safari on iPhone             | `video/mp4; hvc1` | 38.7 MB                            |
 * | any client sending Save-Data | `video/mp4; avc1` | was still transcoding when probed  |
 *
 * Three separate files, three separate cold starts — and the third was caught mid-transcode.
 * Warming the page in Chrome would do nothing for the first visitor on an iPhone: they would be
 * the one paying for the HEVC transcode, on a landing page, having just pressed play.
 *
 * So the transformation names one format explicitly. H.264 in MP4 is the universally supported
 * combination — every iPhone, Android, Safari, Chrome, Firefox and smart TV plays it — so exactly
 * ONE derived asset exists, one warm-up covers every visitor on earth, and no device is left that
 * can trigger a fresh transcode. Quality is pinned to `q_auto:good` rather than plain `q_auto` for
 * the same reason: `q_auto` is what branched on the Save-Data header above and quietly produced a
 * fourth variant.
 *
 * The cost is real and accepted: Chrome downloads H.264 instead of the ~9 MB smaller VP9. That is
 * the right trade for a page whose whole job is that the video plays instantly for whoever just
 * pressed play. Bandwidth is cheap; a prospect watching a spinner is not.
 *
 * After changing this string, or the video behind it, run `pnpm warm:media` — until that finishes,
 * the first visitor pays for the transcode.
 */
const VIDEO_TRANSFORM = "w_1600,c_limit,f_mp4,vc_h264,q_auto:good";

/**
 * What fills the slot under "the walkthrough" heading, per language.
 *
 * Exactly one of `videoUrl` / `imageUrl` is expected to be set. A video renders a click-to-play
 * player; an image renders a plain still, for a language whose clip has not been recorded yet.
 * With neither, the slot falls back to a designed "coming soon" frame rather than a play button
 * that does nothing.
 *
 * Everything here goes through `next/image` or a native `<video>`, so any replacement must sit on
 * a host listed in next.config.mjs `remotePatterns` — today Cloudinary or Sanity. A YouTube
 * thumbnail (`i.ytimg.com`) would need that host added first, so uploading the frame to
 * Cloudinary is the cheaper path.
 */
export type AgentCrmHeroMedia = {
  /** YouTube, Vimeo, or a direct/Cloudinary video file. Null when there is no clip yet. */
  videoUrl: string | null;
  /** Still shown before play. Null falls back to a brand gradient behind the play button. */
  posterUrl: string | null;
  /** Static artwork used INSTEAD of a player while `videoUrl` is null. */
  imageUrl: string | null;
};

/**
 * English has no walkthrough recorded yet, so the slot shows the English card as a still. The
 * section's English copy is written for a picture rather than a tour — see `messages/en`; when the
 * clip lands, set `videoUrl` here and put the walkthrough wording back.
 */
export const AGENT_CRM_MEDIA_EN: AgentCrmHeroMedia = {
  videoUrl: null,
  posterUrl: null,
  imageUrl: `${CLOUDINARY_IMAGE}/${HERO_IMAGE_TRANSFORM}/${CARD_EN}`,
};

/** Spanish walkthrough, 8m 06s. Poster is the Spanish card, so the slot is branded before play. */
export const AGENT_CRM_MEDIA_ES: AgentCrmHeroMedia = {
  videoUrl: `${CLOUDINARY_VIDEO}/${VIDEO_TRANSFORM}/v1787320960/El_CRM_con_el_que_manejo_mi_negocio_de_segur_2026-08-21_09-40-14_lrej6b.mp4`,
  posterUrl: `${CLOUDINARY_IMAGE}/${HERO_IMAGE_TRANSFORM}/${CARD_ES}`,
  imageUrl: null,
};

export function agentCrmMedia(locale: "en" | "es"): AgentCrmHeroMedia {
  return locale === "es" ? AGENT_CRM_MEDIA_ES : AGENT_CRM_MEDIA_EN;
}

/**
 * Every remote asset this page delivers, so `pnpm warm:media` can request each one and force
 * Cloudinary to generate the derived file before a visitor ever asks for it.
 *
 * Derived from the same constants the page renders from, deliberately: a hand-maintained list of
 * URLs to warm is a list that goes stale the first time somebody edits a transformation, and a
 * stale warm list fails silently — everything looks warmed while the URL actually in production
 * is still cold.
 */
export function agentCrmMediaUrls(): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const [locale, media] of [
    ["en", AGENT_CRM_MEDIA_EN],
    ["es", AGENT_CRM_MEDIA_ES],
  ] as const) {
    if (media.videoUrl) out.push({ label: `${locale} video`, url: media.videoUrl });
    if (media.posterUrl) out.push({ label: `${locale} poster`, url: media.posterUrl });
    if (media.imageUrl) out.push({ label: `${locale} still`, url: media.imageUrl });
  }
  out.push({ label: "en og card", url: AGENT_CRM_OG_IMAGE_EN });
  out.push({ label: "es og card", url: AGENT_CRM_OG_IMAGE_ES });
  return out;
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

export const AGENT_CRM_OG_IMAGE_EN = `${CLOUDINARY_IMAGE}/${OG_TRANSFORM}/${CARD_EN}`;

export const AGENT_CRM_OG_IMAGE_ES = `${CLOUDINARY_IMAGE}/${OG_TRANSFORM}/${CARD_ES}`;

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
