import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { SupportedLocale } from "@/lib/seo/i18n";
import SecureCaptureForm from "@/components/iul-intake/secure-capture-form";

/**
 * Preview card artwork, pinned to JPEG rather than `f_auto`.
 *
 * `f_auto` picks a format from the requester's `Accept` header, and link previews are fetched by
 * crawlers whose headers are unreliable: measured on these exact images, a modern header gets a
 * 50 KB WebP while a crawler sending a wildcard Accept header gets a 72 KB JPEG. That is two
 * derived assets, two cold-start transcodes, and a blank card on any crawler that advertises
 * WebP but cannot render it in a preview. Pinning gives every recipient the same file. Same
 * reasoning as `HERO_VIDEO_TRANSFORM` in `lib/page-media/cloudinary-urls.ts`.
 *
 * 72 KB also matters on its own: WhatsApp demotes a link to a small thumbnail above roughly
 * 600 KB, and the sources here are 1.5 MB PNGs. The 1731×909 originals are already within a
 * rounding error of the 1.91:1 card ratio, so 1200×630 crops essentially nothing.
 */
const OG_TRANSFORM = "f_jpg,q_auto:good,w_1200,h_630,c_fill";
const CLOUDINARY = "https://res.cloudinary.com/isaacdev/image/upload";

const ogImage = (publicId: string) => `${CLOUDINARY}/${OG_TRANSFORM}/${publicId}`;

/**
 * Deliberately unbranded, and deliberately vague about what the page collects.
 *
 * This card lands in a text message that anyone glancing at the phone can read, so it says only
 * that the link is secure — never "Social Security number", never "bank details", never the
 * agency name. The previous copy named both, which is worse than it sounds: a page with no
 * Open Graph tags still unfurls, because WhatsApp and iMessage fall back to `<title>` and the
 * meta description. So the choice was never "card or no card", only what the card would say.
 *
 * No product, no company, no "insurance". Somebody seeing this on a lock screen learns that a
 * link is encrypted and nothing else about the recipient's business.
 */
const COPY: Record<SupportedLocale, { title: string; description: string; alt: string }> = {
  en: {
    title: "Secure Information",
    description: "A private, encrypted link to send your information safely.",
    alt: "Secure information — protected, private, encrypted",
  },
  es: {
    title: "Información Segura",
    description: "Un enlace privado y cifrado para enviar su información de forma segura.",
    alt: "Información segura — protegida, privada, encriptada",
  },
};

const OG_IMAGES: Record<SupportedLocale, string> = {
  en: ogImage("v1787754345/secure_info_english_laxwdu.png"),
  es: ogImage("v1787754345/secure_info_spanish_zxugmp.png"),
};

/**
 * `noindex` and `no-referrer` are not optional here — the token in this URL is the whole
 * credential, and a capture link sitting in a search index would be a live one.
 *
 * Two omissions on purpose. There is no `og:url` and no canonical: both would echo the tokenised
 * URL into the page body and into every preview cache that stores it, and a canonical is
 * meaningless anyway when each link is unique. There is no `siteName`, because that is the one
 * field whose entire job is branding.
 *
 * Rendering this card cannot mark the link as opened. `openedAt` is stamped by the client page's
 * own fetch to the capture API, which only runs in a browser — a crawler that renders no
 * JavaScript never reaches it. That matters because the agent's panel reads "opened" as "the
 * client is looking at it right now", and a preview unfurling in a chat would otherwise fake it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = ((await getLocale()) === "es" ? "es" : "en") as SupportedLocale;
  const { title, description, alt } = COPY[locale];
  const images = [{ url: OG_IMAGES[locale], width: 1200, height: 630, alt }];

  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "es" ? "es_ES" : "en_US",
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function IulSecureCapturePage({
  params,
}: {
  params: Promise<{ captureToken: string }>;
}) {
  const { captureToken } = await params;
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <SecureCaptureForm captureToken={captureToken} />
    </main>
  );
}
