/*
 * app/[locale]/a/[slug]/privacy/page.tsx — an agent's privacy page, at
 * product.com/{locale}/{slug}/privacy (es: /privacidad). Product domain only; 404 on isaacplans.com.
 *
 * PLACEHOLDER TEXT, PENDING LEGAL REVIEW. Counsel writes the real notice (Phase 0: privacy
 * policy, DPA). Until then this says only what the product verifiably does: the agent, an
 * independent representative, is responsible for the client's information; the platform runs the
 * pages and stores it on the agent's behalf (a processor); sensitive numbers are encrypted at rest;
 * there are no advertising or analytics trackers on this domain; the only cookies are the
 * application's device cookie and the language. Keep it in step with the product, never ahead of it.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TenantShell from "@/components/tenant/tenant-shell";
import { AGENT_PAGE_NOT_FOUND_METADATA, agentPageMetadata, publicAgentForSlug } from "@/lib/tenancy/pages";
import { agentPageAlternates, agentPagePath, type ProductLocale } from "@/lib/tenancy/product-routes";
import { agentPublicProfile, formatWhatsapp, type AgentPublicProfile } from "@/lib/tenancy/profile";
import { platformName } from "@/lib/tenancy/site-urls";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; slug: string }>;

type Section = { title: string; body: string };

function privacyCopy(
  locale: ProductLocale,
  agent: AgentPublicProfile,
  platform: string
): { title: string; intro: string; sections: Section[] } {
  const name = agent.displayName;
  const whatsapp = formatWhatsapp(agent.whatsappE164);
  if (locale === "es") {
    return {
      title: "Privacidad",
      intro: `${name} es un representante independiente que le ayuda a solicitar su membresía de Impact Health Sharing. Esta página explica qué pasa con la información que usted da en las páginas de ${name} en ${platform}.`,
      sections: [
        {
          title: "Quién es responsable",
          body: `${name}, como representante independiente, decide cómo se usa su información para preparar y presentar su solicitud. ${platform} opera estas páginas y guarda la información por cuenta de ${name}, como encargado del tratamiento: no la usa para sus propios fines ni la vende.`,
        },
        {
          title: "Qué información se recoge",
          body: "Lo que usted escribe en la guía (cuántas personas va a cubrir y la fecha de nacimiento de la persona mayor) y en su solicitud: sus datos de contacto, las personas que va a cubrir y los datos de identidad y de pago que Impact pide.",
        },
        {
          title: "Para qué se usa",
          body: "Solo para preparar su solicitud a Impact Health Sharing y para comunicarse con usted sobre ella. Impact Health Sharing recibe su solicitud cuando se presenta y la maneja según su propia política de privacidad.",
        },
        {
          title: "Cómo se protege",
          body: "Los números delicados (Seguro Social o ITIN, cuenta bancaria, tarjeta) se guardan cifrados. Los enlaces a su solicitud son privados: no los comparta.",
        },
        {
          title: "Cookies",
          body: "Estas páginas usan solo lo necesario para funcionar: una cookie que mantiene su solicitud en este dispositivo y su idioma. No hay rastreadores de publicidad ni de analítica.",
        },
        {
          title: "Preguntas o borrar sus datos",
          body: whatsapp ? `Escríbale a ${name} por WhatsApp al ${whatsapp}.` : `Comuníquese con ${name}.`,
        },
      ],
    };
  }
  return {
    title: "Privacy",
    intro: `${name} is an independent representative who helps you apply for an Impact Health Sharing membership. This page explains what happens to the information you give on ${name}'s pages at ${platform}.`,
    sections: [
      {
        title: "Who is responsible",
        body: `${name}, as an independent representative, decides how your information is used to prepare and submit your application. ${platform} runs these pages and stores the information on ${name}'s behalf, as a processor: it does not use it for its own purposes and does not sell it.`,
      },
      {
        title: "What is collected",
        body: "What you type in the guide (how many people to cover and the oldest person's date of birth) and in your application: your contact details, the people you want to cover, and the identity and payment details Impact asks for.",
      },
      {
        title: "How it is used",
        body: "Only to prepare your application to Impact Health Sharing and to contact you about it. Impact Health Sharing receives your application when it is submitted and handles it under its own privacy policy.",
      },
      {
        title: "How it is protected",
        body: "Sensitive numbers (Social Security number or ITIN, bank account, card) are stored encrypted. The links to your application are private: don't share them.",
      },
      {
        title: "Cookies",
        body: "These pages use only what they need to work: a cookie that keeps your application on this device, and your language. There are no advertising or analytics trackers.",
      },
      {
        title: "Questions, or deleting your information",
        body: whatsapp ? `Message ${name} on WhatsApp at ${whatsapp}.` : `Contact ${name}.`,
      },
    ],
  };
}

const localeOf = (value: string): ProductLocale => (value === "es" ? "es" : "en");

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const row = await publicAgentForSlug(slug);
  if (!row) return AGENT_PAGE_NOT_FOUND_METADATA;
  const locale = localeOf(raw);
  const agent = agentPublicProfile(row);
  const copy = privacyCopy(locale, agent, platformName());
  return agentPageMetadata({
    title: `${copy.title} · ${agent.displayName}`,
    description: copy.intro,
    locale,
    path: agentPagePath(locale, row.slug, "privacy"),
  });
}

export default async function AgentPrivacyPage({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  const row = await publicAgentForSlug(slug);
  if (!row) notFound();
  const locale = localeOf(raw);
  const agent = agentPublicProfile(row);
  const copy = privacyCopy(locale, agent, platformName());
  return (
    <TenantShell
      agent={agent}
      locale={locale}
      languageHrefs={agentPageAlternates(row.slug, "privacy")}
      privacyHref={agentPagePath(locale, row.slug, "privacy")}
    >
      <article className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 text-[#14243a] sm:px-6 sm:py-12 dark:text-gray-100">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0b2a4a] dark:text-white">{copy.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-[#56657a] dark:text-gray-300">{copy.intro}</p>
        <div className="mt-8 space-y-6">
          {copy.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-[#0b2a4a] dark:text-white">{section.title}</h2>
              <p className="mt-1.5 text-base leading-relaxed text-[#56657a] dark:text-gray-300">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </TenantShell>
  );
}
