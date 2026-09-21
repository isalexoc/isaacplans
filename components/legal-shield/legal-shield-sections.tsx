import Image from "next/image";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  FileSignature,
  FileText,
  Landmark,
  ShieldAlert,
  Users,
} from "lucide-react";

import {
  LEGAL_SHIELD_GUIDE_COVER_URL,
  LEGAL_SHIELD_GUIDE_TITLE,
  LS_ADVISOR_NAME,
  NOT_INSURANCE_LINE_ES,
} from "@/lib/legal-shield/constants";
import ScrollCta from "@/components/legal-shield/scroll-cta";

/**
 * The persuasion half of the opt-in page: everything that is words rather than state.
 *
 * A server component so ~400 lines of Spanish copy never reach the browser as JS. This is the
 * split the five existing get-covered funnels do not make, which is a large part of why they run
 * 1,300–1,600 lines each.
 *
 * Structure follows the direct-response opt-in the ad brief was modelled on: qualify the reader,
 * show the lead magnet, list what it contains, reframe the offer, introduce the human, answer the
 * three objections that would otherwise arrive on the call — with a CTA back to the form after
 * each beat.
 *
 * Two constraints on the copy:
 *
 * - **No dollar figures.** The membership price belongs on the call, where it can be qualified by
 *   state; LegalShield's associate rules hold advertising to accurate pricing and a number on a
 *   landing page goes stale silently.
 * - **The promise matches the file.** The bullets below are the guide's real chapters. The guide
 *   itself opens with "el objetivo de esta guía no es generar miedo", so the page sells
 *   preparedness rather than dread — a fear-first headline would set up a lead who opens the PDF
 *   and feels sold to.
 */

/**
 * These are the guide's ACTUAL chapters, read off the PDF — not a wish list.
 *
 * A landing page that promises chapters the file does not contain is a refund request, or worse,
 * a lead who opens the guide, feels misled and does not take the call.
 */
const BULLETS = [
  {
    icon: FileText,
    text: "Documentos importantes: cuáles conviene tener organizados y por qué tenerlos a la mano cambia todo cuando ocurre algo inesperado.",
  },
  {
    icon: FileSignature,
    text: "Vivienda y contratos: qué revisar antes de firmar una renta o un acuerdo, y qué guardar después de firmarlo.",
  },
  {
    icon: Car,
    text: "Tránsito y licencias: lo que conviene saber sobre licencias de conducir, multas y qué hacer después de un accidente.",
  },
  {
    icon: Users,
    text: "Protección familiar: cómo dejar preparadas las decisiones sobre tu familia y tus hijos antes de que hagan falta.",
  },
  {
    icon: ShieldAlert,
    text: "Estafas y protección financiera: cómo reconocerlas a tiempo y qué hacer si alguien usa tu información.",
  },
  {
    icon: Landmark,
    text: "Inmigración y preparación: cómo mantener tus documentos y tu plan familiar en orden, con calma.",
  },
];

const FAQ = [
  {
    q: "¿Esto es un seguro?",
    a: "No. No es un seguro. Es una membresía de servicios legales: pagas una cuota mensual y tienes acceso a un bufete de abogados. Los planes tienen exclusiones y limitaciones, y lo que incluyen varía según el estado.",
  },
  {
    q: "¿Me amarra a un contrato largo?",
    a: "No hay contratos a largo plazo. Y si un mes se complica y no se procesa el pago, la cobertura simplemente se pausa: sin penalidades, sin multas atrasadas y sin reportarte al crédito.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Depende del plan y del estado donde vives, porque los servicios incluidos cambian. Por eso el siguiente paso es una llamada corta: tu asesor revisa tu caso y te dice exactamente qué te cubre y cuánto es, sin compromiso.",
  },
];

/**
 * The offer itself — headline, promise, cover art.
 *
 * Rendered ABOVE the form, not with the rest of the sections. A visitor arriving cold from an ad
 * has to learn what the guide is before being asked for an email; a form that opens with
 * "¿A dónde te enviamos tu guía gratis?" above any mention of it is asking a question
 * the reader cannot answer yet.
 */
