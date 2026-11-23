/*
 * app/[locale]/secure/[captureToken]/page.tsx (es: /seguro/<token>) — where a client types the
 * numbers they'd rather not say on a call, from a link the agent sent. Shared-intake-engine lines
 * (Health Coverage today); the IUL intake keeps its own /iul/secure page.
 *
 * Middleware marks it private (no Pixel, GA or CRM scripts: the token in the URL is a live
 * credential) with the bare header and footer.
 *
 * Like the application, it is served from its owner's domain (lib/tenancy/product-routes.ts
 * `decideTokenPage`): Isaac's links on isaacplans.com as before; an agent's only on the product
 * domain, inside the agent's shell. On isaacplans.com an agent's link sends everyone there (307):
 * nobody but the client has a view of this page.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import IntakeSecureCaptureForm from "@/components/intake/secure-capture-form";
import TenantShell from "@/components/tenant/tenant-shell";
import { buildSecureCaptureUrl } from "@/lib/intake-core/share-url";
import { readTenancyGates } from "@/lib/tenancy/gates";
import { captureTokenOwner, tokenOwnerFact } from "@/lib/tenancy/pages";
import { agentPagePath, decideTokenPage } from "@/lib/tenancy/product-routes";
import { agentPublicProfile } from "@/lib/tenancy/profile";
import { productPublicOrigin, productRedirectOrigin } from "@/lib/tenancy/site-urls";
import { appSurface, isProductSurface } from "@/lib/tenancy/surface";

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
  // The product domain carries no image hosted on Isaac's accounts: a text-only preview there.
  const product = isProductSurface();
  const images = product ? undefined : [{ url: image, width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    // The token is the whole credential: never indexed, never sent on as a Referer.
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "es" ? "es_ES" : "en_US",
      ...(images ? { images } : {}),
    },
    twitter: product ? { card: "summary", title, description } : { card: "summary_large_image", title, description, images },
  };
}

export default async function IntakeSecureCapturePage({ params }: { params: Promise<{ captureToken: string }> }) {
  const { captureToken } = await params;
  const locale = (await getLocale()) === "es" ? "es" : "en";
  const owner = await captureTokenOwner(captureToken);
  const verdict = decideTokenPage({
    surface: appSurface(),
    lob: owner.kind === "agent" || owner.kind === "platform" ? owner.lob : "",
    owner: tokenOwnerFact(owner),
    gates: readTenancyGates(),
    keepsMainView: false,
    productConfigured: productPublicOrigin() !== null,
  });

  if (verdict === "retry") throw new Error("The secure link's owner could not be looked up. Try again.");
  if (verdict === "not_found") notFound();
  if (verdict === "redirect") {
    // Never to the site answering this request or to Isaac's own (a redirect loop): a 404 instead.
    const productOrigin = productRedirectOrigin({ requestHost: (await headers()).get("host") });
    if (!productOrigin) notFound();
    redirect(buildSecureCaptureUrl(captureToken, locale, productOrigin));
  }

  if (verdict === "tenant" && owner.kind === "agent") {
    const agent = agentPublicProfile(owner.agent);
    return (
      <TenantShell
        agent={agent}
        locale={locale}
        languageHrefs={{
          en: buildSecureCaptureUrl(captureToken, "en", ""),
          es: buildSecureCaptureUrl(captureToken, "es", ""),
        }}
        privacyHref={agentPagePath(locale, agent.slug ?? "", "privacy")}
      >
        <div className="flex-1 bg-white dark:bg-gray-950">
          <IntakeSecureCaptureForm captureToken={captureToken} />
        </div>
      </TenantShell>
    );
  }

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <IntakeSecureCaptureForm captureToken={captureToken} />
    </main>
  );
}
