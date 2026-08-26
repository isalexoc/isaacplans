import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { SupportedLocale } from "@/lib/seo/i18n";
import DocumentCaptureForm from "@/components/iul-intake/document-capture-form";

/**
 * Preview card artwork, pinned to JPEG — the same assets and the same reasoning as the
 * secure-capture page.
 *
 * `f_auto` picks a format from the requester's `Accept` header, and link previews are fetched by
 * crawlers whose headers are unreliable: a modern header gets a WebP and a crawler sending a
 * wildcard gets a JPEG, which is two derived assets, two cold-start transcodes, and a blank card
 * on any crawler that advertises WebP but cannot render it. Pinning gives every recipient the same
 * 72 KB file, well under the roughly 600 KB above which WhatsApp demotes a link to a thumbnail.
 */
const OG_TRANSFORM = "f_jpg,q_auto:good,w_1200,h_630,c_fill";
const CLOUDINARY = "https://res.cloudinary.com/isaacdev/image/upload";

const ogImage = (publicId: string) => `${CLOUDINARY}/${OG_TRANSFORM}/${publicId}`;

/**
 * Unbranded, and deliberately vague about what is being collected.
 *
 * This card lands in a text message anyone glancing at the phone can read, so it says only that
 * the link is secure — never "driver's licence", never "green card", never the agency name.
 * Naming the document would tell a stranger something about the recipient's immigration or
 * licensing status, which is a worse disclosure than anything the upload itself risks.
 *
 * The same artwork as the secure-capture link on purpose: to a client, both are "the safe link my
 * agent sends me", and two different cards would make one of them look less official.
 */
const COPY: Record<SupportedLocale, { title: string; description: string; alt: string }> = {
  en: {
    title: "Secure Information",
    description: "A private, encrypted link to send your documents safely.",
    alt: "Secure information — protected, private, encrypted",
  },
  es: {
    title: "Información Segura",
    description: "Un enlace privado y cifrado para enviar sus documentos de forma segura.",
    alt: "Información segura — protegida, privada, encriptada",
  },
};

const OG_IMAGES: Record<SupportedLocale, string> = {
  en: ogImage("v1787754345/secure_info_english_laxwdu.png"),
  es: ogImage("v1787754345/secure_info_spanish_zxugmp.png"),
};

/**
 * `noindex` and `no-referrer` are not optional — the token in this URL is the whole credential,
 * and this link stays live for longer than the secure-capture one, so an indexed copy would be a
 * working upload endpoint rather than a spent one.
 *
 * No `og:url`, no canonical, no `siteName`: the first two would echo the tokenised URL into every
 * preview cache that stores it, and the third exists only to brand.
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

export default async function IulDocumentCapturePage({
  params,
}: {
  params: Promise<{ captureToken: string }>;
}) {
  const { captureToken } = await params;
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <DocumentCaptureForm captureToken={captureToken} />
    </main>
  );
}
