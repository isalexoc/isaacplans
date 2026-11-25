/**
 * The Legal Shield sales deck: Isaac's "Plan Preferencial + IDShield" PDF rebuilt as live slides on
 * the shared 900×1600 canvas (cover + 6 slides, verbatim), then the price slide and the "3 pasos"
 * slide he asked for (2026-11-24), which ends on "Confirmar mis datos".
 *
 * Server-rendered; the interactive pieces are the price slide (Mensual/Anual, and the package the
 * agent can change without the client seeing a control) and the confirm button.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import ConfirmDetailsButton from "@/components/impact-presentation/confirm-details-button";
import { LS_DECK } from "./copy";
import {
  CARD,
  CARD_GOLD,
  CARD_GOLD_STYLE,
  Cards,
  Disclaimer,
  FeatureRow,
  GOLD_TEXT_STYLE,
  Heading,
  RowIcon,
  Brandbar,
  Slide,
  WhatsAppCta,
  WhatsAppPill,
} from "./deck-parts";
import { DetectiveGlyph, LsGlyph } from "./icons";
import PriceSlide from "./price-slide";

const IMG = "/images/legal-shield/presentation";

/** Fades a top photo into the page navy, as the PDF's own overlay does. */
const PHOTO_FADE = { background: "linear-gradient(180deg, rgba(7,35,59,.35) 0%, rgba(7,35,59,0) 14%, rgba(7,35,59,0) 55%, #07233b 100%)" } as const;

/* ─── Cover ─────────────────────────────────────────────────────────────────── */

function CoverSlide({ firstName }: { firstName: string }) {
  const t = LS_DECK.cover;
  return (
    <Slide>
      <div className="absolute inset-x-0 top-0 h-[667px]">
        <Image src={`${IMG}/cover-abuelo-nieto.webp`} alt="" fill priority sizes="900px" className="object-cover object-top" />
        <div className="absolute inset-0" style={PHOTO_FADE} />
      </div>
      <div className="absolute left-[70px] top-[870px] flex items-center gap-[24px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark */}
        <img src="/images/legal-shield/red-de-apoyo-mark.svg" alt="" width={88} height={88} className="h-[88px] w-[88px]" />
        <div className="leading-none">
          <div className="text-[27px] font-bold tracking-[.1em] text-[#c8dbee]">RED DE APOYO</div>
          <div className="mt-[10px] text-[34px] font-extrabold tracking-[.06em] text-[#d7bd7c]">LATINO USA</div>
        </div>
      </div>
      <div className="absolute left-[70px] right-[70px] top-[1004px]">
        <div className="text-[26px] font-extrabold uppercase leading-none tracking-[.13em] text-[#d8bc78]">{t.kicker}</div>
        <h1 className="mt-[24px] text-[81px] font-black leading-[1.02] tracking-[-.02em]">
          {t.title.map((line) => (
            <span key={line} className="block text-white">
              {line}
            </span>
          ))}
          <span className="block pb-[6px]" style={GOLD_TEXT_STYLE}>
            {t.titleGold}
          </span>
        </h1>
      </div>
      <div className="absolute left-[70px] top-[1318px] flex items-center gap-[28px]">
        <div className="flex h-[75px] items-center gap-[14px] rounded-full border-[2px] border-[#d5bb7a] bg-[#283c46] px-[30px]">
          <LsGlyph name="book" strokeWidth={2.2} className="h-[30px] w-[30px] text-[#ecd08a]" />
          <span className="text-[26px] font-extrabold text-[#ecd08a]">{t.pill}</span>
        </div>
        {firstName && (
          <span className="text-[25px] font-semibold text-[#c8dbee]">
            {t.preparedFor} <span className="font-extrabold text-white">{firstName}</span>
          </span>
        )}
      </div>
      <Disclaimer />
    </Slide>
  );
}

/* ─── 01 Tu plan dual ───────────────────────────────────────────────────────── */

