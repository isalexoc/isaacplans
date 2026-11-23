/**
 * The shareable Impact quote: one vertical 1080×1920 PNG Isaac sends a client who wants time to
 * think. Their name and everyone covered, the plan and its monthly price, what's included (icons,
 * few words), the provider fees, the $79 fee, the start date and how to reach the agent (Isaac, or
 * the agent who owns the application: `agent`).
 *
 * Rendered server-side with next/og (Satori), like the IUL credentials card. Satori draws flexbox
 * and plain SVG only, so every box is `display: flex` and the styles are inline objects.
 *
 * Two callers: the intake's panel (names from the application) and Isaac's box on /impact (names
 * he types, plus `household` and `startLabel: "earliest"`). Many or long names switch to a tighter
 * layout, and the advisor and the not-insurance line sit in a footer nothing above can push off.
 */

import { ImageResponse } from "next/og";
import { Children, Fragment, isValidElement, type CSSProperties, type ReactNode } from "react";
import { DECK_COPY, type DeckLocale } from "@/components/impact-presentation/copy";
import { formatWhatsapp, profileInitials, serverFetchablePhotoUrl, type AgentPublicProfile } from "@/lib/tenancy/profile";
import { GLYPHS, type GlyphName } from "@/components/impact-presentation/icons";
import { loadGoogleFont } from "@/lib/og/google-font";
import { loadInterFont } from "@/lib/og/inter-font";
import { CO_SHARE_MAX, money, perDay, RECOMMENDED_TIER, type HouseholdSize, type ImpactTierKey } from "./plans";

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
  /**
   * "starts" (the default): the start date the application chose. "earliest": none chosen yet, so
   * the earliest 1st Impact allows today, worded "can start as soon as".
   */
  startLabel?: "starts" | "earliest";
  /**
   * The household the quote priced, when the names typed may not be everyone: one line under the
   * names says how many people the price is for when fewer names than people were given, or, for
   * the Senior Program, that the price is per person. Absent: no line (the intake's image).
   */
  household?: { asked: HouseholdSize; senior: boolean } | null;
  /** Absolute origin for the logo, and for a photo that ships with the app (Satori fetches by URL). */
  origin: string;
  /** The advisor in the footer: Isaac's profile, or the agent who owns the application. */
  agent: AgentPublicProfile;
};

const WORDS = {
  es: {
    kicker: "SU COTIZACIÓN PERSONALIZADA",
    for: "Preparada para",
    covers: "Cubre a",
    household2: "Hogar de 2 personas",
    household3: "Hogar de 3 personas o más",
    seniorPerPerson: "Programa Senior: precio por persona",
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
    earliest: "Su cobertura puede comenzar desde el",
    agent: "Su asesor",
    disclaimer: "Impact Health Sharing es una organización sin fines de lucro 501(c)(3). No es un seguro.",
  },
  en: {
    kicker: "YOUR PERSONAL QUOTE",
    for: "Prepared for",
    covers: "Covers",
    household2: "Household of 2",
    household3: "Household of 3 or more",
    seniorPerPerson: "Senior Program: price per person",
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
    earliest: "Coverage can start as soon as",
    agent: "Your advisor",
    disclaimer: "Impact Health Sharing is a 501(c)(3) nonprofit. It is not insurance.",
  },
} as const;

/** "María López" → "maria-lopez", for the PNG's file name ("cliente" when nothing is left). */
export function quoteImageFileSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "cliente"
  );
}

/** The line under the names, or null: Senior Program pricing, else a household bigger than the names. */
function householdLine(input: QuoteImageInput, names: number): string | null {
  const household = input.household;
  if (!household) return null;
  const w = WORDS[input.locale];
  if (household.senior) return w.seniorPerPerson;
  if (names >= household.asked) return null;
  return household.asked === 2 ? w.household2 : w.household3;
}

/* ─── Fitting the names ─────────────────────────────────────────────────────── */

