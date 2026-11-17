/**
 * A drawn phone showing an Impact Member Center dashboard, for the portal slide.
 *
 * Deliberately an illustration, not a screenshot: there are no public screenshots of Impact's
 * portal to use, a real member's screen would be someone's data, and Isaac chose a designed mockup
 * (2026-11-17). It is labelled as an illustration and uses the sample member from the ID-card slide,
 * "María Ejemplo". Built at a 320×640 base; the deck scales it up.
 */

import Image from "next/image";
import { Glyph, type GlyphName } from "./icons";
import type { DeckLocale } from "./copy";

/**
 * Only what Impact's Help Center documents for the Member Center (researched 2026-11-17): the
 * digital card (print / PDF), bill submission and tracking (Submitted / Processing / Completed),
 * AutoPay, telehealth, the Rx price tool and Wellness Rewards. No PRA progress bar: Impact says it
 * has no visibility into whether a PRA was paid, so the drawing must not suggest one.
 */
const COPY = {
  es: {
    hello: "Hola, María",
    card: "Mi tarjeta",
    print: "Imprimir · PDF",
    pay: "Mi aporte mensual",
    payNext: "Pago automático activo",
    bills: "Mis facturas",
    send: "+ Enviar factura",
    rows: [
      ["Laboratorio", "Completada", "ok"],
      ["Especialista", "En proceso", "wait"],
      ["Urgent Care", "Enviada", "new"],
    ],
    actions: [
      ["phonePlus", "Telemedicina"],
      ["pill", "Medicinas"],
      ["runner", "Bienestar"],
    ],
    label: "Ilustración",
  },
  en: {
    hello: "Hi, María",
    card: "My card",
    print: "Print · PDF",
    pay: "My monthly share",
    payNext: "AutoPay is on",
    bills: "My bills",
    send: "+ Submit a bill",
    rows: [
      ["Lab work", "Completed", "ok"],
      ["Specialist", "Processing", "wait"],
      ["Urgent care", "Submitted", "new"],
    ],
    actions: [
      ["phonePlus", "Telehealth"],
      ["pill", "Prescriptions"],
      ["runner", "Wellness"],
    ],
    label: "Illustration",
  },
} as const;

const PILL: Record<string, string> = {
  ok: "bg-[#d6f2ee] text-[#1f7a82]",
  wait: "bg-[#fff1d6] text-[#9a6a12]",
  new: "bg-[#e8eef6] text-[#123a63]",
};

export default function PortalMockup({ locale }: { locale: DeckLocale }) {
  const c = COPY[locale];
  return (
    <div className="relative h-[640px] w-[320px] rounded-[46px] bg-[#0b1f36] p-[10px] shadow-[0_30px_70px_rgba(11,42,74,.35)]">
      <span className="absolute -right-[10px] top-[18px] z-10 rounded-full bg-[#f2735a] px-[10px] py-[4px] text-[11px] font-bold uppercase tracking-[.1em] text-white">
        {c.label}
      </span>
      <div className="relative h-full w-full overflow-hidden rounded-[37px] bg-[#f4f6f9]">
        <div className="absolute left-1/2 top-[8px] h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#0b1f36]" />
        <div className="bg-[linear-gradient(135deg,#0b2a4a_0%,#123a63_70%,#2f97a0_140%)] px-[18px] pb-[18px] pt-[42px] text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-white/70">Member Center</span>
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/15 text-[11px] font-bold">ME</span>
          </div>
          <p className="mt-[6px] text-[20px] font-extrabold">{c.hello}</p>
        </div>
        <div className="space-y-[10px] p-[12px]">
          <div className="flex items-center gap-[10px] rounded-[16px] bg-white p-[10px] shadow-sm">
            <Image
              src="/images/impact/presentation/member-card-front.jpg"
              alt=""
              width={1200}
              height={808}
              sizes="96px"
              className="h-[56px] w-[84px] rounded-[8px] object-cover"
            />
            <div>
              <p className="text-[13px] font-bold text-[#0b2a4a]">{c.card}</p>
              <p className="text-[11px] text-[#56657a]">S000123456</p>
              <p className="mt-[2px] text-[10px] font-semibold text-[#2f97a0]">{c.print}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-[16px] bg-white p-[12px] shadow-sm">
            <div>
              <p className="text-[12px] font-semibold text-[#56657a]">{c.pay}</p>
              <p className="mt-[2px] text-[12px] font-bold text-[#1f7a82]">✓ {c.payNext}</p>
            </div>
            <Glyph name="check" strokeWidth={3} className="h-[22px] w-[22px] text-[#2f97a0]" />
          </div>
          <div className="rounded-[16px] bg-white p-[12px] shadow-sm">
            <div className="mb-[6px] flex items-center justify-between">
              <p className="text-[12px] font-semibold text-[#56657a]">{c.bills}</p>
              <span className="text-[10px] font-bold text-[#f2735a]">{c.send}</span>
            </div>
            {c.rows.map(([what, status, tone]) => (
              <div key={what} className="flex items-center justify-between border-t border-[#eef1f5] py-[7px] first:border-t-0">
                <span className="text-[13px] font-semibold text-[#0b2a4a]">{what}</span>
                <span className={`rounded-full px-[8px] py-[2px] text-[10px] font-bold ${PILL[tone]}`}>{status}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-[8px]">
            {c.actions.map(([icon, label]) => (
              <div key={label} className="flex flex-col items-center gap-[4px] rounded-[14px] bg-white py-[10px] shadow-sm">
                <Glyph name={icon as GlyphName} className="h-[20px] w-[20px] text-[#2f97a0]" />
                <span className="text-[10px] font-semibold text-[#0b2a4a]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
