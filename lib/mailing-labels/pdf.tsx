import "server-only";
import {
  renderToBuffer,
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  Svg,
  Path,
} from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import {
  WHATSAPP_GLYPH_PATH,
  WHATSAPP_GLYPH_VIEWBOX,
  WHATSAPP_GREEN,
} from "@/lib/whatsapp-mark";
import { formatAddressBlock, resolveTagline } from "./format";
import { shippingLayout } from "./layout";
import { fitFontSize } from "./metrics";
import {
  clampStartOffset,
  isStickerPreset,
  stickerSlotOrigin,
  type LabelPreset,
  type ShippingPreset,
  type StickerPreset,
} from "./presets";
import {
  EYEBROW_TEXT,
  LABEL_TYPE_SCALE,
  SENIOR_LIFE,
  SENIOR_LIFE_LOGO_PRINT,
  SHIPPING_TYPE_SCALE,
  WHATSAPP_MARK_GAP,
  whatsappMarkSize,
} from "./theme";
import type {
  LabelAgentContact,
  LabelSheetOptions,
  MailingLabelRecord,
  SenderAddress,
} from "./types";

/**
 * PDF renderers for both label modes. PDF rather than a rasterized PNG (which is what the Sale
 * Sticker and Leave-Behind tools use) because print alignment is the whole point here: a label
 * has to land exactly 0.5" from the top of the Avery sheet or every sticker on the page is wasted.
 *
 * Fonts are the built-in Helvetica — no Font.register, so no network fetch and nothing to fail at
 * render time. It's also the most legible face for postal addresses.
 */

const FONT = "Helvetica";

/**
 * Never hyphenate. Left to itself @react-pdf broke a street across lines as "BOULE-VARD", which
 * is both ugly and, on a mailing label, genuinely confusing. Anything too wide now wraps at a
 * space instead — and ./metrics.ts usually keeps it from wrapping at all.
 */
Font.registerHyphenationCallback((word) => [word]);

/**
 * The gold Senior Life logo, fetched once per lambda instance. Cleared on failure so a transient
 * Cloudinary blip doesn't disable branding for the life of the instance; every caller treats null
 * as "render the text-only version".
 */
let logoPromise: Promise<Buffer | null> | null = null;

export function loadSeniorLifeLogo(): Promise<Buffer | null> {
  if (!logoPromise) {
    logoPromise = (async () => {
      try {
        const res = await fetch(SENIOR_LIFE_LOGO_PRINT);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      } catch (error) {
        console.warn("[mailing-labels] Senior Life logo unavailable:", error);
        logoPromise = null;
        return null;
      }
    })();
  }
  return logoPromise;
}

function LogoImage({ data, height }: { data: Buffer; height: number }) {
  // Constrained by height so the strip contains it whatever the source aspect ratio is.
  return <Image src={{ data, format: "png" }} style={{ height, objectFit: "contain" }} />;
}

/**
 * WhatsApp number with its brand mark. Drawn as a vector path rather than a fetched image: it
 * prints around 9 pt tall, where a raster badge would smear, and it costs no network round trip.
 *
 * Exported because the letter (./letter-pdf.tsx) signs off with the same pairing.
 */
export function WhatsAppLine({
  number,
  fontSize,
  color = SENIOR_LIFE.ink,
  marginTop = 0,
}: {
  number: string;
  fontSize: number;
  color?: string;
  marginTop?: number;
}) {
  const mark = whatsappMarkSize(fontSize);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop }}>
      <Svg viewBox={WHATSAPP_GLYPH_VIEWBOX} style={{ width: mark, height: mark }}>
        <Path d={WHATSAPP_GLYPH_PATH} fill={WHATSAPP_GREEN} />
      </Svg>
      <Text style={{ fontSize, color, marginLeft: WHATSAPP_MARK_GAP }}>{number}</Text>
    </View>
  );
}

// ─── Avery sticker sheet ──────────────────────────────────────────────────────