/** The sizes that give way when the names need room. */
const REGULAR = {
  kickerTop: 48,
  applicant: 64,
  chip: 24,
  chipPadY: 8,
  chipPadX: 20,
  chipGapY: 6,
  chipGapX: 10,
  line: 26,
  lineTop: 18,
  benefitsTop: 34,
  gridTop: 22,
  cardPad: "14px 20px",
  cardGap: 12,
  tile: 68,
  icon: 36,
  cardTitle: 26,
  cardSub: 21,
  feesPad: "20px 30px",
  feeAmount: 46,
  textTop: 22,
};
type Sizes = typeof REGULAR;

const TIGHT: Sizes = {
  kickerTop: 30,
  applicant: 54,
  chip: 21,
  chipPadY: 6,
  chipPadX: 16,
  chipGapY: 4,
  chipGapX: 8,
  line: 23,
  lineTop: 12,
  benefitsTop: 22,
  gridTop: 14,
  cardPad: "8px 18px",
  cardGap: 8,
  tile: 56,
  icon: 30,
  cardTitle: 24,
  cardSub: 19,
  feesPad: "14px 30px",
  feeAmount: 42,
  textTop: 16,
};

/** Regular, with the benefit cards 12 px shorter: a name on two lines, or a second row of chips. */
const COMPACT: Sizes = { ...REGULAR, cardPad: "8px 20px" };

/**
 * The sizes to try, each with the height the names may take at them. Measured on rendered images:
 * the names get ~215 px at the regular sizes (the intake's usual image, the applicant on one line
 * and one row of chips, uses ~160), 48 more with the compact cards and ~375 with the tight sizes;
 * each budget keeps 10 px of that spare.
 */
const STEPS: { s: Sizes; budget: number }[] = [
  { s: REGULAR, budget: 205 },
  { s: COMPACT, budget: 253 },
  { s: TIGHT, budget: 365 },
];

/** The header's text width: the card minus its side padding. */
const NAMES_W = QUOTE_IMAGE_W - 2 * 64;

/**
 * Poppins ExtraBold's advance widths in hundredths of an em, A–Z then a–z, measured from the font
 * Google serves. Capitals run wider than lower case (a name typed in capitals wraps sooner), and
 * Bold is a little narrower, so the chips come out on the safe side.
 */
const UPPER_EM = [76, 67, 76, 73, 55, 56, 76, 74, 31, 58, 73, 49, 94, 77, 79, 64, 79, 66, 62, 60, 71, 75, 108, 74, 70, 61];
const LOWER_EM = [68, 68, 61, 68, 62, 37, 68, 69, 31, 31, 65, 31, 107, 69, 64, 68, 68, 45, 57, 42, 69, 65, 89, 63, 66, 51];

/** One character's width in em: an accented letter as its base letter, a space, else a wide guess. */
function charEm(ch: string): number {
  const code = ch.normalize("NFD").charCodeAt(0);
  if (code >= 65 && code <= 90) return UPPER_EM[code - 65] / 100;
  if (code >= 97 && code <= 122) return LOWER_EM[code - 97] / 100;
  return ch === " " ? 0.21 : 0.75;
}

/** A text's width at `size` px, a hair wide on purpose (kerning only ever narrows it). */
function textWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) em += charEm(ch);
  return em * size * 1.02;
}

/** The lines a text takes in `width` px, breaking between words as Satori does. */
function lineCount(text: string, size: number, width: number): number {
  const space = textWidth(" ", size);
  let lines = 1;
  let x = 0;
  for (const word of text.split(" ")) {
    if (!word) continue;
    const w = textWidth(word, size);
    if (x > 0 && x + space + w > width) {
      lines += 1;
      x = w;
    } else {
      x += (x > 0 ? space : 0) + w;
    }
  }
  return lines;
}

/** The "Covers" chips' height: they wrap to new rows, and a chip wider than a row wraps its own text. */
function chipsHeight(s: Sizes, label: string, chips: string[]): number {
  const line = s.chip * 1.5;
  const frame = 2 * (s.chipPadY + s.chipGapY);
  let above = 0;
  let row = line + frame;
  let x = textWidth(label, s.chip) + 14;
  for (const person of chips) {
    const lines = lineCount(person, s.chip, NAMES_W - s.chipGapX - 2 * s.chipPadX);
    const width = Math.min(textWidth(person, s.chip) + 2 * s.chipPadX, NAMES_W) + s.chipGapX;
    if (x > 0 && x + width > NAMES_W) {
      above += row;
      row = 0;
      x = 0;
    }
    row = Math.max(row, lines * line + frame);
    x += width;
  }
  return above + row;
}

