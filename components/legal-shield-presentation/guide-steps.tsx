/**
 * The nine screens of the self-serve Legal Shield presentation (`/es/legal-shield/plan`), as a
 * normal responsive page.
 *
 * Same words, photos and icons as Ysmael's 9:16 deck (`copy.ts`, `slides.tsx`), laid out for
 * someone reading alone on a phone rather than for a canvas on a shared screen. The new words are
 * the guide's own (`LS_GUIDE`): the 2-minute intro, the self-serve next steps. The price screen
 * offers the bundle only. Server-rendered; the shell (`guide.tsx`) shows one at a time.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LS_WHATSAPP_HREF } from "@/lib/legal-shield/constants";
import { LS_DECK, LS_GUIDE, type LsIcon } from "./copy";
import { GOLD_TEXT_STYLE, Rich } from "./deck-parts";
import { DetectiveGlyph, LsGlyph, WhatsAppGlyph } from "./icons";
import GuidePrice from "./guide-price";

const IMG = "/images/legal-shield/presentation";
const MARK = "/images/legal-shield/red-de-apoyo-mark.svg";

/* ─── building blocks ───────────────────────────────────────────────────────── */

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#d8bc78] sm:text-sm">{children}</p>;
}

/** White first line, gold second, like every title in the deck. */
function Title({ white, gold, as: Tag = "h2" }: { white: string; gold: string; as?: "h1" | "h2" }) {
  return (
    <Tag className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
      <span className="block">{white}</span>
      <span className="block pb-1" style={GOLD_TEXT_STYLE}>
        {gold}
      </span>
    </Tag>
  );
}

const CARD = "rounded-3xl border border-white/15 bg-white/[.05]";

function Icon({ icon, solid, size = "md" }: { icon: LsIcon; solid?: boolean; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "flex flex-none items-center justify-center rounded-full",
        size === "lg" ? "h-14 w-14" : "h-12 w-12",
        !solid && "border border-[#d5bb7a]/70"
      )}
      style={{
        background: solid
          ? "radial-gradient(circle at 35% 30%, #f3d68a 0%, #e8c36b 40%, #a58743 100%)"
          : "linear-gradient(180deg, #4f5b59 0%, #2f414a 100%)",
      }}
    >
      <LsGlyph
        name={icon}
        strokeWidth={solid ? 2.1 : 1.7}
        className={cn(size === "lg" ? "h-7 w-7" : "h-6 w-6", solid ? "text-[#07233b]" : "text-[#ecd08a]")}
      />
    </span>
  );
}

function Row({ icon, title, body }: { icon: LsIcon; title: string; body: string }) {
  return (
    <li className={cn(CARD, "flex items-center gap-4 px-4 py-3.5")}>
      <Icon icon={icon} />
      <div className="min-w-0">
        <p className="text-[17px] font-extrabold leading-snug">{title}</p>
        <p className="mt-0.5 text-[15px] font-medium leading-snug text-[#c8dbee]">
          <Rich text={body} />
        </p>
      </div>
    </li>
  );
}

/** `**bold**` as white bold (the deck's "Cubre a…" line and the facts), not the gold highlight. */
function BoldWhite({ text }: { text: string }) {
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

function ListScreen({ copy }: { copy: { kicker: string; title: string; titleGold: string; rows: readonly { icon: LsIcon; title: string; body: string }[] } }) {
  return (
    <div>
      <Kicker>{copy.kicker}</Kicker>
      <Title white={copy.title} gold={copy.titleGold} />
      <ul className="mt-5 space-y-3">
        {copy.rows.map((row) => (
          <Row key={row.title} icon={row.icon} title={row.title} body={row.body} />
        ))}
      </ul>
    </div>
  );
}

/* ─── 1. Portada ────────────────────────────────────────────────────────────── */

function Cover() {
  const t = LS_DECK.cover;
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl border border-white/15">
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/12]">
          <Image
            src={`${IMG}/cover-abuelo-nieto.webp`}
            alt=""
            fill
            priority
            sizes="(min-width: 640px) 576px, 100vw"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,35,59,.97)_0%,rgba(7,35,59,.7)_34%,rgba(7,35,59,0)_62%)]" />
          <div className="absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark */}
              <img src={MARK} alt="" width={44} height={44} className="h-11 w-11" />
              <p className="text-xs font-bold leading-tight tracking-[.12em] text-[#c8dbee]">
                RED DE APOYO
                <span className="block text-sm font-extrabold text-[#d7bd7c]">LATINO USA</span>
              </p>
            </div>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[.14em] text-[#d8bc78]">{t.kicker}</p>
            <h1 className="mt-1.5 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              {t.title.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <span className="block pb-1" style={GOLD_TEXT_STYLE}>
                {t.titleGold}
              </span>
            </h1>
          </div>
        </div>
      </div>
      <p className="mt-5 rounded-2xl border border-[#d5bb7a]/50 bg-[#283c46]/60 px-4 py-3 text-base font-semibold text-[#efdda5]">
        {LS_GUIDE.intro}
      </p>
      <p className="mt-3 text-sm font-medium text-[#c8dbee]">{LS_GUIDE.advisorLine}</p>
    </div>
  );
}

/* ─── 2. Tu plan dual ───────────────────────────────────────────────────────── */

