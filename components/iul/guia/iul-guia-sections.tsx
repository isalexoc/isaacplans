import Image from "next/image";
import { BadgeCheck, CheckCircle2, UserRound } from "lucide-react";

import {
  IUL_GUIA_AGENT_NAME,
  IUL_GUIA_AGENT_TITLE,
  IUL_GUIA_COVER_URL,
  IUL_GUIA_DISCLAIMER_ES,
  IUL_GUIA_TITLE,
} from "@/lib/iul-guia/constants";
import { FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT } from "@/lib/get-covered-fast/constants";
import ScrollCta from "@/components/iul/guia/scroll-cta";

/**
 * The persuasion half of the IUL opt-in page: everything that is words rather than state.
 *
 * A server component so the Spanish copy never reaches the browser as JS — the same split
 * `components/legal-shield/legal-shield-sections.tsx` makes.
 *
 * COPY SOURCE: this page's headlines and body text are Isaac's, taken from the opt-in page he
 * supplied as the model (iulhorizontefinanciero.com/opt-in-page) because it is already converting
 * for him. The structure follows it beat for beat: attention headline, promise, the report and
 * what is in it, a longer teaser list, then the opt-in close — with a CTA back to the form after
 * each beat.
 *
 * Two things were deliberately NOT copied from that page, and both were flagged to Isaac:
 *
 * - It carries no agent name, no licence and no disclosure of any kind — its footer is a bare
 *   "Copyright 2026". A licensed agent's advertisement is held to NAIC Model 570, which expects
 *   the advertiser to be identifiable, so the agent block and the disclaimer block below stay.
 * - Its claims ("Sin Riesgos", "libre de impuestos" unqualified, "Los seguros de vida son una
 *   estafa, ¿verdad? ¡Falso!") are the exact characterisations Model 570 names, and Meta reviews
 *   the landing page AND the linked PDF. Isaac has made that call knowingly; the disclaimers below
 *   are the counterweight and should not be removed without replacing them with something else.
 */

/** The four promise bullets, verbatim from the model page. */
const BULLETS = [
  "La razón #1 por la que los latinos jóvenes en EE.UU se mantienen atrasados en sus finanzas, ¡y nunca logran ahorrar dinero realmente!",
  "Por qué NUNCA debes confiar en las personas que te dicen que los seguros de vida son solo para dejarle algo a tu familia cuando mueras y cómo usarlos para crecer tus ahorros libres de impuestos",
  "La cruda VERDAD sobre los IULs y por qué hacer crecer tus ahorros con uno puede ser mucho más fácil de lo que imaginas!",
  "Y mucho, mucho más!",
];

/** The five teaser blocks, verbatim from the model page. */
const TEASERS = [
  {
    title: "La fría y cruda VERDAD sobre el 401(k) y el IRA",
    body: "Revelaremos qué está pasando REALMENTE a puertas cerradas y por qué a los latinos se les hace tan difícil comenzar a ahorrar y poner su dinero a trabajar en el mercado actual",
  },
  {
    title:
      "7 pequeños tips para ayudarte a acumular un capital suficiente para no vivir preocupado por el dinero",
    body: null,
  },
  {
    title:
      "Por qué extrañamente los seguros de vida son tan usados por los ricos para acumular dinero, y cómo tú también sacar ventaja de ellos",
    body: "Los seguros de vida son una estafa, ¿verdad? ¡Falso! Te revelaremos lo que los ricos hacen con los seguros de vida para hacer crecer su dinero libre de impuestos y cómo hacerlo tú también.",
  },
  {
    title:
      "La Clave Vital Para Poner Tu Dinero A Crecer Sin Riesgos Y libre de impuestos lo más rápido posible",
    body: "Esta es la parte más importante del rompecabezas para hacer crecer tus ahorros libres de impuestos y sin riesgos, y sin esto estás condenado al fracaso - ¡asegúrate de tener esto a cualquier costo!",
  },
  {
    title: "Qué nunca debes hacer cuando tratas de hacer crecer tus ahorros",
    body: "Por favor, nunca JAMÁS hagas esto si estás tratando de hacer crecer tus ahorros (a menos que quieras mantenerte pobre y viviendo al día muchos más años de lo necesario)",
  },
];

/**
 * The offer itself — headline, promise, cover art.
 *
 * Rendered ABOVE the form, not with the rest of the sections. A visitor arriving cold from an ad
 * has to learn what the report is before being asked for an email.
 */
