import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import AcaConfirmationSignForm from "@/components/aca-confirmation/sign-form";

/**
 * The client's signing page for the ACA application review confirmation (CMS e-signature).
 * en /aca/confirmation/[token], es /aca/confirmacion/[token].
 *
 * Like the IUL secure-capture page: the server renders only the shell, and the form loads in the
 * browser. That is deliberate, not a shortcut: the browser's fetch is what marks the link as
 * opened, so a link preview or a mail scanner that runs no JavaScript can't fake "opened".
 *
 * Middleware gives this route a bare header/footer and the `x-private-page` header, which keeps
 * Meta Pixel, Google Analytics and the CRM chat/tracking scripts off it: they would report the
 * tokenized URL, and the page shows a client's name and email.
 *
 * `noindex` + `no-referrer`, no og:url, no canonical, no site name, no image: the token in the URL
 * is the whole credential, and a preview of this link may show where others can see it, so the
 * title says only that there is a document to sign.
 */
const COPY = {
  en: { title: "Document to sign", description: "A private document to review and sign." },
  es: { title: "Documento para firmar", description: "Un documento privado para revisar y firmar." },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === "es" ? "es" : "en";
  const { title, description } = COPY[locale];
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    openGraph: { title, description, type: "website", locale: locale === "es" ? "es_ES" : "en_US" },
    twitter: { card: "summary", title, description },
  };
}

export default async function AcaConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AcaConfirmationSignForm token={token} />
    </main>
  );
}