export function LegalShieldHero() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8124BC] dark:text-purple-300">
        Guía gratis · Familias latinas en EE.&nbsp;UU.
      </p>
      <h1 className="mt-3 text-[26px] font-extrabold leading-tight text-gray-900 sm:text-4xl dark:text-white">
        En este país, la mayor tranquilidad viene de saber que no tienes que enfrentar todo tú
        solo.
      </h1>
      <p className="mt-4 text-[17px] leading-relaxed text-gray-600 dark:text-gray-300">
        Descarga gratis la{" "}
        <strong className="text-gray-900 dark:text-white">{LEGAL_SHIELD_GUIDE_TITLE}</strong>:
        orientación clara en español sobre los documentos, contratos y trámites que conviene tener
        resueltos <em>antes</em> de necesitarlos.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-center">
        <div className="overflow-hidden rounded-xl border border-gray-200 shadow-lg dark:border-gray-800">
          <Image
            src={LEGAL_SHIELD_GUIDE_COVER_URL}
            alt={`Portada de la ${LEGAL_SHIELD_GUIDE_TITLE}`}
            width={900}
            height={1139}
            className="h-auto w-full"
            sizes="(min-width: 640px) 260px, 100vw"
            priority
          />
        </div>
        <ul className="space-y-2.5">
          {[
            "Escrita en español, para familias latinas en Estados Unidos",
            "8 temas de la vida cotidiana, explicados sin tecnicismos",
            "Gratis, sin tarjeta y sin compromiso",
          ].map((line) => (
            <li key={line} className="flex gap-2.5 text-[15px] text-gray-700 dark:text-gray-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8124BC] dark:text-purple-300" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function LegalShieldSections() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6">
      {/* ── Qué contiene ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
          Lo que vas a encontrar adentro
        </h2>
        <ul className="mt-5 space-y-4">
          {BULLETS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8124BC]/10 text-[#8124BC] dark:bg-purple-900/40 dark:text-purple-300">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
                {text}
              </span>
            </li>
          ))}
        </ul>
        <ScrollCta className="mt-6">Quiero mi guía gratis</ScrollCta>
      </section>

      {/* ── La analogía de Netflix ─────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
          Piénsalo como Netflix
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          <p>
            Imagínate que Netflix no existiera como membresía y que cada vez que quisieras ver una
            película tuvieras que comprarla. Lo pensarías dos veces antes de darle play, ¿verdad?
          </p>
          <p>
            Eso es exactamente lo que pasa con los abogados tradicionales. Cobran por hora, así que
            cada duda tiene un precio — y la mayoría de la gente termina no preguntando.
          </p>
          <p>
            Con una membresía legal la pregunta cambia. Ya no es{" "}
            <em>&ldquo;¿cuánto me va a costar hablar con un abogado?&rdquo;</em>, sino{" "}
            <em>&ldquo;ya tengo mi membresía, ¿por qué no consulto esto?&rdquo;</em>. Y ahí está la
            ventaja real: no esperar a que el problema sea enorme para buscar ayuda.
          </p>
          <p className="font-semibold text-gray-900 dark:text-white">
            Porque muchas veces una orientación a tiempo evita que una situación pequeña se
            convierta en uno de esos problemas que sí cuestan miles.
          </p>
        </div>
        <ScrollCta className="mt-6">Descargar la guía gratis</ScrollCta>
      </section>

      {/* ── Quién te la envía ──────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-[15px] font-semibold leading-relaxed text-gray-900 dark:text-white">
            Nadie planifica una multa, un accidente, una carta del IRS o que le roben la identidad.
            Eso es justamente lo que las hace caras: llegan cuando no estás listo.
          </p>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          Después de descargar la guía, {LS_ADVISOR_NAME} —{" "}
          <span className="whitespace-nowrap">Asociado Independiente de LegalShield</span> — te
          llama para responder tus preguntas en español y explicarte qué aplica en tu estado. Sin
          costo y sin compromiso.
        </p>
        <ScrollCta className="mt-6">Sí, quiero mi guía gratis</ScrollCta>
      </section>

      {/* ── Preguntas frecuentes ───────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
          Preguntas frecuentes
        </h2>
        <dl className="mt-5 space-y-5">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="flex items-start gap-2 font-semibold text-gray-900 dark:text-white">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8124BC] dark:text-purple-300" />
                {q}
              </dt>
              <dd className="mt-1.5 pl-6 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
                {a}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 rounded-lg bg-gray-50 px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
          {NOT_INSURANCE_LINE_ES}
        </p>
        <ScrollCta className="mt-6">Descargar la guía gratis</ScrollCta>
      </section>
    </div>
  );
}
