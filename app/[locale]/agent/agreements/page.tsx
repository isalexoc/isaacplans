/*
 * app/[locale]/agent/agreements/page.tsx — the Terms of Service and the Data Processing Agreement
 * (lib/tenancy/agreements.ts: versioned, DRAFTS pending counsel). Every other agent page sends a
 * linked agent here until they have accepted the current version of both; acceptance is recorded
 * per version with the text's hash, the time, the IP and the browser (`agent_agreements`).
 *
 * Open to any linked agent whatever their status. Never to an impersonated session: an agreement
 * is the agent's own act (lib/tenancy/agent-area.ts).
 */

import type { Metadata } from "next";
import AgentAreaNotice from "@/components/agent/agent-area-notice";
import AgreementsForm from "@/components/agent/agreements-form";
import { agentAreaState } from "@/lib/tenancy/agent-area";
import { agentAreaLocale, agentAreaPath } from "@/lib/tenancy/agent-area-routes";
import { AGREEMENT_DOC_IDS, AGREEMENTS, agreementParagraphs, currentAgreementRefs } from "@/lib/tenancy/agreements";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = agentAreaLocale((await params).locale);
  return { title: locale === "es" ? "Acuerdos" : "Agreements", robots: { index: false, follow: false } };
}

const WORDS = {
  en: {
    title: "Agreements",
    intro: "Before you start, read and accept these two documents. They cover how the platform works and how your clients' information is handled.",
    draft: "Drafts pending legal review: you will be asked to accept the final versions.",
    version: "Version",
    accepted: "You have accepted the current versions.",
    continue: "Go to your applications",
  },
  es: {
    title: "Acuerdos",
    intro: "Antes de empezar, lea y acepte estos dos documentos. Explican cómo funciona la plataforma y cómo se trata la información de sus clientes.",
    draft: "Borradores pendientes de revisión legal: se le pedirá aceptar las versiones finales.",
    version: "Versión",
    accepted: "Usted aceptó las versiones actuales.",
    continue: "Ir a sus solicitudes",
  },
} as const;

export default async function AgentAgreementsPage({ params }: { params: Params }) {
  const locale = agentAreaLocale((await params).locale);
  const state = await agentAreaState();
  if (state.kind !== "agent") return <AgentAreaNotice kind={state.kind} locale={locale} />;
  const w = WORDS[locale];
  const refs = currentAgreementRefs();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#0b2a4a] dark:text-white sm:text-3xl">{w.title}</h1>
      <p className="mt-2 text-sm text-[#56657a] dark:text-gray-400">{w.intro}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[.06em] text-amber-700 dark:text-amber-400">{w.draft}</p>

      <div className="mt-6 space-y-6">
        {AGREEMENT_DOC_IDS.map((id) => {
          const doc = AGREEMENTS[id];
          return (
            <section key={id} aria-labelledby={`agreement-${id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`agreement-${id}`} className="text-lg font-semibold text-[#0b2a4a] dark:text-white">
                  {doc.title[locale]}
                </h2>
                <span className="text-xs text-[#56657a] dark:text-gray-400">
                  {w.version} {doc.version}
                </span>
              </div>
              <div className="mt-2 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-[#e6e9ef] bg-white p-4 text-sm leading-relaxed text-[#243447] dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
                {agreementParagraphs(doc.body[locale]).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6">
        {state.agreementsAccepted ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
            <p>{w.accepted}</p>
            <a href={agentAreaPath(locale)} className="mt-2 inline-block font-semibold underline underline-offset-2">
              {w.continue}
            </a>
          </div>
        ) : (
          <AgreementsForm locale={locale} refs={refs} nextHref={agentAreaPath(locale)} />
        )}
      </div>
    </div>
  );
}