/** The height of the applicant's name, the chips and the household line at sizes `s`. */
function namesHeight(s: Sizes, applicant: string, label: string, chips: string[], withLine: boolean): number {
  return (
    lineCount(applicant, s.applicant, NAMES_W) * s.applicant * 1.1 +
    (chips.length ? 26 + chipsHeight(s, label, chips) : 0) +
    (withLine ? s.lineTop + s.line * 1.5 : 0)
  );
}

/**
 * The sizes for these names, and the chips to draw: everyone at the first sizes they fit, else at
 * the tight ones with the applicant's chip down to their first name (the whole name is right
 * above it) and names hidden from the end behind "+N" until the rest fits, so the price, the fees
 * and the start date stay on the image.
 */
function fitNames(applicant: string, label: string, everyone: string[], withLine: boolean): { s: Sizes; chips: string[] } {
  const chips = everyone.length > 1 ? everyone : [];
  const height = (s: Sizes, shown: string[]) => namesHeight(s, applicant, label, shown, withLine);
  const step = STEPS.find(({ s, budget }) => height(s, chips) <= budget);
  if (step) return { s: step.s, chips };
  // At worst one chip and "+N" stay (an applicant's name that runs many lines); the footer is
  // pinned, so the not-insurance line shows whatever the names.
  const { s, budget } = STEPS[STEPS.length - 1];
  const short = chips[0] === applicant ? [applicant.split(" ")[0], ...chips.slice(1)] : chips;
  let shown = short;
  for (let hidden = 1; hidden < short.length && height(s, shown) > budget; hidden++) {
    shown = [...short.slice(0, short.length - hidden), `+${hidden}`];
  }
  return { s, chips: shown };
}

/* ─── Drawing ───────────────────────────────────────────────────────────────── */

