/**
 * The shareable Impact quote: one vertical 1080×1920 PNG Isaac sends a client who wants time to
 * think. Their name and everyone covered, the plan and its monthly price, what's included (icons,
 * few words), the provider fees, the $79 fee, the start date and how to reach Isaac.
 *
 * Rendered server-side with next/og (Satori), like the IUL credentials card. Satori draws flexbox
 * and plain SVG only, so every box is `display: flex` and the styles are inline objects.
 */

import { ImageResponse } from "next/og";
import { Children, Fragment, isValidElement, type CSSProperties, type ReactNode } from "react";
import { AGENT, DECK_COPY, type DeckLocale } from "@/components/impact-presentation/copy";
import { GLYPHS, type GlyphName } from "@/components/impact-presentation/icons";
import { loadGoogleFont } from "@/lib/og/google-font";
import { loadInterFont } from "@/lib/og/inter-font";
import { CO_SHARE_MAX, money, perDay, RECOMMENDED_TIER, type ImpactTierKey } from "./plans";

export const QUOTE_IMAGE_W = 1080;
export const QUOTE_IMAGE_H = 1920;

const NAVY = "#0b2a4a";
const CORAL = "#f2735a";
const CORAL_2 = "#ff8f74";
const TEAL = "#2f97a0";
const MINT = "#d6f2ee";
const SAND = "#fbf6f2";
const MUTED = "#56657a";

export type QuoteImageInput = {
  locale: DeckLocale;
  /** "María López" */
  applicant: string;
  /** Everyone else on the plan, in form order. */
  members: string[];
  tier: ImpactTierKey;
  pra: number;
  monthly: number;
  /** Already formatted ("1 de enero de 2027"), or null to leave the line out. */
  startDate: string | null;
  /** Absolute origin for the logo and Isaac's photo (Satori fetches images by URL). */
  origin: string;
};

const WORDS = {
  es: {
    kicker: "SU COTIZACIÓN PERSONALIZADA",
    for: "Preparada para",
    covers: "Cubre a",
    planTitle: (name: string) => `Plan ${name}`,
    included: "Todo esto, incluido",
    benefits: [
      ["phonePlus", "Telemedicina 24/7", "$0 por consulta"],
      ["stethoscope", "Chequeo anual", "$0 + laboratorios"],
      ["doctor", "Su propio médico", "Red abierta"],
      ["pill", "Medicinas", "Genéricos a $0"],
      ["tooth", "Dental y visión", "Ahorros incluidos"],
      ["hospital", "Hospital y cirugías", "Emergencias incluidas"],
      ["baby", "Maternidad", "Hasta $150,000"],
      ["infinity", "Sin máximo de por vida", "Hasta $500,000 al año"],
    ],
    fees: "Copagos fijos por visita",
    feeItems: [
      ["$0", "Telemedicina"],
      ["$50", "Médico"],
      ["$75", "Especialista y urgent care"],
      ["$150", "Emergencia"],
    ],
    starts: "Su cobertura comienza el",
    agent: "Su asesor",
    disclaimer: "Impact Health Sharing es una organización sin fines de lucro 501(c)(3). No es un seguro.",
  },
  en: {
    kicker: "YOUR PERSONAL QUOTE",
    for: "Prepared for",
    covers: "Covers",
    planTitle: (name: string) => `${name} plan`,
    included: "All of this, included",
    benefits: [
      ["phonePlus", "24/7 telehealth", "$0 per visit"],
      ["stethoscope", "Annual checkup", "$0 + labs"],
      ["doctor", "Your own doctor", "No network limits"],
      ["pill", "Prescriptions", "$0 generics"],
      ["tooth", "Dental & vision", "Savings included"],
      ["hospital", "Hospital & surgery", "Emergencies included"],
      ["baby", "Maternity", "Up to $150,000"],
      ["infinity", "No lifetime maximum", "Up to $500,000 a year"],
    ],
    fees: "Flat fees per visit",
    feeItems: [
      ["$0", "Telehealth"],
      ["$50", "Doctor"],
      ["$75", "Specialist & urgent care"],
      ["$150", "Emergency"],
    ],
    starts: "Your coverage starts on",
    agent: "Your advisor",
    disclaimer: "Impact Health Sharing is a 501(c)(3) nonprofit. It is not insurance.",
  },
} as const;

