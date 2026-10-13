/** @jsxRuntime automatic */
/**
 * Page 1: NLG's photo cover, in the carrier's colors. Photo with a corner triangle holding the
 * logo, the product name over a dark band, the jigsaw circle, then the "prepared for / presented
 * by" cards and the issuer block.
 */

import { Image, Page, Polygon, Rect, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { winAnsiSafe } from "@/lib/presentation-scripts/format";
import { fitFontSize } from "@/lib/mailing-labels/metrics";
import { getCarrier } from "../carriers";
import { formatLongDate } from "../format";
import type { PresentationData } from "../types";
import { LogoImage, PuzzleCircle } from "./graphics";
import {
  BANK_DISCLOSURE,
  COVER_DISCLAIMERS,
  FONT,
  FONT_BOLD,
  MAX_PRESENTED_BY_LINES,
  NEUTRAL,
  PAGE,
  type SummaryAssets,
} from "./theme";

const PHOTO_HEIGHT = 455;
const TRIANGLE = 300;
const MARGIN = 24;
const BAND = { top: 398, height: 28, width: 450 } as const;
const NAME_TIER = { top: 344, height: BAND.top - 344 } as const;

/**
 * The photo dissolves into the page, as NLG's does, so the cards sit on white.
 *
 * Not an SVG gradient: stop-opacity gradients render differently (or not at all) across PDF
 * viewers, while constant-alpha fills look the same everywhere. Not side-by-side strips either —
 * their overlapping edges show as faint lines. Instead, nested white layers that all run to the
 * bottom of the photo, each with the opacity that makes the STACK follow an ease-in curve:
 * stacked alpha after layer j is 1 − Π(1 − aᵢ), so aⱼ = 1 − (1 − Tⱼ) / (1 − Tⱼ₋₁).
 */
const FADE = { top: 360, steps: 24 } as const;

function fadeLayerOpacities(steps: number): number[] {
  const target = (j: number) => Math.pow((j + 1) / steps, 1.6);
  return Array.from({ length: steps }, (_, j) => {
    const before = j === 0 ? 0 : target(j - 1);
    return before >= 1 ? 0 : 1 - (1 - target(j)) / (1 - before);
  });
}

function CoverFade() {
  const height = PHOTO_HEIGHT - FADE.top;
  const step = height / FADE.steps;
  return (
    <Svg viewBox={`0 0 ${PAGE.width} ${height}`} style={{ position: "absolute", top: FADE.top, left: 0, width: PAGE.width, height }}>
      {fadeLayerOpacities(FADE.steps).map((opacity, j) => (
        <Rect key={j} x="0" y={j * step} width={PAGE.width} height={height - j * step} fill={NEUTRAL.white} fillOpacity={opacity} />
      ))}
    </Svg>
  );
}

function CoverPhoto({ photo, fallback }: { photo: Buffer | null; fallback: string }) {
  return (
    <>
      {photo ? (
        <Image
          src={{ data: photo, format: "jpg" }}
          style={{ position: "absolute", top: 0, left: 0, width: PAGE.width, height: PHOTO_HEIGHT, objectFit: "cover" }}
        />
      ) : (
        <View style={{ position: "absolute", top: 0, left: 0, width: PAGE.width, height: PHOTO_HEIGHT, backgroundColor: fallback }} />
      )}
      <CoverFade />
    </>
  );
}

function CornerLogo({ presentation, assets }: { presentation: PresentationData; assets: SummaryAssets }) {
  const carrier = getCarrier(presentation.carrierKey);
  const logo = carrier.coverLogo ?? carrier.logo;
  const data = carrier.coverLogo ? assets.coverLogo : assets.logo;
  return (
    <>
      <Svg viewBox={`0 0 ${TRIANGLE} ${TRIANGLE}`} style={{ position: "absolute", top: 0, left: 0, width: TRIANGLE, height: TRIANGLE }}>
        <Polygon points={`0,0 ${TRIANGLE},0 0,${TRIANGLE}`} fill={carrier.theme.primary} />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: MARGIN,
          left: MARGIN,
          padding: logo?.hasBackground ? 0 : 10,
          backgroundColor: logo?.hasBackground ? undefined : NEUTRAL.white,
          borderRadius: 6,
        }}
      >
        {logo && data ? (
          <LogoImage data={data} aspect={logo.aspect} maxWidth={logo.hasBackground ? 180 : 165} maxHeight={logo.hasBackground ? 80 : 62} />
        ) : (
          <Text style={{ fontFamily: FONT_BOLD, fontSize: 18, color: carrier.theme.primary }}>
            {winAnsiSafe(presentation.carrierDisplayName || presentation.issuerName)}
          </Text>
        )}
      </View>
    </>
  );
}

