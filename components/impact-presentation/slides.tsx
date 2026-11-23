/**
 * The nine slides of the Impact sales presentation, on a fixed 900×1600 (9:16) canvas.
 *
 * Every size here is a canvas pixel: the deck shell scales the whole canvas to fit the window, the
 * way Isaac's HTML deck did, so a slide looks the same on a laptop and on the client's phone
 * through CrankWheel. Server-rendered; the only interactive piece is the "Confirm my details"
 * button on the last slide.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HouseholdSize, ImpactQuote, ImpactTierKey } from "@/lib/impact-quote/plans";
import { AGENT, DECK_COPY, TELEHEALTH_NAME, type DeckCopy, type DeckLocale } from "./copy";
import { Brandbar, IMG, Kicker, Lead, LOGO_WHITE, Slide, Title } from "./deck-parts";
import { Glyph, PORTAL_ICONS, type GlyphName } from "./icons";
import ConfirmDetailsButton from "./confirm-details-button";
import PortalMockup from "./portal-mockup";
import QuoteSlide from "./quote-slide";

export type DeckData = {
  locale: DeckLocale;
  /** The client's first name for the welcome line; empty hides the line. */
  firstName: string;
  /** Coverage start, already formatted in the deck's language ("1 de diciembre de 2026"). */
  startDate: string;
  /** Active licensed states from Sanity; 0 drops the number from the sentence. */
  licensedStates: number;
  /** Impact IBO number (env `IMPACT_AGENT_IBO`); null shows a dash. */
  agentIbo: string | null;
  /** The intake's token, for the live quote the agent pushes from the form. */
  token: string;
  /** Impact's prices for this household at render time, or null (the slide asks and quotes). */
  quote: ImpactQuote | null;
  /**
   * What the intake says about the household, to pre-fill the slide's quote questions: how many
   * people (as asked, not the 1 Impact prices from 65) and the oldest birth date.
   */
  household: { members: HouseholdSize; oldestDob: string | null };
  /** The plan on the intake when the deck opened, shown as picked until the deck has a pick of its own. */
  initialTier: ImpactTierKey | null;
};
/* ─── 1. Welcome ────────────────────────────────────────────────────────────── */

