/*
 * app/[locale]/secure/[captureToken]/page.tsx (es: /seguro/<token>) — where a client types the
 * numbers they'd rather not say on a call, from a link the agent sent. Shared-intake-engine lines
 * (Health Coverage today); the IUL intake keeps its own /iul/secure page.
 *
 * Middleware marks it private (no Pixel, GA or CRM scripts: the token in the URL is a live
 * credential) with the bare header and footer.
 */

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import IntakeSecureCaptureForm from "@/components/intake/secure-capture-form";

/** The IUL page's preview art: neutral, no product or agency named, pinned to JPEG. */
const OG = "https://res.cloudinary.com/isaacdev/image/upload/f_jpg,q_auto:good,w_1200,h_630,c_fill";

/**
 * Deliberately vague. The preview lands in a text message anyone glancing at the phone can read,
 * so it says only that the link is secure — never "Social Security number", "bank", or a product.
 */
const COPY = {
  en: {
    title: "Secure Information",
    description: "A private, encrypted link to send your information safely.",
    image: `${OG}/v1787754345/secure_info_english_laxwdu.png`,
  },
  es: {
    title: "Información Segura",
    description: "Un enlace privado y cifrado para enviar su información de forma segura.",
    image: `${OG}/v1787754345/secure_info_spanish_zxugmp.png`,
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === "es" ? "es" : "en";
  const { title, description, image } = COPY[locale];
  const images = [{ url: image, width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    // The token is the whole credential: never indexed, never sent on as a Referer.
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    openGraph: { title, description, type: "website", locale: locale === "es" ? "es_ES" : "en_US", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function IntakeSecureCapturePage({ params }: { params: Promise<{ captureToken: string }> }) {
  const { captureToken } = await params;
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <IntakeSecureCaptureForm captureToken={captureToken} />
    </main>
  );
}
