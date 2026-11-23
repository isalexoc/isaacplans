/**
 * The nine screens of the self-serve Impact guide (`/impact`), as a normal responsive page.
 *
 * Same words and pictures as the CrankWheel deck (`slides.tsx`, `copy.ts`), laid out for someone
 * reading alone on a phone or a laptop rather than for a 9:16 canvas on a shared screen. The only
 * new words are the guide's own: the 2-minute intro, the self-serve next steps and "Apply now".
 * Server-rendered; the shell (`impact-guide.tsx`) shows one at a time.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { GUIDE_SCOPE } from "@/lib/impact-quote/sync";
import { agentContact, formatWhatsapp, languagesLabel, type AgentPublicProfile } from "@/lib/tenancy/profile";
import AgentPhoto from "@/components/tenant/agent-photo";
import { DECK_COPY, TELEHEALTH_NAME, type DeckCopy, type DeckLocale } from "./copy";
import { Glyph, PORTAL_ICONS, type GlyphName } from "./icons";
import GuideQuote from "./guide-quote";
import PortalMockup from "./portal-mockup";

const IMG = "/images/impact/presentation";

export type GuideData = {
  locale: DeckLocale;
  /** Impact's earliest start date, formatted ("1 de diciembre de 2026"). */
  startDate: string;
  /** Whose guide: Isaac's profile on /impact, the agent's on their page of the product domain. */
  agent: AgentPublicProfile;
  /** Isaac, signed in as admin: the quote screen adds his quote image box for anyone he quotes. */
  admin: boolean;
  /**
   * Where "Apply now" goes, as a plain link (an agent's /{l}/{slug}/apply). Absent: Isaac's
   * /health-alternative/apply/start, through the localized next-intl link as always.
   */
  applyHref?: string;
  /** The quote's plan scope (lib/impact-quote/sync.ts): `guideScopeFor(slug)` for an agent. */
  planScope?: string;
};

/* ─── building blocks ───────────────────────────────────────────────────────── */

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[.14em] text-[#f2735a] sm:text-sm">{children}</p>;
}

function Title({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h1" | "h2" }) {
  return (
    <Tag className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-[#0b2a4a] sm:text-4xl">{children}</Tag>
  );
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-base leading-relaxed text-[#56657a] sm:text-lg">{children}</p>;
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-3xl border border-[#e6e9ef] bg-white p-5 sm:p-6", className)}>{children}</div>;
}

function IconTile({ icon, dark }: { icon: GlyphName; dark?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-12 w-12 flex-none items-center justify-center rounded-2xl",
        dark ? "bg-white/[.12] text-white" : "bg-[#d6f2ee] text-[#0b2a4a]"
      )}
    >
      <Glyph name={icon} className="h-6 w-6" />
    </span>
  );
}

/* ─── 1. Welcome ────────────────────────────────────────────────────────────── */

function Welcome({ t }: { t: DeckCopy }) {
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-[#0b2a4a] text-white">
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/11]">
          <Image
            src={`${IMG}/welcome-mother-daughter.jpg`}
            alt=""
            fill
            priority
            sizes="(min-width: 640px) 640px, 100vw"
            className="object-cover object-[center_30%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,28,51,.95)_0%,rgba(7,28,51,.6)_38%,rgba(7,28,51,0)_62%,rgba(7,28,51,.45)_100%)]" />
          <Image
            src={`${IMG}/logo-white.png`}
            alt="Impact Health Sharing"
            width={409}
            height={112}
            priority
            className="absolute left-5 top-5 h-10 w-auto sm:h-12"
          />
          <div className="absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t.welcome.title}</h1>
          </div>
        </div>
      </div>
      <Lead>{t.welcome.lead}</Lead>
      <div className="mt-4 flex flex-wrap gap-2">
        {t.welcome.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#0b2a4a] px-3.5 py-1.5 text-sm font-semibold text-white">
            {tag}
          </span>
        ))}
      </div>
      <p className="mt-5 rounded-2xl bg-[#d6f2ee] px-4 py-3 text-sm font-medium text-[#0b2a4a] sm:text-base">
        {t.guide.intro}
      </p>
    </div>
  );
}

/* ─── 2. The agent ──────────────────────────────────────────────────────────── */

