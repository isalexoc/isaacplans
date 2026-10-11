import Image from "next/image";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Coins,
  FileSearch,
  HandCoins,
  ScrollText,
  ShieldQuestion,
  UserRound,
} from "lucide-react";

import {
  IUL_GUIA_AGENT_NAME,
  IUL_GUIA_AGENT_TITLE,
  IUL_GUIA_COVER_URL,
  IUL_GUIA_DISCLAIMER_ES,
} from "@/lib/iul-guia/constants";
import { FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT } from "@/lib/get-covered-fast/constants";
import ScrollCta from "@/components/iul/guia/scroll-cta";

/**
 * The persuasion half of the IUL opt-in page: everything that is words rather than state.
 *
 * A server component so the Spanish copy never reaches the browser as JS — the same split
 * `components/legal-shield/legal-shield-sections.tsx` makes, and a large part of why the five
 * older get-covered funnels run 1,300–1,600 lines each.
 *
 * Structure follows the direct-response opt-in Isaac's reference page uses: qualify the reader,
 * show the lead magnet, list what is inside, reframe the offer, introduce the human, answer the
 * objections that would otherwise arrive on the call — with a CTA back to the form after each
 * beat.
 *
 * Three constraints on the copy, and all three are the reason it does not simply mirror the
 * reference page:
 *
 * - **No dollar figures and no projected values.** NAIC Model 570 treats cost representations and
 *   non-guaranteed projections in advertising as a live exposure, and Meta reviews the landing
 *   page AND the linked PDF, which makes a bad number an account-level risk rather than an ad-level
 *   one. Nothing here prices a policy.
 * - **Mechanics, never outcomes.** "Qué mueve el precio" is describable; "cuánto vas a tener" is
 *   not. The vocabulary is held to "póliza" and "valor en efectivo" rather than "cuenta", "ahorro"
 *   or "inversión", which Model 570 names directly.
 * - **The licence is the differentiator, so it is on the page.** The reference page carries no
 *   name, no licence and no disclosure at all. In a market where distrust is the first barrier and
 *   MLM recruiting has already primed it, copying that would throw away the one asset a licensed
 *   agent has that the competition does not.
 */

/**
 * TODO(isaac): reconcile against the real PDF before launch.
 *
 * These bullets are written to be true of the guide as briefed, but the file itself has not been
 * read here — `IUL_GUIA_PDF_URL` is still empty. A landing page that promises chapters the file
 * does not contain produces a lead who opens the guide, feels misled, and does not take the call.
 * Once the PDF is in, read its table of contents and make these match it.
 */
const BULLETS = [
  {
    icon: ShieldQuestion,
    text: "Quién califica de verdad: qué piden las aseguradoras, qué documentos se aceptan y por qué mucha gente asume que no califica sin haberlo preguntado nunca.",
  },
  {
    icon: Coins,
    text: "Qué mueve el precio de una póliza — edad, salud, monto y tipo de cobertura — y por qué la mayoría calcula muy por encima de lo que cuesta en realidad.",
  },
  {
    icon: ScrollText,
    text: "Qué es un IUL explicado en una página, en español y sin tecnicismos: qué es el valor en efectivo, qué es el tope, qué es el piso y qué es el costo del seguro.",
  },
  {
    icon: FileSearch,
    text: "Garantizado contra proyectado: cómo leer una ilustración y cuál de las dos columnas es la única que el contrato respalda.",
  },
  {
    icon: HandCoins,
    text: "Cómo funciona un préstamo contra la póliza, qué reglas tiene y qué preguntar antes de contar con él.",
  },
  {
    icon: AlertTriangle,
    text: "En qué casos un IUL NO te conviene. Son cinco, están explicados, y si te reconoces en alguno la guía ya hizo su trabajo.",
  },
];

const FAQ = [
  {
    q: "¿Esto es un negocio o me van a reclutar?",
    a: "No. No vendo oportunidades de negocio y no ando armando equipos. Soy agente de seguros con licencia: las aseguradoras me pagan cuando alguien contrata una póliza que le sirve. Si no te sirve, te lo digo.",
  },
  {
    q: "¿Un IUL es una inversión o una cuenta de ahorro?",
    a: "Ninguna de las dos. Es un contrato de seguro de vida permanente que además acumula valor en efectivo. No es una cuenta bancaria, no está asegurado por la FDIC y no es un producto de inversión. La guía explica la diferencia con calma, porque casi nadie la explica.",
  },
  {
    q: "¿Tengo que comprar algo para recibir la guía?",
    a: "No. La guía es gratis y no hay compromiso. Si después quieres que revisemos tu caso, lo hacemos; y si no, te quedas con la guía igual.",
  },
  {
    q: "¿Me van a llamar?",
    a: "Si me dejas tu teléfono, sí — una vez, para preguntarte si te quedó alguna duda y ver si tiene sentido revisar tu caso. Tú decides el horario en el formulario. Si prefieres que no, me lo dices y no vuelvo a marcar.",
  },
];