export function IulGuiaHero() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <h1 className="text-center text-[26px] font-extrabold leading-[1.18] text-gray-900 sm:text-[36px] dark:text-white">
        Reporte Gratis Revela Impactante Método Nuevo Para Hacer Crecer Tus Ahorros Sin Hacer
        Inversiones Riesgosas
      </h1>

      {/* The report is the argument. Anything between the headline and the mockup is one more
          thing to read before the reader sees what they are being offered. */}
      <div className="mt-7 flex justify-center">
        <div className="w-full max-w-[340px] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5 sm:max-w-[380px]">
          <Image
            src={IUL_GUIA_COVER_URL}
            alt="Portada del reporte gratuito sobre el IUL"
            width={760}
            height={968}
            className="h-auto w-full"
            sizes="(min-width: 640px) 380px, 90vw"
            priority
          />
        </div>
      </div>
    </div>
  );
}

export default function IulGuiaSections() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6">
      {/* ── El reporte y lo que contiene ───────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          Por tiempo estrictamente limitado vas a poder descargar una copia GRATIS de nuestro
          exclusivo reporte&hellip;
        </p>

        <p className="mt-4 text-xl font-bold leading-snug text-gray-900 sm:text-2xl dark:text-white">
          &ldquo;{IUL_GUIA_TITLE}&rdquo;
        </p>

        <ul className="mt-5 space-y-4">
          {BULLETS.map((text) => (
            <li key={text} className="flex gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-[#0077B6] dark:text-[#4CC9F0]"
                aria-hidden
              />
              <span className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
                {text}
              </span>
            </li>
          ))}
        </ul>

        <ScrollCta className="mt-6">Descarga tu copia ahora</ScrollCta>
      </section>

      {/* ── Los cinco bloques de contenido ─────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold leading-snug text-gray-900 sm:text-2xl dark:text-white">
          Aquí tienes un poco más de lo que puedes esperar de tu asesoría GRATIS&hellip;
        </h2>

        <div className="mt-6 space-y-6">
          {TEASERS.map(({ title, body }) => (
            <div key={title}>
              <h3 className="flex items-start gap-2 text-[16px] font-bold leading-snug text-gray-900 sm:text-[17px] dark:text-white">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-[#0077B6] dark:text-[#4CC9F0]"
                  aria-hidden
                />
                {title}
              </h3>
              {body ? (
                <p className="mt-2 pl-7 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
                  {body}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <ScrollCta className="mt-7">Descarga tu copia ahora</ScrollCta>
      </section>

      {/* ── Cierre del opt-in ──────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold leading-snug text-gray-900 sm:text-2xl dark:text-white">
          ¡Accede inmediatamente a este reporte GRATIS ahora!
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          Simplemente deja tus datos abajo y el reporte llegará directo a tu bandeja de entrada.
        </p>
        <ScrollCta className="mt-6">Descarga tu copia ahora</ScrollCta>
      </section>

      {/*
        ── Quién te lo envía ───────────────────────────────────────────
        NOT on the model page, kept on purpose. An insurance advertisement that names nobody is a
        Model 570 problem before it is a conversion question, and in this market the licence is
        the one asset the competition does not have.
      */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          {FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT ? (
            <Image
              src={FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT}
              alt={`${IUL_GUIA_AGENT_NAME}, ${IUL_GUIA_AGENT_TITLE}`}
              width={72}
              height={72}
              className="h-[72px] w-[72px] shrink-0 rounded-full object-cover object-[center_20%]"
            />
          ) : (
            <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#0077B6]/10 text-[#0077B6] dark:bg-[#0077B6]/25 dark:text-[#4CC9F0]">
              <UserRound className="h-8 w-8" />
            </span>
          )}
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Te lo envía</p>
            <p className="font-bold text-gray-900 dark:text-white">{IUL_GUIA_AGENT_NAME}</p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0077B6] dark:text-[#4CC9F0]">
              <BadgeCheck className="h-4 w-4" />
              {IUL_GUIA_AGENT_TITLE}
            </p>
          </div>
        </div>
      </section>

      {/* ── Avisos ─────────────────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900/60">
        {IUL_GUIA_DISCLAIMER_ES.map((line) => (
          <p
            key={line}
            className="mb-2 text-[11px] leading-relaxed text-gray-500 last:mb-0 dark:text-gray-500"
          >
            {line}
          </p>
        ))}
      </section>
    </div>
  );
}
