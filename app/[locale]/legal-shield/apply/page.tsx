/*
 * app/[locale]/legal-shield/apply/page.tsx
 *
 * "Aplica tú mismo": a walkthrough video from Ysmael plus the LegalShield referral link, for the
 * lead who would rather enroll on their own than wait for a call. Reached from the opt-in success
 * screen.
 */

import type { Metadata } from "next";
import { ArrowRight, MessageCircle, Phone } from "lucide-react";

import AgentCrmWalkthrough from "@/components/agent-crm/agent-crm-video";
import {
  LEGAL_SHIELD_APPLY_VIDEO_POSTER_URL,
  LEGAL_SHIELD_APPLY_VIDEO_URL,
  LEGAL_SHIELD_REFERRAL_URL,
  LS_ADVISOR_NAME,
  LS_PHONE_DISPLAY,
  LS_PHONE_TEL,
  LS_WHATSAPP_HREF,
  NOT_INSURANCE_LINE_ES,
} from "@/lib/legal-shield/constants";

const TITLE = "Actívate tú mismo | Protección legal en español";
const DESCRIPTION =
  "Mira cómo activar tu membresía de servicios legales en unos minutos, o llámanos y lo hacemos juntos.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = "https://www.isaacplans.com/es/legal-shield/apply";
  return {
    title: TITLE,
    description: DESCRIPTION,
    robots: { index: false, follow: false },
    alternates: {
      canonical,
      languages: { "es-US": canonical, "x-default": canonical },
    },
    openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "es_US" },
  };
}

const STEPS = [
  {
    n: "1",
    title: "Mira el video",
    body: `${LS_ADVISOR_NAME} te explica en español qué incluye el plan y qué vas a necesitar a la mano.`,
  },
  {
    n: "2",
    title: "Abre el formulario",
    body: "El botón te lleva al sitio oficial de LegalShield para completar tu inscripción.",
  },
  {
    n: "3",
    title: "Empieza a usarlo",
    body: "Al día siguiente ya puedes hacer tu primera consulta con el bufete asignado en tu estado.",
  },
];

export default function LegalShieldApplyPage() {
  const hasReferralLink = Boolean(LEGAL_SHIELD_REFERRAL_URL);

  return (
    <main className="relative min-h-screen bg-[#f4f6f9] dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(129,36,188,0.10),transparent_55%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-[26px] font-extrabold leading-tight text-gray-900 sm:text-4xl dark:text-white">
          Actívate tú mismo en unos minutos
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-gray-600 dark:text-gray-300">
          Si prefieres no esperar una llamada, aquí tienes todo lo que necesitas para inscribirte
          por tu cuenta. Y si a mitad de camino te surge una duda, llámame y lo terminamos juntos.
        </p>

        <div className="mt-8">
          {/*
            AgentCrmWalkthrough rather than HeroMedia: its video variant requires a poster AND a
            LobSlug through getEffectivePageMedia, and legal-shield deliberately is not a LobSlug
            (that union drives intake, apply and page-media routing for eight insurance products).
            This one accepts videoUrl: null and renders a designed placeholder instead of a dead
            play button, which is what ships until Ysmael records the clip.
          */}
          <AgentCrmWalkthrough
            media={{
              videoUrl: LEGAL_SHIELD_APPLY_VIDEO_URL || null,
              posterUrl: LEGAL_SHIELD_APPLY_VIDEO_POSTER_URL || null,
              imageUrl: null,
            }}
            playLabel="Ver el video"
            imageAlt="Cómo activar tu membresía de servicios legales"
            placeholderTitle="Video en camino"
            placeholderBody={`${LS_ADVISOR_NAME} está grabando el recorrido paso a paso. Mientras tanto, usa el botón de abajo o llámame y lo hacemos juntos.`}
          />
        </div>

        <ol className="mt-8 space-y-4">
          {STEPS.map(({ n, title, body }) => (
            <li
              key={n}
              className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8124BC] text-base font-bold text-white">
                {n}
              </span>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{title}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          {hasReferralLink ? (
            <a
              href={LEGAL_SHIELD_REFERRAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8124BC] to-[#9D4EDD] px-6 text-[17px] font-bold text-white shadow-lg transition hover:brightness-110"
            >
              Empezar mi inscripción
              <ArrowRight className="h-5 w-5" />
            </a>
          ) : (
            // Rendered disabled rather than hidden: the page's whole promise is this button, and a
            // page that silently lacks its own call to action reads as broken.
            <button
              type="button"
              disabled
              className="flex min-h-[60px] w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-300 px-6 text-[17px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            >
              Disponible muy pronto
            </button>
          )}
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
            {NOT_INSURANCE_LINE_ES}
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-center text-[15px] font-semibold text-gray-900 dark:text-white">
            ¿Prefieres que lo hagamos juntos?
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <a
              href={LS_PHONE_TEL}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-4 text-base font-semibold text-gray-800 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <Phone className="h-5 w-5" />
              {LS_PHONE_DISPLAY}
            </a>
            <a
              href={LS_WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-lg border-2 border-[#25D366]/40 bg-white px-4 text-base font-semibold text-[#128C4A] transition hover:border-[#25D366] dark:bg-gray-800 dark:text-[#25D366]"
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