function StickerLabel({
  record,
  preset,
  options,
  agent,
  logo,
}: {
  record: MailingLabelRecord;
  preset: StickerPreset;
  options: LabelSheetOptions;
  agent: LabelAgentContact | null;
  logo: Buffer | null;
}) {
  const scale = LABEL_TYPE_SCALE[preset.variant];
  const block = formatAddressBlock(record);
  const branding = preset.supportsBranding;
  const showLogo = branding && options.showLogo && Boolean(logo);
  const showHeader = showLogo && scale.headerHeight > 0;
  const isFolder = preset.variant === "folder";

  const tagline = branding ? resolveTagline(record.language, options.taglines) : "";
  const agentLine =
    branding && options.showAgentContact && agent
      ? [agent.name, agent.phone].filter(Boolean).join("  ·  ")
      : "";
  const whatsapp = branding && options.showWhatsapp ? (agent?.whatsapp ?? "") : "";
  const showFooter = Boolean(tagline || agentLine || whatsapp) && scale.footerSize > 0;

  // Fit the type to this particular address instead of sizing every label for the worst case.
  const textWidth = preset.labelWidth - scale.padX * 2;
  const addressLines = [block.line1, block.line2, block.cityStateZip].filter(
    (l): l is string => Boolean(l)
  );
  const nameSize = fitFontSize([block.nameLine], textWidth, scale.nameSize, scale.nameSizeMin, {
    bold: true,
  });
  const addressSize = fitFontSize(
    addressLines,
    textWidth,
    scale.addressSize,
    scale.addressSizeMin
  );
  // The WhatsApp row loses the mark's width to the number, so it measures against less room.
  const footerSize = Math.min(
    fitFontSize([tagline, agentLine], textWidth, scale.footerSize, 6.5),
    fitFontSize(
      [whatsapp],
      textWidth - whatsappMarkSize(scale.footerSize) - WHATSAPP_MARK_GAP,
      scale.footerSize,
      6.5
    )
  );

  return (
    <View style={{ width: "100%", height: "100%", fontFamily: FONT, color: SENIOR_LIFE.ink }}>
      {showHeader && logo ? (
        <>
          <View
            style={{
              height: scale.headerHeight,
              backgroundColor: SENIOR_LIFE.blue,
              paddingHorizontal: scale.padX,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoImage data={logo} height={scale.logoHeight} />
          </View>
          <View style={{ height: scale.accentHeight, backgroundColor: SENIOR_LIFE.gold }} />
        </>
      ) : null}

      <View
        style={{
          flexGrow: 1,
          paddingHorizontal: scale.padX,
          paddingTop: scale.padY,
          paddingBottom: showFooter ? 2 : scale.padY,
          justifyContent: "center",
        }}
      >
        {isFolder && scale.eyebrowSize > 0 ? (
          <Text
            style={{
              fontSize: scale.eyebrowSize,
              fontWeight: "bold",
              letterSpacing: 1.4,
              color: SENIOR_LIFE.blue,
              marginBottom: scale.lineGap + 2,
            }}
          >
            {EYEBROW_TEXT[record.language]}
          </Text>
        ) : null}

        <Text
          style={{
            fontSize: nameSize,
            fontWeight: "bold",
            marginBottom: scale.lineGap,
          }}
        >
          {block.nameLine}
        </Text>
        {addressLines.map((line, i) => (
          <Text key={i} style={{ fontSize: addressSize, lineHeight: 1.25 }}>
            {line}
          </Text>
        ))}
      </View>

      {showFooter ? (
        <View style={{ paddingHorizontal: scale.padX, paddingBottom: scale.padY - 2 }}>
          <View
            style={{
              borderTopWidth: 0.5,
              borderTopColor: SENIOR_LIFE.hairline,
              marginBottom: scale.lineGap + 1,
            }}
          />
          {/*
            Stacked, not side by side. On one row the two strings are wider than the label and
            @react-pdf overlapped them rather than shrinking — the printed sheet read
            "Personal y ConfidencIsaac Orraiz Corrales" with the phone running off the edge.
          */}
          {tagline ? (
            <Text style={{ fontSize: footerSize, color: SENIOR_LIFE.muted }}>{tagline}</Text>
          ) : null}
          {agentLine ? (
            <Text
              style={{
                fontSize: footerSize,
                color: SENIOR_LIFE.blue,
                marginTop: tagline ? 1.5 : 0,
              }}
            >
              {agentLine}
            </Text>
          ) : null}
          {whatsapp ? (
            <WhatsAppLine
              number={whatsapp}
              fontSize={footerSize}
              color={SENIOR_LIFE.blue}
              marginTop={tagline || agentLine ? 1.5 : 0}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type StickerSheetParams = {
  labels: MailingLabelRecord[];
  preset: StickerPreset;
  options: LabelSheetOptions;
  agent: LabelAgentContact | null;
};

function buildStickerDocument(
  params: StickerSheetParams & { logo: Buffer | null }
): ReactElement<DocumentProps> {
  const { labels, preset, options, agent, logo } = params;
  const startOffset = clampStartOffset(preset, options.startOffset);
  const totalSlots = startOffset + labels.length;
  const pageCount = Math.max(1, Math.ceil(totalSlots / preset.perPage));

  return (
    <Document title="Mailing labels" author="Isaac Plans Insurance">
      {Array.from({ length: pageCount }, (_, pageIndex) => (
        <Page
          key={pageIndex}
          size={[preset.pageWidth, preset.pageHeight]}
          style={{ backgroundColor: "#FFFFFF" }}
        >
          {labels.map((record, index) => {
            const globalSlot = startOffset + index;
            if (Math.floor(globalSlot / preset.perPage) !== pageIndex) return null;
            const { x, y } = stickerSlotOrigin(preset, globalSlot % preset.perPage);
            return (
              <View
                key={record.id}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: preset.labelWidth,
                  height: preset.labelHeight,
                  overflow: "hidden",
                }}
              >
                <StickerLabel
                  record={record}
                  preset={preset}
                  options={options}
                  agent={agent}
                  logo={logo}
                />
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}

export async function renderMailingLabelSheet(params: StickerSheetParams): Promise<Buffer> {
  const needsLogo = params.preset.supportsBranding && params.options.showLogo;
  const logo = needsLogo ? await loadSeniorLifeLogo() : null;
  return renderToBuffer(buildStickerDocument({ ...params, logo }));
}

// ─── USPS Priority Mail FROM/TO label ─────────────────────────────────────────

function ShippingLabelBody({
  record,
  sender,
  preset,
  logo,
  whatsapp,
}: {
  record: MailingLabelRecord;
  sender: SenderAddress;
  preset: ShippingPreset;
  logo: Buffer | null;
  whatsapp: string;
}) {
  const scale = SHIPPING_TYPE_SCALE[preset.id as keyof typeof SHIPPING_TYPE_SCALE];
  const layout = shippingLayout({
    record,
    sender,
    preset,
    hasLogo: Boolean(logo),
    whatsapp,
  });
  const { from, to, fromLines, toAddressLines } = layout;

  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        padding: scale.pad,
        fontFamily: FONT,
        color: SENIOR_LIFE.ink,
        backgroundColor: "#FFFFFF",
      }}
    >
      {/*
        No "FROM:" / "TO:" wording anywhere in here — the Label 228 tag this gets pasted onto
        already prints both. See ShippingTypeScale in ./theme.ts.
      */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flexShrink: 1 }}>
          {fromLines.map((line, i) => (
            <Text key={i} style={{ fontSize: from.size, lineHeight: 1.3 }}>
              {line}
            </Text>
          ))}
          {layout.whatsapp ? (
            <WhatsAppLine number={layout.whatsapp} fontSize={from.size} marginTop={1.5} />
          ) : null}
        </View>
        {/* Beside the return address, not flushed to the far edge: the tag has no room to spare. */}
        {logo ? (
          <View style={{ marginLeft: scale.logoGap, flexShrink: 0 }}>
            <LogoImage data={logo} height={scale.logoHeight} />
          </View>
        ) : null}
      </View>

      <View
        style={{
          borderBottomWidth: 0.75,
          borderBottomColor: SENIOR_LIFE.hairline,
          marginTop: scale.lineGap * 3,
        }}
      />

      <View style={{ paddingLeft: scale.toIndent, paddingTop: scale.toTopGap }}>
        <Text
          style={{
            fontSize: to.nameSize,
            fontWeight: "bold",
            marginBottom: scale.lineGap,
          }}
        >
          {to.nameLine}
        </Text>
        {toAddressLines.map((line, i) => (
          <Text key={i} style={{ fontSize: to.addressSize, lineHeight: 1.35 }}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

type ShippingParams = {
  labels: MailingLabelRecord[];
  preset: ShippingPreset;
  sender: SenderAddress;
  showLogo: boolean;
  /** Already resolved and formatted by the caller; "" prints no WhatsApp row. */
  whatsapp: string;
};

function buildShippingDocument(
  params: ShippingParams & { logo: Buffer | null }
): ReactElement<DocumentProps> {
  const { labels, preset, sender, logo, whatsapp } = params;
  const perPage = preset.perPage;
  const pageCount = Math.max(1, Math.ceil(labels.length / perPage));

  return (
    <Document title="Priority Mail labels" author="Isaac Plans Insurance">
      {Array.from({ length: pageCount }, (_, pageIndex) => {
        const pageLabels = labels.slice(pageIndex * perPage, pageIndex * perPage + perPage);
        return (
          <Page
            key={pageIndex}
            size={[preset.pageWidth, preset.pageHeight]}
            style={{ backgroundColor: "#FFFFFF" }}
          >
            {pageLabels.map((record, slot) => (
              <View
                key={record.id}
                style={{
                  position: "absolute",
                  left: 0,
                  top: slot * preset.labelHeight,
                  width: preset.pageWidth,
                  height: preset.labelHeight,
                  overflow: "hidden",
                  // Cut guide between stacked half-sheet labels.
                  borderBottomWidth: perPage > 1 && slot < perPage - 1 ? 0.5 : 0,
                  borderBottomColor: SENIOR_LIFE.hairline,
                  borderBottomStyle: "dashed",
                }}
              >
                <ShippingLabelBody
                  record={record}
                  sender={sender}
                  preset={preset}
                  logo={logo}
                  whatsapp={whatsapp}
                />
              </View>
            ))}
          </Page>
        );
      })}
    </Document>
  );
}

export async function renderShippingLabels(params: ShippingParams): Promise<Buffer> {
  const logo = params.showLogo ? await loadSeniorLifeLogo() : null;
  return renderToBuffer(buildShippingDocument({ ...params, logo }));
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export type RenderLabelsParams = {
  labels: MailingLabelRecord[];
  preset: LabelPreset;
  options: LabelSheetOptions;
  agent: LabelAgentContact | null;
  sender: SenderAddress;
};

/** Route to the right renderer based on the preset's kind. */
export async function renderLabels(params: RenderLabelsParams): Promise<Buffer> {
  const { labels, preset, options, agent, sender } = params;
  if (isStickerPreset(preset)) {
    return renderMailingLabelSheet({ labels, preset, options, agent });
  }
  return renderShippingLabels({
    labels,
    preset,
    sender,
    showLogo: options.showLogo,
    whatsapp: options.showWhatsapp ? (agent?.whatsapp ?? "") : "",
  });
}