/**
 * The offer itself — headline, promise, cover art.
 *
 * Rendered ABOVE the form, not with the rest of the sections. A visitor arriving cold from an ad
 * has to learn what the guide is before being asked for an email; a form that opens with
 * "¿A dónde te enviamos tu guía?" above any mention of it is asking a question the reader
 * cannot answer yet.
 */
export function IulGuiaHero() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12">
      <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-[#0077B6] dark:text-[#4CC9F0]">
        Guía gratis · Descarga inmediata
      </p>
      <h1 className="mt-3 text-center text-[28px] font-extrabold leading-[1.15] text-gray-900 sm:text-[40px] dark:text-white">
        Lo que nadie te explica del IUL antes de que firmes
      </h1>
      <p className="mt-4 text-center text-[16px] leading-relaxed text-gray-600 sm:text-[18px] dark:text-gray-400">
        Guía gratis en español, escrita por un agente con licencia. Sin letra chiquita, sin humo y
        sin que nadie te ofrezca un negocio.
      </p>

      {/* The book is the argument. Anything between the headline and the mockup is one more thing
          to read before the reader sees what they are being offered, so there is nothing here. */}
      <div className="mt-7 flex justify-center">
        <div className="w-full max-w-[340px] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5 sm:max-w-[380px]">
          <Image
            src={IUL_GUIA_COVER_URL}
            alt="Portada de la guía Dinero, Riqueza, IUL"
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
      {/* ── Qué contiene ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
          Lo que vas a encontrar adentro
        </h2>
        <ul className="mt-5 space-y-4">
          {BULLETS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0077B6]/10 text-[#0077B6] dark:bg-[#0077B6]/25 dark:text-[#4CC9F0]">
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

      {/* ── El reencuadre ──────────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
          Por qué escribí esta guía
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          <p>
            Me cansé de ver familias hispanas firmar pólizas que nadie les explicó. Llegan a mi
            oficina con un documento en la mano, me preguntan qué compraron, y la respuesta honesta
            muchas veces es: algo que no necesitaban.
          </p>
          <p>
            No pasa porque la gente sea ingenua. Pasa porque casi todo lo que se publica sobre el
            IUL en español está escrito para vender, no para explicar. Te muestran una gráfica que
            sube y nadie te señala la columna que el contrato realmente respalda.
          </p>
          <p>
            Esta guía va al revés. Te explica cómo funciona el producto, qué mueve el precio, qué
            preguntas hacer, y en qué casos concretos{" "}
            <strong className="font-semibold text-gray-900 dark:text-white">
              un IUL no te conviene
            </strong>
            .
          </p>
          <p className="font-semibold text-gray-900 dark:text-white">
            Si al terminar de leerla decides que esto no es para ti, la guía hizo su trabajo.
          </p>
        </div>
        <ScrollCta className="mt-6">Descargar la guía gratis</ScrollCta>
      </section>

      {/* ── Quién te la envía ──────────────────────────────────────── */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
          Quién te la envía
        </h2>
        <div className="mt-5 flex items-center gap-4">
          {FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT ? (
            <Image
              src={FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT}
              alt={`${IUL_GUIA_AGENT_NAME}, ${IUL_GUIA_AGENT_TITLE}`}
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-full object-cover object-[center_20%]"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#0077B6]/10 text-[#0077B6] dark:bg-[#0077B6]/25 dark:text-[#4CC9F0]">
              <UserRound className="h-9 w-9" />
            </span>
          )}
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{IUL_GUIA_AGENT_NAME}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{IUL_GUIA_AGENT_TITLE}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0077B6] dark:text-[#4CC9F0]">
              <BadgeCheck className="h-4 w-4" />
              Isaac Plans Insurance
            </p>
          </div>
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          No vendo oportunidades de negocio y no estoy armando un equipo. Soy agente de seguros con
          licencia: las aseguradoras me pagan cuando alguien contrata una póliza que le sirve. Por
          eso me conviene decirte la verdad — incluso cuando la verdad es que esto no es para ti.
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
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0077B6] dark:text-[#4CC9F0]" />
                {q}
              </dt>
              <dd className="mt-1.5 pl-6 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
                {a}
              </dd>
            </div>
          ))}
        </dl>
        <ScrollCta className="mt-6">Descargar la guía gratis</ScrollCta>
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