function Agent({ t, data }: { t: DeckCopy; data: GuideData }) {
  const agent = data.agent;
  const service = t.agent.facts.service(agent.languages);
  const cells: [string, ReactNode][] = [
    ["IBO #", agent.iboNumber ?? "—"],
    [t.agent.status, <span key="s" className="text-[#2f97a0]">{t.agent.active}</span>],
    ["WhatsApp", formatWhatsapp(agent.whatsappE164) ?? "—"],
    [t.agent.languages, languagesLabel(agent.languages) || "—"],
  ];
  // "Licensed" only for a licensed agent; the service line only for the languages they speak.
  const facts: [GlyphName, string][] = [
    ["shieldCheck", t.agent.facts.representative],
    ...(agent.licensed ? [["mapPin", t.agent.facts.licensed(agent.licensedStateCount)] as [GlyphName, string]] : []),
    ...(service ? [["chat", service] as [GlyphName, string]] : []),
    ["heart", t.agent.facts.support],
  ];
  return (
    <div>
      <Kicker>{t.agent.kicker}</Kicker>
      <Title>{t.agent.title}</Title>
      <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-[0_20px_50px_rgba(11,42,74,.15)]">
        <div className="flex items-center justify-between bg-[linear-gradient(135deg,#0b2a4a_0%,#123a63_60%,#2f97a0_140%)] px-5 pb-14 pt-5">
          <Image src={`${IMG}/logo-white.png`} alt="" width={409} height={112} className="h-8 w-auto" />
          <span className="rounded-md bg-[#d8a94a] px-2.5 py-1 text-[11px] font-extrabold tracking-[.14em] text-[#0b2a4a]">
            {t.agent.authorized}
          </span>
        </div>
        <div className="relative mx-auto -mt-12 h-28 w-28 rounded-full border-[5px] border-white bg-[#dfe7ef] shadow-md">
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <AgentPhoto agent={agent} sizes="112px" initialsClassName="text-4xl" />
          </div>
          <span className="absolute -right-1 bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-[#2f97a0]">
            <Glyph name="check" strokeWidth={3.4} className="h-3.5 w-3.5 text-white" />
          </span>
        </div>
        <div className="px-5 pb-5 pt-3 text-center">
          <p className="text-2xl font-extrabold text-[#0b2a4a]">{agent.displayName}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[.08em] text-[#f2735a]">{t.agent.role}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            {cells.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#fbf6f2] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#56657a]">{label}</p>
                <p className="text-sm font-bold text-[#0b2a4a] sm:text-base">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {facts.map(([icon, text]) => (
          <li key={text} className="flex items-center gap-3 text-base text-[#14243a]">
            <IconTile icon={icon} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── 3. What is Impact ─────────────────────────────────────────────────────── */

function What({ t }: { t: DeckCopy }) {
  const s = t.what.stats;
  const stats: [string, string][] = [
    ["24,000+", s.members],
    ["$275M+", s.shared],
    [`6+ ${s.yearsUnit}`, s.years],
    ["365", s.days],
  ];
  return (
    <div>
      <Kicker>{t.what.kicker}</Kicker>
      <Title>{t.what.title}</Title>
      <Lead>{t.what.lead}</Lead>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {stats.map(([value, label]) => (
          <Card key={label} className="p-4 sm:p-5">
            <p className="text-2xl font-extrabold text-[#0b2a4a] sm:text-3xl">{value}</p>
            <p className="mt-1 text-sm leading-snug text-[#56657a]">{label}</p>
          </Card>
        ))}
      </div>
      <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-3xl">
        <Image src={`${IMG}/people-helping-people.jpg`} alt="" fill sizes="(min-width: 640px) 640px, 100vw" className="object-cover" />
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3">
          <Glyph name="heart" className="h-5 w-5 text-[#f2735a]" />
          <b className="text-base text-[#0b2a4a]">{t.what.photoCaption}</b>
        </div>
      </div>
    </div>
  );
}

/* ─── 4–6. Benefits and protection ──────────────────────────────────────────── */

function Benefit({ icon, title, free, highlight, children }: { icon: GlyphName; title: string; free?: boolean; highlight?: boolean; children: ReactNode }) {
  return (
    <Card className={cn("relative", highlight && "border-[#0b2a4a] bg-[#0b2a4a]")}>
      {free && (
        <span className="absolute right-4 top-4 rounded-full bg-[#f2735a] px-3 py-1 text-sm font-extrabold text-white">$0</span>
      )}
      <IconTile icon={icon} dark={highlight} />
      <h3 className={cn("mt-3 pr-14 text-xl font-bold leading-snug", highlight ? "text-white" : "text-[#0b2a4a]")}>{title}</h3>
      <p className={cn("mt-1.5 text-base leading-relaxed", highlight ? "text-white/80" : "text-[#56657a]")}>{children}</p>
    </Card>
  );
}

function Benefits({ t }: { t: DeckCopy }) {
  const b = t.benefits;
  return (
    <div>
      <Kicker>{b.kicker}</Kicker>
      <Title>{b.title}</Title>
      <div className="mt-5 space-y-3">
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
    </div>
  );
}

function Benefits2({ t }: { t: DeckCopy }) {
  const b = t.benefits2;
  return (
    <div>
      <Kicker>{t.benefits.kicker}</Kicker>
      <Title>{b.title}</Title>
      <div className="mt-5 space-y-3">
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
    </div>
  );
}

const MORE_ICONS: GlyphName[] = ["hospital", "baby", "brain", "bell", "infinity", "bill"];

function More({ t }: { t: DeckCopy }) {
  return (
    <div>
      <Kicker>{t.more.kicker}</Kicker>
      <Title>{t.more.title}</Title>
      <div className="mt-5 space-y-3">
        {t.more.items.map((item, i) => (
          <Card key={item.title} className="flex items-start gap-3 p-4">
            <IconTile icon={MORE_ICONS[i]} />
            <div>
              <h3 className="text-lg font-bold leading-snug text-[#0b2a4a]">{item.title}</h3>
              <p className="mt-0.5 text-[15px] leading-relaxed text-[#56657a]">{item.body}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── 7. Provider fees ──────────────────────────────────────────────────────── */

function Fee({ value, what, sub, zero }: { value: string; what: ReactNode; sub?: string; zero?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-3xl border px-4 py-5 text-center",
        zero ? "border-[#bfe7e0] bg-[#d6f2ee]" : "border-[#e6e9ef] bg-white"
      )}
    >
      <p className={cn("text-4xl font-extrabold leading-none", zero ? "text-[#2f97a0]" : "text-[#0b2a4a]")}>
        <sup className="mr-0.5 align-[14px] text-lg">$</sup>
        {value}
      </p>
      <div>
        <p className="mt-2 text-base font-bold leading-snug text-[#14243a]">{what}</p>
        {sub && <p className="mt-0.5 text-sm text-[#56657a]">{sub}</p>}
      </div>
    </div>
  );
}

function Fees({ t }: { t: DeckCopy }) {
  const f = t.fees;
  return (
    <div>
      <Kicker>{f.kicker}</Kicker>
      <Title>{f.title}</Title>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Fee value="0" zero what={f.telehealth.what} sub={f.telehealth.sub} />
        <Fee value="0" zero what={f.wellness.what} sub={f.wellness.sub} />
        <Fee value="50" what={f.primary.what} sub={f.primary.sub} />
        <Fee value="75" what={f.specialist.what} sub={f.specialist.sub} />
        <Fee value="75" what={f.urgentCare.what} sub={f.urgentCare.sub} />
        <Fee value="150" what={`${f.emergency[0]} ${f.emergency[1]}`} />
      </div>
      <p className="mt-3 rounded-3xl bg-[#0b2a4a] px-5 py-4 text-base leading-relaxed text-white">
        <b className="text-[#ff8f74]">{f.howLabel}</b> {f.how}
      </p>
    </div>
  );
}

/* ─── 8. Member ID card ─────────────────────────────────────────────────────── */

function MemberCard({ t }: { t: DeckCopy }) {
  const sides: [string, number, string, string | undefined][] = [
    [`${IMG}/member-card-front.jpg`, 808, t.card.front, t.card.sample],
    [`${IMG}/member-card-back.jpg`, 812, t.card.back, undefined],
  ];
  return (
    <div>
      <Kicker>{t.card.kicker}</Kicker>
      <Title>{t.card.title}</Title>
      <div className="mt-6 space-y-6">
        {sides.map(([src, height, label, sample]) => (
          <div key={src} className="relative rounded-2xl bg-white shadow-[0_16px_40px_rgba(11,42,74,.18)]">
            <span className="absolute -top-3 left-4 z-[2] rounded-full bg-[#0b2a4a] px-3 py-1 text-[11px] font-bold tracking-[.14em] text-white">
              {label}
            </span>
            {sample && (
              <span className="absolute -top-3 right-4 z-[2] rounded-full bg-[#f2735a] px-3 py-1 text-[11px] font-extrabold tracking-[.14em] text-white">
                {sample}
              </span>
            )}
            <Image src={src} alt={label} width={1200} height={height} sizes="(min-width: 640px) 640px, 100vw" className="block h-auto w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── The member portal ─────────────────────────────────────────────────────── */

function Portal({ t, locale }: { t: DeckCopy; locale: DeckLocale }) {
  return (
    <div>
      <Kicker>{t.portal.kicker}</Kicker>
      <Title>{t.portal.title}</Title>
      <Lead>{t.portal.lead}</Lead>
      <div className="mt-6 flex justify-center">
        <PortalMockup locale={locale} />
      </div>
      <div className="mt-6 space-y-3">
        {t.portal.features.map((feature, i) => (
          <Card key={feature.title} className="flex items-start gap-3 p-4">
            <IconTile icon={PORTAL_ICONS[i] ?? "check"} />
            <div>
              <h3 className="text-lg font-bold leading-snug text-[#0b2a4a]">{feature.title}</h3>
              <p className="mt-0.5 text-[15px] leading-relaxed text-[#56657a]">{feature.body}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── 9. Next steps + Apply ─────────────────────────────────────────────────── */

const APPLY_CLASS =
  "mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#f2735a] px-6 py-5 text-xl font-extrabold text-white shadow-[0_14px_30px_rgba(242,115,90,.35)] transition hover:bg-[#e8644b]";

function NextSteps({ t, startDate, applyHref }: { t: DeckCopy; startDate: string; applyHref?: string }) {
  const apply = (
    <>
      {t.guide.apply}
      <Glyph name="arrowRight" className="h-6 w-6" />
    </>
  );
  return (
    <div>
      <Kicker>{t.next.kicker}</Kicker>
      <Title>{t.next.title}</Title>
      <ol className="mt-5 space-y-3">
        {t.guide.steps.map((step, i) => (
          <li key={step.n} className="rounded-3xl bg-[#0b2a4a] px-5 py-4 text-white">
            <p className="text-xs font-bold tracking-[.14em] text-[#ff8f74]">{step.n}</p>
            <h3 className="mt-1 text-xl font-bold">{step.title}</h3>
            <p className="mt-1 text-base leading-relaxed text-white/80">{step.body}</p>
            {i === t.guide.steps.length - 1 && (
              <span className="mt-3 inline-block rounded-xl bg-[#f2735a] px-4 py-1.5 text-lg font-extrabold">{startDate}</span>
            )}
          </li>
        ))}
      </ol>
      {applyHref ? (
        <a href={applyHref} className={APPLY_CLASS}>
          {apply}
        </a>
      ) : (
        <Link href="/health-alternative/apply/start" className={APPLY_CLASS}>
          {apply}
        </Link>
      )}
      <p className="mt-3 text-center text-sm text-[#56657a]">{t.guide.applyNote}</p>
      <p className="mt-6 text-xs leading-relaxed text-[#56657a]">{t.next.disclaimer}</p>
    </div>
  );
}

/** The screens in order, keyed, and where "Choose your plan" sits (the gate before "Apply now"). */
export function buildGuideSteps(data: GuideData): { steps: ReactNode[]; quoteStep: number } {
  const t = DECK_COPY[data.locale];
  const steps = [
    <Welcome key="welcome" t={t} />,
    <Agent key="agent" t={t} data={data} />,
    <What key="what" t={t} />,
    <Benefits key="benefits" t={t} />,
    <Benefits2 key="benefits2" t={t} />,
    <More key="more" t={t} />,
    <Fees key="fees" t={t} />,
    <MemberCard key="card" t={t} />,
    <Portal key="portal" t={t} locale={data.locale} />,
    <GuideQuote
      key="quote"
      locale={data.locale}
      admin={data.admin}
      agent={agentContact(data.agent)}
      scope={data.planScope ?? GUIDE_SCOPE}
    />,
    <NextSteps key="next" t={t} startDate={data.startDate} applyHref={data.applyHref} />,
  ];
  return { steps, quoteStep: steps.findIndex((step) => (step as { key?: string }).key === "quote") };
}