/** Satori serializes SVG children to markup and can't take a React fragment: unwrap it. */
function svgChildren(node: ReactNode): ReactNode[] {
  if (isValidElement(node) && node.type === Fragment) {
    return Children.toArray((node.props as { children?: ReactNode }).children);
  }
  return [node];
}

function Icon({ name, size, color }: { name: GlyphName; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {svgChildren(GLYPHS[name])}
    </svg>
  );
}

function Row({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: "flex", ...style }}>{children}</div>;
}

function QuoteCard(input: QuoteImageInput) {
  const w = WORDS[input.locale];
  const q = DECK_COPY[input.locale].quote;
  const name = q.names[input.tier];
  const everyone = [input.applicant, ...input.members].filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: QUOTE_IMAGE_W, height: QUOTE_IMAGE_H, background: SAND, fontFamily: "Deck" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px 140px",
          background: `linear-gradient(135deg, ${NAVY} 0%, #123a63 65%, ${TEAL} 140%)`,
          color: "white",
        }}
      >
        <img src={`${input.origin}/images/impact/presentation/logo-white.png`} width={292} height={80} alt="" />
        <div style={{ display: "flex", marginTop: 48, fontSize: 26, fontWeight: 700, letterSpacing: 4, color: CORAL_2 }}>{w.kicker}</div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 30, color: "rgba(255,255,255,.75)" }}>{w.for}</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>{input.applicant}</div>
        {everyone.length > 1 && (
          <Row style={{ marginTop: 26, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,.75)", marginRight: 14 }}>{w.covers}</div>
            {everyone.map((person) => (
              <div
                key={person}
                style={{
                  display: "flex",
                  margin: "6px 10px 6px 0",
                  padding: "8px 20px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,.14)",
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {person}
              </div>
            ))}
          </Row>
        )}
      </div>

      {/* Plan */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          margin: "-104px 56px 0",
          padding: "40px 44px",
          borderRadius: 40,
          background: "white",
          boxShadow: "0 30px 60px rgba(11,42,74,.25)",
        }}
      >
        <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {input.tier === RECOMMENDED_TIER && (
              <div style={{ display: "flex", alignSelf: "flex-start", padding: "6px 16px", borderRadius: 999, background: CORAL, color: "white", fontSize: 20, fontWeight: 800 }}>
                {/* Poppins has no ★, and Satori would try to download a font for it. */}
                {q.recommended.replace("★", "").trim()}
              </div>
            )}
            <div style={{ display: "flex", marginTop: 12, fontSize: 56, fontWeight: 800, color: NAVY }}>
              {w.planTitle(name.name)}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: MUTED }}>{name.tagline}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <Row style={{ alignItems: "flex-end" }}>
              <div style={{ display: "flex", fontSize: 112, fontWeight: 800, color: CORAL, lineHeight: 1 }}>{money(input.monthly)}</div>
              <div style={{ display: "flex", fontSize: 32, color: MUTED, marginBottom: 12 }}>{q.perMonth}</div>
            </Row>
            <div style={{ display: "flex", fontSize: 24, color: MUTED }}>{q.perDay(money(perDay(input.monthly), true))}</div>
          </div>
        </Row>
        <Row style={{ marginTop: 26, paddingTop: 22, borderTop: "2px solid #e6e9ef", flexWrap: "wrap" }}>
          {[
            [q.pra, money(input.pra)],
            [q.then, "90/10"],
            [q.max, money(input.pra + CO_SHARE_MAX)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", margin: "0 10px 8px 0", padding: "8px 16px", borderRadius: 12, background: SAND, fontSize: 22, color: NAVY }}>
              {k}: <span style={{ fontWeight: 800, marginLeft: 6 }}>{v}</span>
            </div>
          ))}
        </Row>
      </div>

      {/* Benefits */}
      <div style={{ display: "flex", flexDirection: "column", padding: "34px 56px 0" }}>
        <Row style={{ alignItems: "center" }}>
          <div style={{ display: "flex", width: 44, height: 44, borderRadius: 999, background: TEAL, alignItems: "center", justifyContent: "center" }}>
            <Icon name="check" size={24} color="white" />
          </div>
          <div style={{ display: "flex", marginLeft: 14, fontSize: 36, fontWeight: 800, color: NAVY }}>{w.included}</div>
        </Row>
        <Row style={{ flexWrap: "wrap", marginTop: 22, justifyContent: "space-between" }}>
          {w.benefits.map(([icon, title, sub]) => (
            <div
              key={title}
              style={{ display: "flex", alignItems: "center", width: 474, marginBottom: 12, padding: "14px 20px", borderRadius: 24, background: "white", border: "1px solid #e6e9ef" }}
            >
              <div style={{ display: "flex", width: 68, height: 68, borderRadius: 18, background: MINT, alignItems: "center", justifyContent: "center" }}>
                <Icon name={icon as GlyphName} size={36} color={NAVY} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginLeft: 16 }}>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: NAVY }}>{title}</div>
                <div style={{ display: "flex", fontSize: 21, color: MUTED }}>{sub}</div>
              </div>
            </div>
          ))}
        </Row>
      </div>

      {/* Provider fees */}
      <div style={{ display: "flex", flexDirection: "column", margin: "6px 56px 0", padding: "20px 30px", borderRadius: 28, background: NAVY, color: "white" }}>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 2, color: CORAL_2 }}>{w.fees.toUpperCase()}</div>
        <Row style={{ marginTop: 12, justifyContent: "space-between" }}>
          {w.feeItems.map(([amount, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 230 }}>
              <div style={{ display: "flex", fontSize: 46, fontWeight: 800 }}>{amount}</div>
              <div style={{ display: "flex", fontSize: 19, color: "rgba(255,255,255,.75)", textAlign: "center" }}>{label}</div>
            </div>
          ))}
        </Row>
      </div>

      {/* Fee, start date, advisor */}
      <div style={{ display: "flex", flexDirection: "column", padding: "22px 56px 0", flexGrow: 1 }}>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: NAVY }}>{q.fee}</div>
        {input.startDate && (
          <div style={{ display: "flex", marginTop: 6, fontSize: 26, color: MUTED }}>
            {w.starts}
            <span style={{ marginLeft: 8, fontWeight: 800, color: CORAL }}>{input.startDate}</span>
          </div>
        )}
        <Row style={{ marginTop: "auto", marginBottom: 18, alignItems: "center", paddingTop: 18, borderTop: "2px dashed #e6e9ef" }}>
          <img src={`${input.origin}${AGENT.photo}`} width={96} height={96} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 20 }}>
            <div style={{ display: "flex", fontSize: 20, color: MUTED }}>{w.agent}</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: NAVY }}>{AGENT.name}</div>
            <div style={{ display: "flex", fontSize: 22, color: NAVY }}>
              WhatsApp {AGENT.whatsapp} · {AGENT.site}
            </div>
          </div>
        </Row>
        <div style={{ display: "flex", marginBottom: 30, fontSize: 18, color: MUTED }}>{w.disclaimer}</div>
      </div>
    </div>
  );
}

/** Poppins like the presentation; Inter if Google Fonts can't hand Poppins over. */
async function fonts() {
  try {
    const [regular, bold, heavy] = await Promise.all([
      loadGoogleFont("Poppins", 400),
      loadGoogleFont("Poppins", 700),
      loadGoogleFont("Poppins", 800),
    ]);
    return [
      { name: "Deck", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Deck", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Deck", data: heavy, weight: 800 as const, style: "normal" as const },
    ];
  } catch (error) {
    console.warn("[impact-quote-image] Poppins unavailable, using Inter:", error instanceof Error ? error.message : error);
    const [regular, bold] = await Promise.all([loadInterFont(400), loadInterFont(700)]);
    return [
      { name: "Deck", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Deck", data: bold, weight: 700 as const, style: "normal" as const },
    ];
  }
}

export async function renderQuoteImage(input: QuoteImageInput): Promise<ArrayBuffer> {
  const response = new ImageResponse(<QuoteCard {...input} />, {
    width: QUOTE_IMAGE_W,
    height: QUOTE_IMAGE_H,
    fonts: await fonts(),
  });
  return response.arrayBuffer();
}
