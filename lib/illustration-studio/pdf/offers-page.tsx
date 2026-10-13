/** @jsxRuntime automatic */
/**
 * Page 2: "My Planned Life Insurance Offers" — the page that sells. Premium banner, then three
 * panels, one per jigsaw pillar: the death benefit (Die Too Soon), the cash value bar chart
 * (Live Too Long) and the living-benefit table (Become Ill). Geometry follows NLG's page, refit
 * from A4 to Letter.
 */

import { Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { fitFontSize } from "@/lib/mailing-labels/metrics";
import { winAnsiSafe } from "@/lib/presentation-scripts/format";
import { getCarrier, type CarrierTheme } from "../carriers";
import { formatCurrency, PREMIUM_MODE_LABEL } from "../format";
import type { CashValueBar, LivingBenefitRow, PresentationData } from "../types";
import { PageFooter } from "./cover-page";
import { LogoImage, SidePuzzlePiece, SlantedBox } from "./graphics";
import type { PillarKey } from "./puzzle";
import { FONT, FONT_BOLD, MAX_BENEFIT_ROWS, NEUTRAL, PAGE, type SummaryAssets } from "./theme";

const PANEL_LEFT = 92;
const PANEL_WIDTH = 484;
const TEXT_LEFT = 122 - PANEL_LEFT;
const PIECE_SIZE = 96;

const heading = { fontFamily: FONT_BOLD, fontSize: 17, color: NEUTRAL.ink };
const subline = { fontFamily: FONT, fontSize: 12, color: NEUTRAL.body, lineHeight: 1.1 };
const caption = { fontFamily: FONT, fontSize: 10, color: NEUTRAL.ink, textAlign: "center" as const };

function Title({ theme }: { theme: CarrierTheme }) {
  return (
    <View style={{ position: "absolute", top: 24, left: 0, width: PAGE.width, flexDirection: "row", justifyContent: "center" }}>
      <Text style={{ fontFamily: FONT, fontSize: 24, color: theme.primary }}>My Planned </Text>
      <Text style={{ fontFamily: FONT_BOLD, fontSize: 24, color: theme.primary }}>Life Insurance Offers</Text>
    </View>
  );
}

function PremiumBanner({ presentation, theme }: { presentation: PresentationData; theme: CarrierTheme }) {
  return (
    <View style={{ position: "absolute", top: 72, left: PANEL_LEFT, width: PANEL_WIDTH, height: 56, backgroundColor: NEUTRAL.banner, flexDirection: "row", alignItems: "center" }}>
      <Text style={{ fontFamily: FONT_BOLD, fontSize: 17, color: NEUTRAL.ink, marginLeft: 10, width: 284 }}>
        I will start my policy by paying:
      </Text>
      <SlantedBox width={200} height={56} slant={36} color={theme.dark}>
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 22, color: NEUTRAL.white }}>
          {formatCurrency(presentation.premium.amount, true)}
        </Text>
        <Text style={{ fontFamily: FONT_BOLD, fontSize: 17, color: NEUTRAL.white }}>{PREMIUM_MODE_LABEL[presentation.premium.mode]}</Text>
      </SlantedBox>
    </View>
  );
}

/** A tinted panel with its jigsaw piece hanging off the left edge. */
function Panel({ top, height, pillar, theme, children }: { top: number; height: number; pillar: PillarKey; theme: CarrierTheme; children: ReactNode }) {
  return (
    <>
      <View style={{ position: "absolute", top, left: PANEL_LEFT, width: PANEL_WIDTH, height, backgroundColor: theme.tints[pillar] }}>
        {children}
      </View>
      <View style={{ position: "absolute", top: top + (height - PIECE_SIZE) / 2, left: 44 }}>
        <SidePuzzlePiece pillar={pillar} size={PIECE_SIZE} color={theme.pillars[pillar]} onColor={theme.onPillars[pillar]} />
      </View>
    </>
  );
}