/** Satori serializes SVG children to markup and can't take a React fragment: unwrap it. */
function svgChildren(node: ReactNode): ReactNode[] {
  if (isValidElement(node) && node.type === Fragment) {
    return Children.toArray((node.props as { children?: ReactNode }).children);
  }
  return Children.toArray(node);
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
  const agent = input.agent;
  // A photo that ships with the app is fetched from this request's origin, as it always was. An
  // agent's outside photo URL is never fetched by the server: initials instead.
  const photo = serverFetchablePhotoUrl(agent, input.origin);
  const whatsapp = formatWhatsapp(agent.whatsappE164);
  const contact = [whatsapp ? `WhatsApp ${whatsapp}` : null, agent.siteLabel].filter(Boolean).join(" · ");
  const q = DECK_COPY[input.locale].quote;
  const name = q.names[input.tier];
  const everyone = [input.applicant, ...input.members].filter(Boolean);
  const line = householdLine(input, everyone.length);
  const { s, chips } = fitNames(input.applicant, w.covers, everyone, Boolean(line));
  return (
    <div style={{ display: "flex", flexDirection: "column", width: QUOTE_IMAGE_W, height: QUOTE_IMAGE_H, background: SAND, fontFamily: "Deck" }}>
      {/* Everything above the footer. Clipped, so no number of names can push the footer off. */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexShrink: 1, flexBasis: 0, overflow: "hidden" }}>
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
          <div style={{ display: "flex", marginTop: s.kickerTop, fontSize: 26, fontWeight: 700, letterSpacing: 4, color: CORAL_2 }}>{w.kicker}</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 30, color: "rgba(255,255,255,.75)" }}>{w.for}</div>
          <div style={{ display: "flex", fontSize: s.applicant, fontWeight: 800, lineHeight: 1.1 }}>{input.applicant}</div>
          {chips.length > 0 && (
            <Row style={{ marginTop: 26, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: s.chip, color: "rgba(255,255,255,.75)", marginRight: 14 }}>{w.covers}</div>
              {chips.map((person, i) => (
                <div
                  key={`${i}-${person}`}
                  style={{
                    display: "flex",
                    margin: `${s.chipGapY}px ${s.chipGapX}px ${s.chipGapY}px 0`,
                    padding: `${s.chipPadY}px ${s.chipPadX}px`,
                    borderRadius: 999,
                    background: "rgba(255,255,255,.14)",
                    fontSize: s.chip,
                    fontWeight: 600,
                  }}
                >
                  {person}
                </div>
              ))}
            </Row>
          )}
          {line && (
            <div style={{ display: "flex", marginTop: s.lineTop, fontSize: s.line, fontWeight: 700, color: CORAL_2 }}>{line}</div>
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
        <div style={{ display: "flex", flexDirection: "column", padding: `${s.benefitsTop}px 56px 0` }}>
          <Row style={{ alignItems: "center" }}>
            <div style={{ display: "flex", width: 44, height: 44, borderRadius: 999, background: TEAL, alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={24} color="white" />
            </div>
            <div style={{ display: "flex", marginLeft: 14, fontSize: 36, fontWeight: 800, color: NAVY }}>{w.included}</div>
          </Row>
          <Row style={{ flexWrap: "wrap", marginTop: s.gridTop, justifyContent: "space-between" }}>
            {w.benefits.map(([icon, title, sub]) => (
              <div
                key={title}
                style={{ display: "flex", alignItems: "center", width: 474, marginBottom: s.cardGap, padding: s.cardPad, borderRadius: 24, background: "white", border: "1px solid #e6e9ef" }}
              >
                <div style={{ display: "flex", width: s.tile, height: s.tile, borderRadius: 18, background: MINT, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={icon as GlyphName} size={s.icon} color={NAVY} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginLeft: 16 }}>
                  <div style={{ display: "flex", fontSize: s.cardTitle, fontWeight: 700, color: NAVY }}>{title}</div>
                  <div style={{ display: "flex", fontSize: s.cardSub, color: MUTED }}>{sub}</div>
                </div>
              </div>
            ))}
          </Row>
        </div>

        {/* Provider fees */}
        <div style={{ display: "flex", flexDirection: "column", margin: "6px 56px 0", padding: s.feesPad, borderRadius: 28, background: NAVY, color: "white" }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 2, color: CORAL_2 }}>{w.fees.toUpperCase()}</div>
          <Row style={{ marginTop: 12, justifyContent: "space-between" }}>
            {w.feeItems.map(([amount, label]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 230 }}>
                <div style={{ display: "flex", fontSize: s.feeAmount, fontWeight: 800 }}>{amount}</div>
                <div style={{ display: "flex", fontSize: 19, color: "rgba(255,255,255,.75)", textAlign: "center" }}>{label}</div>
              </div>
            ))}
          </Row>
        </div>

        {/* Fee, start date */}
        <div style={{ display: "flex", flexDirection: "column", padding: `${s.textTop}px 56px 0` }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: NAVY }}>{q.fee}</div>
          {input.startDate && (
            <div style={{ display: "flex", marginTop: 6, fontSize: 26, color: MUTED }}>
              {input.startLabel === "earliest" ? w.earliest : w.starts}
              <span style={{ marginLeft: 8, fontWeight: 800, color: CORAL }}>{input.startDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: the advisor and the not-insurance line, always on the image. */}
      <div style={{ display: "flex", flexDirection: "column", padding: "0 56px" }}>
        <Row style={{ marginBottom: 18, alignItems: "center", paddingTop: 18, borderTop: "2px dashed #e6e9ef" }}>
          {photo ? (
            <img src={photo} width={96} height={96} style={{ borderRadius: 999, objectFit: "cover" }} alt="" />
          ) : (
            <div style={{ display: "flex", width: 96, height: 96, borderRadius: 999, background: NAVY, color: "white", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800 }}>
              {profileInitials(agent)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 20 }}>
            <div style={{ display: "flex", fontSize: 20, color: MUTED }}>{w.agent}</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: NAVY }}>{agent.displayName}</div>
            {whatsapp && agent.siteLabel ? (
              <div style={{ display: "flex", fontSize: 22, color: NAVY }}>
                WhatsApp {whatsapp} · {agent.siteLabel}
              </div>
            ) : contact ? (
              <div style={{ display: "flex", fontSize: 22, color: NAVY }}>{contact}</div>
            ) : null}
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