function Dual() {
  const t = LS_DECK.dual;
  return (
    <div>
      <Kicker>{t.kicker}</Kicker>
      <Title white={t.title} gold={t.titleGold} />
      <ul className="mt-5 space-y-3">
        {t.cards.map((card) => {
          const highlight = "highlight" in card && card.highlight;
          return (
            <li
              key={card.title}
              className={cn(
                "flex items-center gap-4 rounded-3xl px-4 py-4",
                highlight ? "border-2 border-[#d5bb7a]" : CARD
              )}
              style={highlight ? { background: "linear-gradient(90deg, #303e41 0%, #142e45 100%)" } : undefined}
            >
              <Icon icon={card.icon} solid size="lg" />
              <div className="min-w-0">
                <p className="text-xl font-extrabold">{card.title}</p>
                <p className="mt-1 text-[15px] font-medium leading-snug text-[#c8dbee]">{card.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 flex items-start gap-3 text-lg font-semibold leading-snug text-[#c8dbee]">
        <LsGlyph name="family" strokeWidth={1.8} className="mt-0.5 h-7 w-7 flex-none text-[#d8bc78]" />
        <span>
          <BoldWhite text={t.covers} />
        </span>
      </p>
    </div>
  );
}

/* ─── 6. Si te roban la identidad ───────────────────────────────────────────── */

function IdentityTheft() {
  const t = LS_DECK.id2;
  return (
    <div>
      <Kicker>{t.kicker}</Kicker>
      <Title white={t.title} gold={t.titleGold} />
      <div className="mx-auto mt-6 h-44 w-44 rounded-full bg-white/[.07] p-2.5 sm:h-52 sm:w-52">
        <div
          className="relative flex h-full w-full items-center justify-center rounded-full"
          style={{ background: "radial-gradient(circle at 35% 28%, #f5d98f 0%, #e5bd63 45%, #b98d3e 100%)" }}
        >
          <DetectiveGlyph className="h-20 w-20 text-[#07233b] sm:h-24 sm:w-24" />
          <span className="absolute bottom-2 right-2 flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#07233b] bg-white">
            <LsGlyph name="shieldCheck" strokeWidth={2.4} className="h-6 w-6 text-[#07233b]" />
          </span>
        </div>
      </div>
      <ul className="mt-6 space-y-3">
        {t.rows.map((row) => (
          <Row key={row.title} icon={row.icon} title={row.title} body={row.body} />
        ))}
      </ul>
    </div>
  );
}

/* ─── 7. Datos importantes ──────────────────────────────────────────────────── */

function Facts() {
  const t = LS_DECK.facts;
  const whatsappHref = `${LS_WHATSAPP_HREF}?text=${encodeURIComponent(LS_GUIDE.whatsappText)}`;
  return (
    <div>
      <Kicker>{t.kicker}</Kicker>
      <Title white={t.title} gold={t.titleGold} />
      <ul className="mt-5 space-y-4">
        {t.items.map((item) => (
          <li key={item.text} className="flex items-start gap-3 text-[17px] font-medium leading-snug text-[#c8dbee]">
            <LsGlyph name={item.icon} strokeWidth={1.8} className="mt-0.5 h-6 w-6 flex-none text-[#d8bc78]" />
            <span>
              <BoldWhite text={item.text} />
            </span>
          </li>
        ))}
      </ul>
      <div className={cn(CARD, "mt-6 flex items-center gap-4 p-4")}>
        <div className="relative h-20 w-20 flex-none overflow-hidden rounded-full border-[3px] border-[#d5bb7a]">
          <Image src={`${IMG}/ysmael.jpg`} alt={LS_DECK.agentName} fill sizes="80px" className="object-cover" />
        </div>
        <div>
          <p className="text-lg font-black leading-tight">{t.askTitle}</p>
          <p className="mt-1 text-[15px] font-medium text-[#c8dbee]">{t.askBody}</p>
        </div>
      </div>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center gap-4 rounded-full bg-[#25d366] px-6 py-4 text-white transition hover:brightness-105"
      >
        <WhatsAppGlyph className="h-9 w-9 flex-none" />
        <span className="leading-tight">
          <span className="block text-xs font-extrabold uppercase tracking-[.1em]">{LS_GUIDE.askCta}</span>
          <span className="block text-2xl font-black">{LS_DECK.phone}</span>
        </span>
      </a>
    </div>
  );
}

/* ─── 9. Próximos pasos ─────────────────────────────────────────────────────── */

function NextSteps() {
  const t = LS_GUIDE.next3;
  return (
    <div>
      <Kicker>{t.kicker}</Kicker>
      <Title white={t.title} gold={t.titleGold} />
      <ol className="mt-5 space-y-3">
        {t.steps.map((step, i) => (
          <li
            key={step.n}
            className={cn("flex items-start gap-4 rounded-3xl px-4 py-4", i === 0 ? "border-2 border-[#d5bb7a]" : CARD)}
            style={i === 0 ? { background: "linear-gradient(90deg, #303e41 0%, #142e45 100%)" } : undefined}
          >
            <span
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-lg font-black text-[#07233b]"
              style={{ background: "radial-gradient(circle at 35% 30%, #f3d68a 0%, #e8c36b 45%, #a58743 100%)" }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[.13em] text-[#d8bc78]">{step.n}</p>
              <p className="mt-1 text-lg font-extrabold leading-snug">{step.title}</p>
              <p className="mt-1 text-[15px] font-medium leading-snug text-[#c8dbee]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-center text-base font-bold text-[#efdda5]">{t.hint}</p>
    </div>
  );
}

/* ─── the guide ─────────────────────────────────────────────────────────────── */

/** The screens in order: the deck's cover and six slides, the bundle's price, the next steps. */
export function buildLegalShieldGuideSteps(): ReactNode[] {
  return [
    <Cover key="cover" />,
    <Dual key="dual" />,
    <ListScreen key="legal1" copy={LS_DECK.legal1} />,
    <ListScreen key="legal2" copy={LS_DECK.legal2} />,
    <ListScreen key="id1" copy={LS_DECK.id1} />,
    <IdentityTheft key="id2" />,
    <Facts key="facts" />,
    <GuidePrice key="price" />,
    <NextSteps key="next" />,
  ];
}