function WelcomeSlide({ t, firstName }: { t: DeckCopy; firstName: string }) {
  return (
    <section className="absolute inset-0 overflow-hidden bg-[#0b2a4a] text-white">
      {/*
        Photo: Letícia Alvares on Pexels (pexels.com/photo/36393879), free for commercial use under the
        Pexels license. Pre-cropped to 9:16 so the faces sit in the top 40%, clear of the welcome text;
        the shade stays light over them, darkens under the text and dims the top for the logo.
      */}
      <Image
        src={`${IMG}/welcome-mother-daughter.jpg`}
        alt=""
        fill
        priority
        sizes="900px"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,28,51,1)_0%,rgba(7,28,51,.96)_40%,rgba(7,28,51,.6)_52%,rgba(7,28,51,.1)_61%,rgba(7,28,51,.08)_82%,rgba(7,28,51,.55)_100%)]" />
      <Image
        src={LOGO_WHITE.src}
        alt="Impact Health Sharing"
        width={LOGO_WHITE.width}
        height={LOGO_WHITE.height}
        priority
        className="absolute left-[56px] top-[70px] h-[96px] w-auto"
      />
      <div className="absolute bottom-[140px] left-[56px] right-[56px]">
        {firstName && (
          <div className="mb-[16px] text-[38px] font-semibold text-[#ff8f74]">{t.welcome.hello(firstName)}</div>
        )}
        <h1 className="text-[88px] font-extrabold leading-[1.04] tracking-[-.01em] text-white">{t.welcome.title}</h1>
        <p className="mt-[22px] text-[31px] leading-[1.45] text-white/[.88]">{t.welcome.lead}</p>
        <div className="mt-[40px] flex flex-wrap gap-[14px]">
          {t.welcome.tags.map((tag) => (
            <span key={tag} className="rounded-full border-2 border-white/40 px-[24px] py-[12px] text-[23px] font-semibold">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 2. The agent's credential ─────────────────────────────────────────────── */

function BadgeCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[16px] bg-[#fbf6f2] px-[18px] py-[14px]">
      <b className="block text-[15px] font-semibold uppercase tracking-[.1em] text-[#56657a]">{label}</b>
      {children}
    </div>
  );
}

function Fact({ icon, children }: { icon: GlyphName; children: ReactNode }) {
  return (
    <div className="flex items-center gap-[20px] text-[27px] leading-[1.3] text-white/[.92]">
      <i className="flex h-[64px] w-[64px] flex-none items-center justify-center rounded-[18px] bg-white/10">
        <Glyph name={icon} className="h-[36px] w-[36px] text-white" />
      </i>
      <span>{children}</span>
    </div>
  );
}

function AgentSlide({ t, data, page }: { t: DeckCopy; data: DeckData; page: string }) {
  const value = "text-[24px] font-bold text-[#0b2a4a]";
  return (
    <Slide
      dark
      className="items-center bg-[radial-gradient(900px_900px_at_80%_10%,#16477a_0%,#0b2a4a_55%,#061a30_100%)]"
    >
      <div className="flex w-full flex-col items-center">
        <div className="relative mt-[10px] w-[700px] overflow-hidden rounded-[34px] bg-white shadow-[0_40px_90px_rgba(0,0,0,.45)]">
          <div className="relative bg-[linear-gradient(135deg,#0b2a4a_0%,#123a63_60%,#2f97a0_140%)] px-[40px] pb-[120px] pt-[40px]">
            <div className="absolute left-1/2 top-[16px] h-[16px] w-[130px] -translate-x-1/2 rounded-[8px] bg-white/[.18]" />
            <Image
              src={LOGO_WHITE.src}
              alt=""
              width={LOGO_WHITE.width}
              height={LOGO_WHITE.height}
              className="h-[60px] w-auto"
            />
            <div className="absolute right-[36px] top-[52px] rounded-[8px] bg-[#d8a94a] px-[16px] py-[8px] text-[17px] font-extrabold tracking-[.14em] text-[#0b2a4a]">
              {t.agent.authorized}
            </div>
          </div>
          <div className="relative mx-auto -mt-[130px] h-[250px] w-[250px] rounded-full border-[9px] border-white bg-[#dfe7ef] shadow-[0_10px_30px_rgba(11,42,74,.25)]">
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <Image src={AGENT.photo} alt={AGENT.name} fill sizes="250px" className="object-cover" />
            </div>
            <div className="absolute bottom-[14px] right-[6px] flex h-[60px] w-[60px] items-center justify-center rounded-full border-[6px] border-white bg-[#2f97a0]">
              <Glyph name="check" strokeWidth={3.4} className="h-[22px] w-[22px] text-white" />
            </div>
          </div>
          <div className="px-[40px] pb-[32px] pt-[24px] text-center">
            <div className="text-[46px] font-extrabold leading-[1.12] text-[#0b2a4a]">{AGENT.name}</div>
            <div className="mt-[10px] text-[22px] font-bold uppercase tracking-[.06em] text-[#f2735a]">
              {t.agent.role}
            </div>
            <div className="mt-[28px] grid grid-cols-2 gap-[14px] text-left">
              <BadgeCell label="IBO #">
                <span className={value}>{data.agentIbo ?? "—"}</span>
              </BadgeCell>
              <BadgeCell label={t.agent.status}>
                <span className="text-[24px] font-bold text-[#2f97a0]">{t.agent.active}</span>
              </BadgeCell>
              <BadgeCell label="WhatsApp">
                <span className={value}>{AGENT.whatsapp}</span>
              </BadgeCell>
              <BadgeCell label={t.agent.languages}>
                <span className={value}>{AGENT.languages}</span>
              </BadgeCell>
            </div>
          </div>
          <div className="flex items-center justify-between border-t-2 border-dashed border-[#e6e9ef] px-[40px] py-[18px] text-[19px] text-[#56657a]">
            <span>{AGENT.site}</span>
            <div className="h-[36px] w-[200px] bg-[repeating-linear-gradient(90deg,#0b2a4a_0_2px,transparent_2px_4px,#0b2a4a_4px_7px,transparent_7px_9px,#0b2a4a_9px_10px,transparent_10px_13px)]" />
          </div>
        </div>

        <div className="mt-[50px] w-full">
          <Kicker>{t.agent.kicker}</Kicker>
          <Title dark>{t.agent.title}</Title>
          <div className="mt-[44px] grid gap-[22px]">
            <Fact icon="shieldCheck">{t.agent.facts.representative}</Fact>
            <Fact icon="mapPin">{t.agent.facts.licensed(data.licensedStates)}</Fact>
            <Fact icon="chat">{t.agent.facts.bilingual}</Fact>
            <Fact icon="heart">{t.agent.facts.support}</Fact>
          </div>
        </div>
      </div>
      <Brandbar dark page={page} note={t.notInsurance} />
    </Slide>
  );
}

/* ─── 3. What is Impact ─────────────────────────────────────────────────────── */

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="rounded-[22px] border border-[#e6e9ef] bg-white px-[26px] py-[24px]">
      <div className="text-[52px] font-extrabold leading-none text-[#0b2a4a]">
        {value}
        {unit && <small className="text-[28px]">{unit}</small>}
      </div>
      <div className="mt-[8px] text-[21px] leading-[1.3] text-[#56657a]">{label}</div>
    </div>
  );
}