/**
 * The product name sits on a near-opaque white tier above the dark band, so it reads over any
 * photo (NLG gets the same effect from a translucent white wedge).
 */
function ProductBand({ presentation }: { presentation: PresentationData }) {
  const { theme } = getCarrier(presentation.carrierKey);
  const name = winAnsiSafe(presentation.productName || presentation.carrierDisplayName);
  const nameSize = fitFontSize([name], BAND.width - MARGIN * 2, 30, 16, { bold: true });
  return (
    <>
      <Svg
        viewBox={`0 0 ${BAND.width} ${NAME_TIER.height}`}
        style={{ position: "absolute", top: NAME_TIER.top, left: 0, width: BAND.width, height: NAME_TIER.height }}
      >
        <Rect x="0" y="0" width={BAND.width} height={NAME_TIER.height} fill={NEUTRAL.white} fillOpacity={0.9} />
      </Svg>
      <View
        style={{ position: "absolute", top: NAME_TIER.top, left: MARGIN, width: BAND.width - MARGIN * 2, height: NAME_TIER.height, justifyContent: "center" }}
      >
        <Text style={{ fontFamily: FONT_BOLD, fontSize: nameSize, color: NEUTRAL.ink }}>{name}</Text>
      </View>
      <View
        style={{ position: "absolute", top: BAND.top, left: 0, width: BAND.width, height: BAND.height, backgroundColor: theme.dark, justifyContent: "center", paddingLeft: MARGIN }}
      >
        <Text style={{ fontFamily: FONT, fontSize: 14.5, color: NEUTRAL.white }}>
          {winAnsiSafe(presentation.productLine.toUpperCase())}
        </Text>
      </View>
      <View style={{ position: "absolute", top: 334, left: 452 }}>
        <PuzzleCircle size={134} colors={theme.pillars} onColors={theme.onPillars} />
      </View>
    </>
  );
}

function InfoCard({ left, width, children }: { left: number; width: number; children: ReactNode }) {
  return (
    <View
      style={{
        position: "absolute",
        top: 480,
        left,
        width,
        height: 84,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: NEUTRAL.white,
        borderWidth: 0.75,
        borderColor: NEUTRAL.hairline,
        borderRadius: 3,
      }}
    >
      {children}
    </View>
  );
}

function PreparedCards({ presentation }: { presentation: PresentationData }) {
  const heading = { fontFamily: FONT_BOLD, fontSize: 12.5, color: NEUTRAL.ink, marginBottom: 3 };
  const line = { fontFamily: FONT, fontSize: 10.5, color: NEUTRAL.body, marginTop: 2 };
  const bold = { ...line, fontFamily: FONT_BOLD };
  return (
    <>
      <InfoCard left={MARGIN + 4} width={262}>
        <Text style={heading}>Life Insurance Illustration</Text>
        <Text style={line}>Prepared on {formatLongDate(presentation.preparedDate)}</Text>
        {presentation.clientName ? <Text style={bold}>For {winAnsiSafe(presentation.clientName)}</Text> : null}
      </InfoCard>
      <InfoCard left={312} width={272}>
        <Text style={heading}>Presented By</Text>
        {presentation.presentedBy.name ? <Text style={bold}>{winAnsiSafe(presentation.presentedBy.name)}</Text> : null}
        {presentation.presentedBy.lines.slice(0, MAX_PRESENTED_BY_LINES).map((text, i) => (
          <Text key={i} style={line}>
            {winAnsiSafe(text)}
          </Text>
        ))}
      </InfoCard>
    </>
  );
}