function DualSlide({ page }: { page: string }) {
  const t = LS_DECK.dual;
  return (
    <Slide>
      <Brandbar page={page} />
      <Heading kicker={t.kicker} lines={[t.title]} gold={t.titleGold} />
      <div className="absolute left-[70px] right-[70px] top-[452px] flex flex-col gap-[21px]">
        {t.cards.map((card) => {
          const highlight = "highlight" in card && card.highlight;
          return (
            <div
              key={card.title}
              className={cn("flex min-h-[208px] items-center gap-[24px] px-[28px] py-[16px]", highlight ? CARD_GOLD : `${CARD} rounded-[27px]`)}
              style={highlight ? CARD_GOLD_STYLE : undefined}
            >
              <RowIcon icon={card.icon} size={143} solid />
              <div className="min-w-0">
                <div className="text-[38px] font-extrabold leading-[1.1] tracking-[-.01em] text-white">{card.title}</div>
                <p className="mt-[8px] text-[24px] font-semibold leading-[1.32] text-[#c8dbee]">{card.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute left-[70px] right-[70px] top-[1150px] flex items-start gap-[18px]">
        <LsGlyph name="family" strokeWidth={1.8} className="mt-[4px] h-[40px] w-[40px] flex-none text-[#d8bc78]" />
        <p className="text-[29px] font-semibold leading-[1.3] text-[#c8dbee]">
          <RichWhite text={t.covers} />
        </p>
      </div>
      <WhatsAppPill />
      <Disclaimer />
    </Slide>
  );
}

/** `**bold**` as white bold (the "Cubre a…" line), not the gold highlight. */
function RichWhite({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
        part.startsWith("**") ? (
          <strong key={i} className="font-extrabold text-white">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/* ─── 02–04 feature lists ───────────────────────────────────────────────────── */

function ListSlide({
  page,
  copy,
  compact,
}: {
  page: string;
  copy: { kicker: string; title: string; titleGold: string; rows: readonly { icon: Parameters<typeof FeatureRow>[0]["icon"]; title: string; body: string }[] };
  compact?: boolean;
}) {
  return (
    <Slide>
      <Brandbar page={page} />
      <Heading kicker={copy.kicker} lines={[copy.title]} gold={copy.titleGold} />
      <Cards compact={compact}>
        {copy.rows.map((row) => (
          <FeatureRow key={row.title} icon={row.icon} title={row.title} body={row.body} compact={compact} />
        ))}
      </Cards>
      <WhatsAppPill />
      <Disclaimer />
    </Slide>
  );
}

/* ─── 05 Si te roban la identidad ───────────────────────────────────────────── */

function IdentityTheftSlide({ page }: { page: string }) {
  const t = LS_DECK.id2;
  return (
    <Slide>
      <Brandbar page={page} />
      <Heading kicker={t.kicker} lines={[t.title]} gold={t.titleGold} />
      {/* The investigator: a gold disc in a dark ring, a white shield badge on its edge. */}
      <div className="absolute left-1/2 top-[455px] h-[402px] w-[402px] -translate-x-1/2 rounded-full bg-white/[.07] p-[19px]">
        <div
          className="relative flex h-full w-full items-center justify-center rounded-full"
          style={{ background: "radial-gradient(circle at 35% 28%, #f5d98f 0%, #e5bd63 45%, #b98d3e 100%)" }}
        >
          <DetectiveGlyph className="h-[190px] w-[190px] text-[#07233b]" />
          <span className="absolute bottom-[22px] right-[22px] flex h-[114px] w-[114px] items-center justify-center rounded-full border-[8px] border-[#07233b] bg-white">
            <LsGlyph name="shieldCheck" strokeWidth={2.4} className="h-[54px] w-[54px] text-[#07233b]" />
          </span>
        </div>
      </div>
      <div className="absolute left-[70px] right-[70px] top-[900px] flex flex-col gap-[18px]">
        {t.rows.map((row) => (
          <FeatureRow key={row.title} icon={row.icon} title={row.title} body={row.body} />
        ))}
      </div>
      <WhatsAppPill />
      <Disclaimer />
    </Slide>
  );
}

/* ─── 06 Datos importantes ──────────────────────────────────────────────────── */

function FactsSlide({ page }: { page: string }) {
  const t = LS_DECK.facts;
  return (
    <Slide>
      <Brandbar page={page} />
      <Heading kicker={t.kicker} lines={[t.title]} gold={t.titleGold} />
      <ul className="absolute left-[70px] right-[70px] top-[460px] flex flex-col gap-[26px]">
        {t.items.map((item) => (
          <li key={item.text} className="flex items-start gap-[22px]">
            <LsGlyph name={item.icon} strokeWidth={1.8} className="mt-[2px] h-[38px] w-[38px] flex-none text-[#d8bc78]" />
            <p className="text-[28px] font-semibold leading-[1.32] text-[#c8dbee]">
              <RichWhite text={item.text} />
            </p>
          </li>
        ))}
      </ul>
      <div className="absolute left-[70px] right-[70px] top-[870px] flex items-center gap-[32px]">
        <div className="relative h-[183px] w-[183px] flex-none overflow-hidden rounded-full border-[4px] border-[#d5bb7a]">
          {/* Ysmael's portrait from Isaac's deck (the same photo his PDFs use). */}
          <Image src={`${IMG}/ysmael.jpg`} alt={LS_DECK.agentName} fill sizes="183px" className="object-cover" />
        </div>
        <div>
          <div className="text-[33px] font-black leading-[1.15] text-white">{t.askTitle}</div>
          <div className="mt-[8px] text-[25px] font-semibold text-[#c8dbee]">{t.askBody}</div>
        </div>
      </div>
      <WhatsAppCta label={t.cta} />
      <Disclaimer />
    </Slide>
  );
}

/* ─── 08 Próximos pasos ─────────────────────────────────────────────────────── */

function NextStepsSlide({ page }: { page: string }) {
  const t = LS_DECK.next;
  return (
    <Slide>
      <Brandbar page={page} />
      <Heading kicker={t.kicker} lines={[t.title]} gold={t.titleGold} />
      <div className="absolute left-[70px] right-[70px] top-[452px] flex flex-col gap-[20px]">
        {t.steps.map((step, i) => (
          <div key={step.n} className={cn(i === 0 ? CARD_GOLD : `${CARD} rounded-[27px]`, "flex items-start gap-[26px] px-[30px] py-[26px]")} style={i === 0 ? CARD_GOLD_STYLE : undefined}>
            <span
              className="flex h-[66px] w-[66px] flex-none items-center justify-center rounded-full text-[32px] font-black text-[#07233b]"
              style={{ background: "radial-gradient(circle at 35% 30%, #f3d68a 0%, #e8c36b 45%, #a58743 100%)" }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[21px] font-extrabold uppercase tracking-[.13em] text-[#d8bc78]">{step.n}</div>
              <div className="mt-[6px] text-balance text-[33px] font-extrabold leading-[1.15] text-white">{step.title}</div>
              <p className="mt-[6px] text-[24px] font-semibold leading-[1.32] text-[#c8dbee]">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDetailsButton className="absolute left-[70px] right-[70px] top-[1180px] flex h-[120px] items-center justify-center gap-[18px] rounded-[26px] bg-[linear-gradient(180deg,#f3d68a_0%,#e2bf6a_55%,#c49a44_100%)] text-[38px] font-black text-[#07233b] shadow-[0_18px_40px_rgba(226,191,106,.28)] transition hover:brightness-105">
        {t.cta}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[40px] w-[40px]">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </ConfirmDetailsButton>
      <WhatsAppPill />
      <Disclaimer />
    </Slide>
  );
}

/* ─── the deck ──────────────────────────────────────────────────────────────── */

export type LsDeckData = {
  /** The client's first name, for the cover; empty hides the line. */
  firstName: string;
};

/** The slides in order; the cover is unnumbered, the rest "01 / 08" … "08 / 08". */
export function buildLegalShieldSlides(data: LsDeckData): ReactNode[] {
  const numbered: ((page: string) => ReactNode)[] = [
    (page) => <DualSlide key="dual" page={page} />,
    (page) => <ListSlide key="legal1" page={page} copy={LS_DECK.legal1} />,
    (page) => <ListSlide key="legal2" page={page} copy={LS_DECK.legal2} compact />,
    (page) => <ListSlide key="id1" page={page} copy={LS_DECK.id1} />,
    (page) => <IdentityTheftSlide key="id2" page={page} />,
    (page) => <FactsSlide key="facts" page={page} />,
    (page) => <PriceSlide key="price" page={page} />,
    (page) => <NextStepsSlide key="next" page={page} />,
  ];
  const total = String(numbered.length).padStart(2, "0");
  return [
    <CoverSlide key="cover" firstName={data.firstName} />,
    ...numbered.map((slide, i) => slide(`${String(i + 1).padStart(2, "0")} / ${total}`)),
  ];
}