function WhatSlide({ t, page }: { t: DeckCopy; page: string }) {
  const s = t.what.stats;
  return (
    <Slide>
      <Kicker>{t.what.kicker}</Kicker>
      <Title>{t.what.title}</Title>
      <Lead>{t.what.lead}</Lead>
      <div className="mt-[30px] grid grid-cols-2 gap-[18px]">
        <Stat value="24,000" unit="+" label={s.members} />
        <Stat value="$275M" unit="+" label={s.shared} />
        <Stat value="6" unit={`+ ${s.yearsUnit}`} label={s.years} />
        <Stat value="365" label={s.days} />
      </div>
      <div className="relative mt-[34px] h-[470px] flex-none overflow-hidden rounded-[30px] shadow-[0_30px_60px_rgba(11,42,74,.18)]">
        <Image src={`${IMG}/people-helping-people.jpg`} alt="" fill sizes="788px" className="object-cover" />
        <div className="absolute bottom-[24px] left-[24px] right-[24px] flex items-center gap-[18px] rounded-[22px] bg-white/95 px-[26px] py-[22px]">
          <Glyph name="heart" className="h-[30px] w-[30px] text-[#f2735a]" />
          <b className="text-[27px] leading-[1.25] text-[#0b2a4a]">{t.what.photoCaption}</b>
        </div>
      </div>
      <Brandbar page={page} />
    </Slide>
  );
}

/* ─── 4–5. Benefits ─────────────────────────────────────────────────────────── */

function Benefit({
  icon,
  title,
  free,
  highlight,
  children,
}: {
  icon: GlyphName;
  title: string;
  free?: boolean;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border px-[36px] py-[34px]",
        highlight ? "border-[#0b2a4a] bg-[#0b2a4a]" : "border-[#e6e9ef] bg-white"
      )}
    >
      {free && (
        <span className="absolute right-[30px] top-[34px] rounded-full bg-[#f2735a] px-[20px] py-[8px] text-[26px] font-extrabold text-white">
          $0
        </span>
      )}
      <div
        className={cn(
          "mb-[20px] flex h-[84px] w-[84px] items-center justify-center rounded-[22px]",
          highlight ? "bg-white/[.12]" : "bg-[#d6f2ee]"
        )}
      >
        <Glyph name={icon} className={cn("h-[42px] w-[42px]", highlight ? "text-white" : "text-[#0b2a4a]")} />
      </div>
      <h3
        className={cn(
          "pr-[90px] text-[36px] font-bold leading-[1.15]",
          highlight ? "text-white" : "text-[#0b2a4a]"
        )}
      >
        {title}
      </h3>
      <p className={cn("mt-[12px] text-[25px] leading-[1.45]", highlight ? "text-white/80" : "text-[#56657a]")}>
        {children}
      </p>
    </div>
  );
}