function underwritingSentence(p: PresentationData): string {
  const product = p.productName || "This policy";
  const form = p.policyForm ? `, Form Number ${p.policyForm},` : "";
  const location = p.issuerLocation ? `, ${p.issuerLocation}` : "";
  return `${product}${form} and any applicable riders are underwritten by ${p.issuerName}${location}. Riders are optional and may require additional premium. Guarantees are dependent upon the claims-paying ability of the issuing company.`;
}

function IssuerBlock({ presentation }: { presentation: PresentationData }) {
  const { theme } = getCarrier(presentation.carrierKey);
  const paragraph = { fontFamily: FONT, fontSize: 8.5, color: NEUTRAL.body, lineHeight: 1.25, marginTop: 5 };
  const width = PAGE.width - MARGIN * 2;
  return (
    <View style={{ position: "absolute", top: 572, left: MARGIN, width }}>
      <Text style={{ fontFamily: FONT, fontSize: 10, color: NEUTRAL.muted }}>Product issued by</Text>
      <Text style={{ fontFamily: FONT_BOLD, fontSize: 12, color: NEUTRAL.ink, marginTop: 2 }}>{winAnsiSafe(presentation.issuerName)}</Text>
      <View style={{ height: 1, backgroundColor: theme.primary, marginTop: 4, marginBottom: 1 }} />
      <Text style={paragraph}>{winAnsiSafe(underwritingSentence(presentation))}</Text>
      {COVER_DISCLAIMERS.map((text) => (
        <Text key={text} style={paragraph}>
          {text}
        </Text>
      ))}
      <View style={{ marginTop: 10, borderWidth: 0.75, borderColor: NEUTRAL.ink }}>
        {BANK_DISCLOSURE.map((text, i) => (
          <Text
            key={text}
            style={{ fontFamily: FONT, fontSize: 8.5, color: NEUTRAL.muted, textAlign: "center", paddingVertical: 4, borderTopWidth: i === 0 ? 0 : 0.75, borderColor: NEUTRAL.ink }}
          >
            {text}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function PageFooter({ presentation, page, logo }: { presentation: PresentationData; page: number; logo?: ReactNode }) {
  const location = presentation.issuerLocation ? `, ${presentation.issuerLocation}` : "";
  return (
    <View style={{ position: "absolute", left: MARGIN, right: MARGIN, bottom: 18, borderTopWidth: 0.5, borderColor: NEUTRAL.hairline, paddingTop: 5, flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: 120 }}>{logo}</View>
      <Text style={{ flex: 1, textAlign: "center", fontFamily: FONT_BOLD, fontSize: 8.5, color: NEUTRAL.ink }}>
        {winAnsiSafe(`${presentation.issuerName}${location}`)}
      </Text>
      <Text style={{ width: 120, textAlign: "right", fontFamily: FONT, fontSize: 8, color: NEUTRAL.muted }}>Page {page} of 2</Text>
    </View>
  );
}

export function CoverPage({ presentation, assets }: { presentation: PresentationData; assets: SummaryAssets }) {
  const { theme } = getCarrier(presentation.carrierKey);
  return (
    <Page size="LETTER" style={{ backgroundColor: NEUTRAL.white }}>
      <CoverPhoto photo={assets.coverPhoto} fallback={theme.tints.dieTooSoon} />
      <CornerLogo presentation={presentation} assets={assets} />
      <ProductBand presentation={presentation} />
      <PreparedCards presentation={presentation} />
      <IssuerBlock presentation={presentation} />
      <PageFooter presentation={presentation} page={1} />
    </Page>
  );
}
