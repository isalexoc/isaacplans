import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { SupportedLocale } from "@/lib/seo/i18n";
import SecureCaptureForm from "@/components/iul-intake/secure-capture-form";

const COPY: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Send Your Details Securely | Isaac Plans Insurance",
    description: "Enter your Social Security number and bank details privately, from your own phone.",
  },
  es: {
    title: "Envíe sus datos de forma segura | Isaac Plans Insurance",
    description:
      "Ingrese su número de seguro social y sus datos bancarios de forma privada, desde su propio teléfono.",
  },
};

/**
 * Deliberately thinner metadata than the intake page: no Open Graph, no preview image.
 *
 * That page wants to unfurl nicely in WhatsApp because it is a friendly invitation to fill in an
 * application. This one is a request for a Social Security number, and a rich preview card would
 * put "send us your SSN" in a chat thread where anybody scrolling past can read it. `noindex` and
 * `no-referrer` are not optional here — the token in this URL is the whole credential.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = ((await getLocale()) === "es" ? "es" : "en") as SupportedLocale;
  const { title, description } = COPY[locale];
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
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