function BenefitsSlide({ t, page }: { t: DeckCopy; page: string }) {
  const b = t.benefits;
  return (
    <Slide>
      <Kicker>{b.kicker}</Kicker>
      <Title>{b.title}</Title>
      <div className="mt-[40px] grid gap-[22px]">
        <Benefit icon="stethoscope" title={b.wellness.title} free highlight>
          {b.wellness.body}
        </Benefit>
        <Benefit icon="doctor" title={b.doctor.title}>
          {b.doctor.body}
        </Benefit>
        <Benefit icon="phonePlus" title={b.telehealth.title} free>
          {b.telehealth.before}
          <b>{TELEHEALTH_NAME}</b>
          {b.telehealth.after}
        </Benefit>
      </div>
      <Brandbar page={page} />
    </Slide>
  );
}

function Benefits2Slide({ t, page }: { t: DeckCopy; page: string }) {
  const b = t.benefits2;
  return (
    <Slide>
      <Kicker>{t.benefits.kicker}</Kicker>
      <Title>{b.title}</Title>
      <div className="mt-[40px] grid gap-[22px]">
        <Benefit icon="tooth" title={b.dentalVision.title}>
          {b.dentalVision.body}
        </Benefit>
        <Benefit icon="pill" title={b.prescriptions.title}>
          {b.prescriptions.body}
        </Benefit>
        <Benefit icon="runner" title={b.rewards.title}>
          {b.rewards.body}
        </Benefit>
      </div>
      <Brandbar page={page} />
    </Slide>
  );
}

/* ─── 6. More protection ────────────────────────────────────────────────────── */

const MORE_ICONS: GlyphName[] = ["hospital", "baby", "brain", "bell", "infinity", "bill"];