function PanelText({ title, lines, top }: { title: string; lines: string[]; top: number }) {
  return (
    <View style={{ position: "absolute", top, left: TEXT_LEFT, width: 170 }}>
      <Text style={heading}>{title}</Text>
      {lines.map((line) => (
        <Text key={line} style={subline}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function DeathBenefitPanel({ presentation, theme }: { presentation: PresentationData; theme: CarrierTheme }) {
  const amount = formatCurrency(presentation.deathBenefit);
  const size = fitFontSize([amount], 150, 28, 18, { bold: true });
  return (
    <Panel top={144} height={112} pillar="dieTooSoon" theme={theme}>
      <PanelText title="If I Die Tomorrow..." lines={["Those I have chosen", "will receive:"]} top={34} />
      <SlantedBox width={244} height={112} slant={92} color={theme.pillars.dieTooSoon} style={{ position: "absolute", top: 0, right: 0 }}>
        <Text style={{ fontFamily: FONT_BOLD, fontSize: size, color: theme.onPillars.dieTooSoon, marginLeft: 30 }}>{amount}</Text>
      </SlantedBox>
    </Panel>
  );
}

const CHART = { left: 206, width: 272, barWidth: 56, gap: 10, maxHeight: 92 } as const;

function CashValueChart({ bars, theme }: { bars: CashValueBar[]; theme: CarrierTheme }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const used = bars.length * CHART.barWidth + Math.max(0, bars.length - 1) * CHART.gap;
  const start = CHART.left + (CHART.width - used) / 2;
  const valueStyle = { fontFamily: FONT_BOLD, fontSize: 9.5, color: theme.onPillars.liveTooLong, textAlign: "center" as const };
  return (
    <>
      <Text style={{ ...caption, position: "absolute", top: 10, left: CHART.left, width: CHART.width }}>
        The projected Cash Value for my policy is:
      </Text>
      {bars.map((bar, i) => {
        const height = Math.max(18, (bar.value / max) * CHART.maxHeight);
        const left = start + i * (CHART.barWidth + CHART.gap);
        return (
          <View key={bar.age} style={{ position: "absolute", left, top: 26 + CHART.maxHeight - height, width: CHART.barWidth, height, backgroundColor: theme.pillars.liveTooLong, justifyContent: "flex-end", paddingBottom: 4 }}>
            <Text style={valueStyle}>{formatCurrency(bar.value)}</Text>
          </View>
        );
      })}
      <Text style={{ position: "absolute", top: 124, left: CHART.left - 80, width: 74, textAlign: "right", fontFamily: FONT_BOLD, fontSize: 10, color: NEUTRAL.ink }}>
        Attained Age:
      </Text>
      {bars.map((bar, i) => (
        <Text key={bar.age} style={{ position: "absolute", top: 124, left: start + i * (CHART.barWidth + CHART.gap), width: CHART.barWidth, textAlign: "center", fontFamily: FONT, fontSize: 10, color: NEUTRAL.ink }}>
          {bar.age}
        </Text>
      ))}
    </>
  );
}

function CashPanel({ presentation, theme }: { presentation: PresentationData; theme: CarrierTheme }) {
  return (
    <Panel top={262} height={144} pillar="liveTooLong" theme={theme}>
      <PanelText title="If I Need Cash..." lines={["I can take a loan or", "withdrawal from my", "policy's Cash Value¹."]} top={44} />
      {presentation.cashValueBars.length > 0 ? <CashValueChart bars={presentation.cashValueBars} theme={theme} /> : null}
    </Panel>
  );
}

function benefitValue(row: LivingBenefitRow): { bold: string; rest: string } {
  if (row.amount === null) return { bold: winAnsiSafe(row.text || "Included"), rest: "" };
  const bold = [row.prefix, formatCurrency(row.amount)].filter(Boolean).join(" ");
  return { bold, rest: row.suffix ? ` ${winAnsiSafe(row.suffix)}` : "" };
}

const TABLE = { left: 196, labelWidth: 156, valueWidth: 132, rowHeight: 18.5 } as const;

function BenefitTable({ rows, top }: { rows: LivingBenefitRow[]; top: number }) {
  const cell = { height: TABLE.rowHeight, justifyContent: "center" as const, borderBottomWidth: 1.5, borderColor: NEUTRAL.white };
  return (
    <View style={{ position: "absolute", top, left: TABLE.left }}>
      {rows.map((row) => {
        const value = benefitValue(row);
        const label = `${winAnsiSafe(row.label)}:`;
        // Measured as if all bold — a slight overestimate keeps every value on one line.
        const labelSize = fitFontSize([label], TABLE.labelWidth - 8, 10.5, 7.5);
        const valueSize = fitFontSize([`${value.bold}${value.rest}`], TABLE.valueWidth - 6, 10.5, 7.5, { bold: true });
        return (
          <View key={row.key} style={{ flexDirection: "row" }}>
            <View style={{ ...cell, width: TABLE.labelWidth, backgroundColor: NEUTRAL.tableLabel }}>
              <Text style={{ fontFamily: FONT, fontSize: labelSize, color: NEUTRAL.ink, textAlign: "center" }}>{label}</Text>
            </View>
            <View style={{ ...cell, width: TABLE.valueWidth, backgroundColor: NEUTRAL.white }}>
              <Text style={{ fontFamily: FONT, fontSize: valueSize, color: NEUTRAL.ink, textAlign: "center" }}>
                <Text style={{ fontFamily: FONT_BOLD }}>{value.bold}</Text>
                {value.rest}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * NLG's two-line heading when the amounts are projections at an age; without an age they are the
 * riders' terms, so the heading says so instead of claiming a projection.
 */
function benefitCaption(age: number | null, hasRows: boolean): string[] {
  if (!hasRows) return ["Living benefit riders are not shown in this illustration."];
  if (age === null) return ["The Accelerated Benefit Riders² included", "with my policy:"];
  return ["The projected Accelerated Benefit Rider² Values for my policy", `at age ${age} are:`];
}

function IllnessPanel({ presentation, theme }: { presentation: PresentationData; theme: CarrierTheme }) {
  const rows = presentation.livingBenefits.filter((row) => row.show).slice(0, MAX_BENEFIT_ROWS);
  const captionLines = benefitCaption(presentation.livingBenefitsAge, rows.length > 0);
  const height = 182;
  const captionHeight = captionLines.length * 12;
  const blockHeight = captionHeight + 8 + rows.length * TABLE.rowHeight;
  const blockTop = Math.max(10, (height - blockHeight) / 2);
  return (
    <Panel top={412} height={height} pillar="becomeIll" theme={theme}>
      <PanelText title="If I Become Ill..." lines={["I can access a portion", "of my Death Benefit."]} top={(height - 50) / 2} />
      <View style={{ position: "absolute", top: blockTop, left: TABLE.left - 10, width: TABLE.labelWidth + TABLE.valueWidth + 20 }}>
        {captionLines.map((line) => (
          <Text key={line} style={caption}>
            {line}
          </Text>
        ))}
      </View>
      {rows.length > 0 ? <BenefitTable rows={rows} top={blockTop + captionHeight + 8} /> : null}
    </Panel>
  );
}

function Footnotes({ presentation, theme }: { presentation: PresentationData; theme: CarrierTheme }) {
  const note = { fontFamily: FONT, fontSize: 7.5, color: NEUTRAL.body, lineHeight: 1.2, marginTop: 3 };
  const carrier = winAnsiSafe(presentation.carrierDisplayName || presentation.issuerName);
  return (
    <View style={{ position: "absolute", top: 606, left: 36, width: PAGE.width - 72 }}>
      <Text style={{ fontFamily: FONT_BOLD, fontSize: 9.5, color: NEUTRAL.ink, textAlign: "center" }}>
        The use of one benefit may reduce or eliminate other policy and rider benefits.
      </Text>
      <View style={{ height: 1, backgroundColor: theme.primary, marginTop: 5, marginBottom: 2 }} />
      <Text style={note}>
        Benefits and values shown above are not guaranteed. The assumptions on which they are based are subject to change by the insurer. Actual results may be more or less favorable. This presentation is not valid unless accompanied by the complete {carrier} illustration. Please see its ledger for guaranteed values and other important information.
      </Text>
      <Text style={note}>
        ¹ Policy loans and withdrawals reduce the policy's cash value and death benefit and may result in a taxable event. Surrender charges may reduce the policy's cash value in early years.
      </Text>
      <Text style={note}>
        ² Accelerated Benefit Riders may be subject to eligibility requirements and may not be available in all states. Benefits are paid at a discount before death, so the payment is less than the death benefit accelerated. "Up to" amounts are the most the illustration shows or the rider allows.
      </Text>
    </View>
  );
}

export function OffersPage({ presentation, assets }: { presentation: PresentationData; assets: SummaryAssets }) {
  const carrier = getCarrier(presentation.carrierKey);
  const { theme } = carrier;
  const footerLogo = carrier.logo && assets.logo ? (
    <LogoImage data={assets.logo} aspect={carrier.logo.aspect} maxWidth={116} maxHeight={28} />
  ) : null;
  return (
    <Page size="LETTER" style={{ backgroundColor: NEUTRAL.white }}>
      <Title theme={theme} />
      <PremiumBanner presentation={presentation} theme={theme} />
      <DeathBenefitPanel presentation={presentation} theme={theme} />
      <CashPanel presentation={presentation} theme={theme} />
      <IllnessPanel presentation={presentation} theme={theme} />
      <Footnotes presentation={presentation} theme={theme} />
      <PageFooter presentation={presentation} page={2} logo={footerLogo} />
    </Page>
  );
}
