/*
 * app/[locale]/health-alternative/intake/[token]/page.tsx — the client-facing Health Coverage application.
 *
 * Public by design: there is no sign-in, so the unguessable token in this URL *is* the credential
 * (plus the device cookie that claims it on first open). That is why the metadata below is
 * noindex + `referrer: "no-referrer"` — a token must never leak through a Referer header to an
 * external site the client happens to click through to.
 *
 * Which domain serves it follows the application's owner (lib/tenancy/product-routes.ts
 * `decideTokenPage`): Isaac's applications only on isaacplans.com, exactly as before; an agent's
 * only on the product domain, inside that agent's shell. On isaacplans.com an agent's client is sent
 * there (307, same path); the agent and any other signed-in operator stay, and the API answers them.
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import IntakeForm from "@/components/intake/intake-form";
import TenantShell from "@/components/tenant/tenant-shell";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { buildIntakeShareUrl } from "@/lib/intake-core/share-url";
import { guideScopeFor } from "@/lib/impact-quote/sync";
import { ogLocaleOf } from "@/lib/seo/i18n";
import { readTenancyGates } from "@/lib/tenancy/gates";
import { callerKeepsMainView, intakeTokenOwner, tokenOwnerFact, type TokenOwner } from "@/lib/tenancy/pages";
import { agentPagePath, decideTokenPage } from "@/lib/tenancy/product-routes";
import { agentPublicProfile } from "@/lib/tenancy/profile";
import { platformName, productPublicOrigin, productRedirectOrigin } from "@/lib/tenancy/site-urls";
import { appSurface, isProductSurface } from "@/lib/tenancy/surface";

type SupportedLocale = "en" | "es";

const LOB = "health-alternative";

const COPY: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "Your Secure Health Coverage Application | Isaac Plans Insurance",
    description: "Complete your health coverage application securely from your phone. Your progress saves automatically.",
  },
  es: {
    title: "Su Solicitud Segura de Cobertura de Salud | Isaac Plans Insurance",
    description: "Complete su solicitud de cobertura de salud de forma segura desde su teléfono. Su progreso se guarda automáticamente.",
  },
};

/** The product domain's titles: the agent's name in place of Isaac's agency. */
const PRODUCT_TITLE: Record<SupportedLocale, string> = {
  en: "Your Secure Health Coverage Application",
  es: "Su Solicitud Segura de Cobertura de Salud",
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const locale = (((await getLocale()) === "es" ? "es" : "en") as SupportedLocale);
  const { title, description } = COPY[locale];
  const privateTags: Metadata = {
    robots: { index: false, follow: false, nocache: true },
    // The token in this URL is the credential — keep it out of the Referer header.
    referrer: "no-referrer",
  };
  if (isProductSurface()) {
    const { token } = await params;
    const owner = await intakeTokenOwner(LOB, token);
    const name = owner.kind === "agent" ? agentPublicProfile(owner.agent).displayName : platformName();
    const productTitle = `${PRODUCT_TITLE[locale]} | ${name}`;
    return {
      title: productTitle,
      description,
      ...privateTags,
      openGraph: { title: productTitle, description, type: "website", siteName: platformName(), locale: ogLocaleOf(locale) },
      twitter: { card: "summary", title: productTitle, description },
    };
  }
  return {
    title,
    description,
    ...privateTags,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale),
    },
    twitter: { card: "summary", title, description },
  };
}

/** Which surface serves this token, and how (see the header). */
async function verdictFor(owner: TokenOwner) {
  const surface = appSurface();
  const keepsMainView =
    surface === "main" && owner.kind === "agent" ? await callerKeepsMainView(owner.ownerUserId) : false;
  return decideTokenPage({
    surface,
    lob: LOB,
    owner: tokenOwnerFact(owner),
    gates: readTenancyGates(),
    keepsMainView,
    productConfigured: productPublicOrigin() !== null,
  });
}

export default async function HealthAlternativeIntakeFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale: SupportedLocale = (await getLocale()) === "es" ? "es" : "en";
  const owner = await intakeTokenOwner(LOB, token);
  const verdict = await verdictFor(owner);

  if (verdict === "retry") throw new Error("The application's owner could not be looked up. Try again.");
  if (verdict === "not_found") notFound();
  if (verdict === "redirect") {
    // Never to the site answering this request or to Isaac's own (a redirect loop): a 404 instead.
    const productOrigin = productRedirectOrigin({ requestHost: (await headers()).get("host") });
    if (!productOrigin) notFound();
    redirect(buildIntakeShareUrl(requireIntakeConfig(LOB), token, locale, productOrigin));
  }

  if (verdict === "tenant" && owner.kind === "agent") {
    const agent = agentPublicProfile(owner.agent);
    const config = requireIntakeConfig(LOB);
    return (
      <TenantShell
        agent={agent}
        locale={locale}
        languageHrefs={{
          en: buildIntakeShareUrl(config, token, "en", ""),
          es: buildIntakeShareUrl(config, token, "es", ""),
        }}
        privacyHref={agentPagePath(locale, agent.slug ?? "", "privacy")}
      >
        <div className="min-h-full flex-1 bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
          {/* A pick on this agent's guide (`guide:<slug>`) fills the application it started. */}
          <IntakeForm lob={LOB} token={token} guideScope={guideScopeFor(agent.slug)} />
        </div>
      </TenantShell>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <IntakeForm lob={LOB} token={token} />
    </main>
  );
}