function MoreSlide({ t, page }: { t: DeckCopy; page: string }) {
  return (
    <Slide>
      <Kicker>{t.more.kicker}</Kicker>
      <Title>{t.more.title}</Title>
      <div className="mt-[36px] grid gap-[16px]">
        {t.more.items.map((item, i) => (
          <div
            key={item.title}
            className="flex items-start gap-[22px] rounded-[22px] border border-[#e6e9ef] bg-white px-[28px] py-[22px]"
          >
            <div className="flex h-[68px] w-[68px] flex-none items-center justify-center rounded-[18px] bg-[#fbf6f2]">
              <Glyph name={MORE_ICONS[i]} className="h-[36px] w-[36px] text-[#0b2a4a]" />
            </div>
            <div>
              <h3 className="text-[28px] font-bold leading-[1.2] text-[#0b2a4a]">{item.title}</h3>
              <p className="mt-[4px] text-[21px] leading-[1.4] text-[#56657a]">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
      <Brandbar page={page} />
    </Slide>
  );
}

/* ─── 7. Provider fees ──────────────────────────────────────────────────────── */

function Amount({ value, zero }: { value: string; zero?: boolean }) {
  return (
    <div className={cn("text-[84px] font-extrabold leading-none", zero ? "text-[#2f97a0]" : "text-[#0b2a4a]")}>
      <sup className="mr-[2px] align-[38px] text-[40px]">$</sup>
      {value}
    </div>
  );
}

function Fee({ value, what, sub, zero }: { value: string; what: ReactNode; sub: string; zero?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[26px] border px-[24px] py-[30px] text-center",
        zero ? "border-[#bfe7e0] bg-[#d6f2ee]" : "border-[#e6e9ef] bg-white"
      )}
    >
      <Amount value={value} zero={zero} />
      <div className="mt-[14px] text-[26px] font-bold leading-[1.25] text-[#14243a]">{what}</div>
      <div className="mt-[6px] text-[20px] text-[#56657a]">{sub}</div>
    </div>
  );
}

function FeesSlide({ t, page }: { t: DeckCopy; page: string }) {
  const f = t.fees;
  return (
    <Slide>
      <Kicker>{f.kicker}</Kicker>
      <Title>{f.title}</Title>
      <div className="mt-[40px] grid grid-cols-2 gap-[20px]">
        <Fee value="0" zero what={f.telehealth.what} sub={f.telehealth.sub} />
        <Fee value="0" zero what={f.wellness.what} sub={f.wellness.sub} />
        <Fee value="50" what={f.primary.what} sub={f.primary.sub} />
        <Fee value="75" what={f.specialist.what} sub={f.specialist.sub} />
        <Fee value="75" what={f.urgentCare.what} sub={f.urgentCare.sub} />
        <Fee
          value="150"
          what={
            <>
              {f.emergency[0]}
              <br />
              {f.emergency[1]}
            </>
          }
          sub=""
        />
      </div>
      <div className="mt-[22px] rounded-[24px] bg-[#0b2a4a] px-[32px] py-[28px] text-[24px] leading-[1.45] text-white">
        <b className="text-[#ff8f74]">{f.howLabel}</b> {f.how}
      </div>
      <Brandbar page={page} />
    </Slide>
  );
}

/* ─── 8. Member ID card ─────────────────────────────────────────────────────── */

function CardSide({
  src,
  height,
  alt,
  label,
  sample,
}: {
  src: string;
  /** Pixel height of the 1200-wide source image. */
  height: number;
  alt: string;
  label: string;
  sample?: string;
}) {
  return (
    <div className="relative rounded-[30px] bg-white shadow-[0_24px_50px_rgba(11,42,74,.22)]">
      <span className="absolute -top-[16px] left-[24px] z-[2] rounded-full bg-[#0b2a4a] px-[16px] py-[6px] text-[17px] font-bold tracking-[.14em] text-white">
        {label}
      </span>
      {sample && (
        <span className="absolute -top-[16px] right-[24px] z-[2] rounded-full bg-[#f2735a] px-[16px] py-[6px] text-[17px] font-extrabold tracking-[.14em] text-white">
          {sample}
        </span>
      )}
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={height}
        sizes="788px"
        className="block h-auto w-full rounded-[30px]"
      />
    </div>
  );
}

function CardSlide({ t, page }: { t: DeckCopy; page: string }) {
  return (
    <Slide>
      <Kicker>{t.card.kicker}</Kicker>
      <Title>{t.card.title}</Title>
      <div className="mt-[34px] grid gap-[26px]">
        <CardSide
          src={`${IMG}/member-card-front.jpg`}
          height={808}
          alt="Impact member ID card, front"
          label={t.card.front}
          sample={t.card.sample}
        />
        <CardSide
          src={`${IMG}/member-card-back.jpg`}
          height={812}
          alt="Impact member ID card, back"
          label={t.card.back}
        />
      </div>
      <Brandbar page={page} />
    </Slide>
  );
}

/* ─── The member portal ─────────────────────────────────────────────────────── */

function PortalSlide({ t, locale, page }: { t: DeckCopy; locale: DeckLocale; page: string }) {
  return (
    <Slide>
      <Kicker>{t.portal.kicker}</Kicker>
      <Title>{t.portal.title}</Title>
      <Lead>{t.portal.lead}</Lead>
      <div className="mt-[36px] flex items-start gap-[30px]">
        <div className="relative h-[736px] w-[368px] flex-none">
          <div className="absolute left-0 top-0 origin-top-left scale-[1.15]">
            <PortalMockup locale={locale} />
          </div>
        </div>
        <div className="grid gap-[16px]">
          {t.portal.features.map((feature, i) => (
            <div key={feature.title} className="flex items-start gap-[16px]">
              <span className="flex h-[56px] w-[56px] flex-none items-center justify-center rounded-[16px] bg-[#d6f2ee] text-[#0b2a4a]">
                <Glyph name={PORTAL_ICONS[i] ?? "check"} className="h-[30px] w-[30px]" />
              </span>
              <div>
                <h3 className="text-[25px] font-bold leading-[1.2] text-[#0b2a4a]">{feature.title}</h3>
                <p className="mt-[4px] text-[19px] leading-[1.4] text-[#56657a]">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Brandbar page={page} />
    </Slide>
  );
}

/* ─── 9. Next steps ─────────────────────────────────────────────────────────── */

function NextSlide({ t, startDate, page }: { t: DeckCopy; startDate: string; page: string }) {
  return (
    <Slide dark>
      <Kicker>{t.next.kicker}</Kicker>
      <Title dark>{t.next.title}</Title>
      <div className="mt-[44px] grid gap-[22px]">
        {t.next.steps.map((step, i) => (
          <div key={step.n} className="rounded-[28px] border border-white/[.14] bg-white/[.07] px-[36px] py-[32px]">
            <div className="text-[21px] font-bold tracking-[.14em] text-[#ff8f74]">{step.n}</div>
            <h3 className="mt-[8px] text-[38px] font-bold leading-[1.2] text-white">{step.title}</h3>
            <p className="mt-[10px] text-[25px] leading-[1.42] text-white/[.78]">{step.body}</p>
            {i === t.next.steps.length - 1 && (
              <span className="mt-[16px] inline-block rounded-[14px] bg-[#f2735a] px-[24px] py-[10px] text-[30px] font-extrabold text-white">
                {startDate}
              </span>
            )}
          </div>
        ))}
      </div>
      <ConfirmDetailsButton className="mt-[40px] flex w-full items-center justify-center gap-[16px] rounded-[22px] bg-[#f2735a] px-[36px] py-[28px] text-[34px] font-extrabold text-white shadow-[0_18px_40px_rgba(242,115,90,.35)] transition hover:bg-[#ff8f74]">
        {t.next.cta}
        <Glyph name="arrowRight" className="h-[38px] w-[38px] text-white" />
      </ConfirmDetailsButton>
      <div className="mt-[28px] text-[18px] leading-[1.45] text-white/55">{t.next.disclaimer}</div>
      <Brandbar dark page={page} />
    </Slide>
  );
}

/* ─── the deck ──────────────────────────────────────────────────────────────── */

/**
 * The slides in order, each keyed and numbered. The quote sits right before "Next steps": the
 * client sees the price once they've seen everything it buys.
 */
export function buildImpactSlides(data: DeckData): ReactNode[] {
  const t = DECK_COPY[data.locale];
  const order: ((page: string) => ReactNode)[] = [
    () => <WelcomeSlide key="welcome" t={t} firstName={data.firstName} />,
    (page) => <AgentSlide key="agent" t={t} data={data} page={page} />,
    (page) => <WhatSlide key="what" t={t} page={page} />,
    (page) => <BenefitsSlide key="benefits" t={t} page={page} />,
    (page) => <Benefits2Slide key="benefits2" t={t} page={page} />,
    (page) => <MoreSlide key="more" t={t} page={page} />,
    (page) => <FeesSlide key="fees" t={t} page={page} />,
    (page) => <CardSlide key="card" t={t} page={page} />,
    (page) => <PortalSlide key="portal" t={t} locale={data.locale} page={page} />,
    (page) => (
      <QuoteSlide
        key="quote"
        locale={data.locale}
        token={data.token}
        initial={data.quote}
        household={data.household}
        initialTier={data.initialTier}
        page={page}
      />
    ),
    (page) => <NextSlide key="next" t={t} startDate={data.startDate} page={page} />,
  ];
  return order.map((slide, i) => slide(`${i + 1} / ${order.length}`));
}
