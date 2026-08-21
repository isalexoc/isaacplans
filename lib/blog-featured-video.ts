/**
 * Featured-video support for blog posts.
 *
 * A post's featured *image* stays the canonical artwork: blog listings, search results,
 * `og:image`, and the newsletter all keep using it. This module powers only the one extra thing an
 * editor can ask for — when the post itself is opened, play a video in the slot where that image
 * would otherwise sit.
 *
 * Videos are referenced by URL and never uploaded to Sanity. The clips already live on YouTube or
 * in Cloudinary (where the Social Media Studio writes them), so re-hosting them in the CMS would
 * mean paying for the same bytes twice and doubling the place a bad take has to be deleted from.
 *
 * Everything here is pure string work with no imports, so the Studio schema can validate a pasted
 * link with the exact function the page later renders it with — the two can't drift. When a URL
 * doesn't parse, `parseBlogVideoUrl` returns null and the page falls back to the plain featured
 * image: a mistyped link can degrade the hero, never blank it.
 */

/** How the player is shaped. Vertical is for Reels/Shorts-style clips. */
export type BlogVideoOrientation = "landscape" | "vertical" | "square";

/** The `featuredVideo` object as it comes back from Sanity. Every field is editor-optional. */
export type BlogFeaturedVideo = {
  url?: string | null;
  orientation?: string | null;
};

export type ParsedBlogVideo = {
  /** `embed` renders an iframe (YouTube/Vimeo); `file` renders a native `<video>`. */
  kind: "embed" | "file";
  provider: "youtube" | "vimeo" | "file";
  /** iframe `src` or `<video>` `src`. Embed URLs already carry their autoplay params, because
   *  the player only ever mounts them in response to a click. */
  src: string;
  orientation: BlogVideoOrientation;
};

const ORIENTATIONS: BlogVideoOrientation[] = ["landscape", "vertical", "square"];

const YOUTUBE_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
];
const YOUTUBE_SHORT_HOSTS = ["youtu.be", "www.youtu.be"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];

/** Deliberately not pinned to today's 11 characters — YouTube has never promised that length. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}$/;
const VIDEO_FILE_EXTENSION = /\.(mp4|webm|ogv|ogg|mov|m4v)$/i;

/** Poster dimensions per orientation, fed to `cloudinaryFetchedImageUrl` so the still that stands
 *  in for the video is cropped to the player's shape instead of being letterboxed into it. */
const POSTER_SIZES: Record<BlogVideoOrientation, { width: number; height: number }> = {
  landscape: { width: 1600, height: 900 },
  vertical: { width: 720, height: 1280 },
  square: { width: 1080, height: 1080 },
};

export function blogVideoPosterSize(orientation: BlogVideoOrientation) {
  return POSTER_SIZES[orientation];
}

function orientationOf(value: string | null | undefined): BlogVideoOrientation {
  return ORIENTATIONS.includes(value as BlogVideoOrientation)
    ? (value as BlogVideoOrientation)
    : "landscape";
}

/** YouTube publishes the same video under half a dozen URL shapes; accept all of them. */
function youtubeIdFrom(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean);

  if (YOUTUBE_SHORT_HOSTS.includes(url.hostname.toLowerCase())) {
    return segments[0] && YOUTUBE_ID.test(segments[0]) ? segments[0] : null;
  }

  if (segments[0] === "watch") {
    const id = url.searchParams.get("v");
    return id && YOUTUBE_ID.test(id) ? id : null;
  }

  // /embed/ID, /shorts/ID, /live/ID, /v/ID
  if (["embed", "shorts", "live", "v"].includes(segments[0]) && segments[1]) {
    return YOUTUBE_ID.test(segments[1]) ? segments[1] : null;
  }

  return null;
}

/**
 * Vimeo puts the numeric id at a different depth per URL shape (`/123`, `/channels/x/123`,
 * `/video/123`), so find the first all-digits segment rather than guessing an index.
 *
 * The trailing hash on an unlisted video (`vimeo.com/123/abc123`) is not decoration — without it
 * the embed returns a privacy error, so it has to survive into the player URL.
 */
function vimeoFrom(url: URL): { id: string; hash: string | null } | null {
  const segments = url.pathname.split("/").filter(Boolean);
  const idIndex = segments.findIndex((segment) => /^\d+$/.test(segment));
  if (idIndex === -1) return null;

  const next = segments[idIndex + 1];
  const hash =
    url.searchParams.get("h") ||
    (next && /^[A-Za-z0-9]+$/.test(next) && !/^\d+$/.test(next) ? next : null);

  return { id: segments[idIndex], hash };
}

/**
 * Turn whatever the editor pasted into something the player can mount, or null if it isn't a
 * video link this site knows how to play.
 */
export function parseBlogVideoUrl(
  video: BlogFeaturedVideo | null | undefined
): ParsedBlogVideo | null {
  const raw = video?.url?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  // The site is served over https, so an http video would be blocked as mixed content and the
  // player would sit there dead. Reject it here and the Studio surfaces it as a validation error.
  if (url.protocol !== "https:") return null;

  const orientation = orientationOf(video?.orientation);
  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.includes(host) || YOUTUBE_SHORT_HOSTS.includes(host)) {
    const id = youtubeIdFrom(url);
    if (!id) return null;
    const params = new URLSearchParams({
      autoplay: "1",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
    });
    // nocookie: nothing is set until someone actually presses play, and the iframe itself only
    // mounts on that click.
    return {
      kind: "embed",
      provider: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${id}?${params}`,
      orientation,
    };
  }

  if (VIMEO_HOSTS.includes(host)) {
    const vimeo = vimeoFrom(url);
    if (!vimeo) return null;
    const params = new URLSearchParams({ autoplay: "1" });
    if (vimeo.hash) params.set("h", vimeo.hash);
    return {
      kind: "embed",
      provider: "vimeo",
      src: `https://player.vimeo.com/video/${vimeo.id}?${params}`,
      orientation,
    };
  }

  // Direct file — anything with a video extension, plus Cloudinary video delivery URLs, which
  // often carry no extension at all once a transformation is applied.
  const isCloudinaryVideo =
    host === "res.cloudinary.com" && url.pathname.includes("/video/upload/");
  if (VIDEO_FILE_EXTENSION.test(url.pathname) || isCloudinaryVideo) {
    return { kind: "file", provider: "file", src: url.toString(), orientation };
  }

  return null;
}

/** Studio-side validation. Shares the parser so the schema can't accept a link the page drops. */
export function isSupportedBlogVideoUrl(url: string | null | undefined): boolean {
  return parseBlogVideoUrl({ url }) !== null;
}
