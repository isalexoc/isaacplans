"use client";

import Image from "next/image";
import { formatAddressBlock, resolveTagline, senderNameLines, uspsLine } from "@/lib/mailing-labels/format";
import {
  isStickerPreset,
  PT_PER_INCH,
  type LabelPreset,
} from "@/lib/mailing-labels/presets";
import {
  EYEBROW_TEXT,
  LABEL_TYPE_SCALE,
  SENIOR_LIFE,
  SENIOR_LIFE_LOGO_PRINT,
  SHIPPING_TYPE_SCALE,
} from "@/lib/mailing-labels/theme";
import type {
  LabelAgentContact,
  LabelSheetOptions,
  MailingLabelRecord,
  SenderAddress,
} from "@/lib/mailing-labels/types";

/**
 * On-screen preview of a single label. Driven by the SAME geometry (lib/mailing-labels/presets.ts)
 * and type scale (theme.ts) as the PDF renderer, so what the admin sees here can't drift from what
 * comes out of the printer.
 *
 * Points are converted to CSS pixels at 96/72, i.e. one CSS pixel per 1/96", which is how the
 * browser defines an inch. `previewScale` then shrinks the whole thing to fit the panel.
 */

const PX_PER_PT = 96 / PT_PER_INCH;

function pt(value: number): number {
  return value * PX_PER_PT;
}

export function LabelPreview({
  record,
  preset,
  options,
  agent,
  sender,
  previewScale = 1,
}: {
  record: MailingLabelRecord;
  preset: LabelPreset;
  options: LabelSheetOptions;
  agent: LabelAgentContact | null;
  sender: SenderAddress;
  previewScale?: number;
}) {
  const width = isStickerPreset(preset) ? preset.labelWidth : preset.pageWidth;
  const height = isStickerPreset(preset) ? preset.labelHeight : preset.labelHeight;

  return (
    <div
      className="shrink-0 overflow-hidden rounded-sm bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12)]"
      style={{
        width: pt(width) * previewScale,
        height: pt(height) * previewScale,
      }}
    >
      <div
        style={{
          width: pt(width),
          height: pt(height),
          transform: `scale(${previewScale})`,
          transformOrigin: "top left",
        }}
      >
        {isStickerPreset(preset) ? (
          <StickerPreviewBody
            record={record}
            preset={preset}
            options={options}
            agent={agent}
          />
        ) : (
          <ShippingPreviewBody record={record} preset={preset} sender={sender} options={options} />
        )}
      </div>
    </div>
  );
}

function StickerPreviewBody({
  record,
  preset,
  options,
  agent,
}: {
  record: MailingLabelRecord;
  preset: Extract<LabelPreset, { kind: "sticker" }>;
  options: LabelSheetOptions;
  agent: LabelAgentContact | null;
}) {
  const scale = LABEL_TYPE_SCALE[preset.variant];
  const block = formatAddressBlock(record);
  const branding = preset.supportsBranding;
  const showHeader = branding && options.showLogo && scale.headerHeight > 0;
  const isFolder = preset.variant === "folder";

  const tagline = branding ? resolveTagline(record.language, options.taglines) : "";
  const agentLine =
    branding && options.showAgentContact && agent
      ? [agent.name, agent.phone].filter(Boolean).join("  ·  ")
      : "";
  const showFooter = Boolean(tagline || agentLine) && scale.footerSize > 0;

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ fontFamily: "Helvetica, Arial, sans-serif", color: SENIOR_LIFE.ink }}
    >
      {showHeader ? (
        <>
          <div
            className="flex items-center justify-center"
            style={{
              height: pt(scale.headerHeight),
              backgroundColor: SENIOR_LIFE.blue,
              paddingLeft: pt(scale.padX),
              paddingRight: pt(scale.padX),
            }}
          >
            <Image
              src={SENIOR_LIFE_LOGO_PRINT}
              alt="Senior Life"
              width={600}
              height={170}
              unoptimized
              style={{ height: pt(scale.logoHeight), width: "auto", objectFit: "contain" }}
            />
          </div>
          <div
            style={{ height: pt(scale.accentHeight), backgroundColor: SENIOR_LIFE.gold }}
          />
        </>
      ) : null}

      <div
        className="flex flex-grow flex-col justify-center"
        style={{
          paddingLeft: pt(scale.padX),
          paddingRight: pt(scale.padX),
          paddingTop: pt(scale.padY),
          paddingBottom: pt(showFooter ? 2 : scale.padY),
        }}
      >
        {isFolder && scale.eyebrowSize > 0 ? (
          <div
            style={{
              fontSize: pt(scale.eyebrowSize),
              fontWeight: 700,
              letterSpacing: pt(1.4),
              color: SENIOR_LIFE.blue,
              marginBottom: pt(scale.lineGap + 2),
            }}
          >
            {EYEBROW_TEXT[record.language]}
          </div>
        ) : null}

        <div
          style={{
            fontSize: pt(scale.nameSize),
            fontWeight: 700,
            marginBottom: pt(scale.lineGap),
          }}
        >
          {block.nameLine}
        </div>
        <div style={{ fontSize: pt(scale.addressSize), lineHeight: 1.25 }}>{block.line1}</div>
        {block.line2 ? (
          <div style={{ fontSize: pt(scale.addressSize), lineHeight: 1.25 }}>{block.line2}</div>
        ) : null}
        <div style={{ fontSize: pt(scale.addressSize), lineHeight: 1.25 }}>
          {block.cityStateZip}
        </div>
      </div>

      {showFooter ? (
        <div
          style={{
            paddingLeft: pt(scale.padX),
            paddingRight: pt(scale.padX),
            paddingBottom: pt(scale.padY - 2),
          }}
        >
          <div
            style={{
              borderTop: `1px solid ${SENIOR_LIFE.hairline}`,
              marginBottom: pt(scale.lineGap + 1),
            }}
          />
          <div className="flex items-end justify-between">
            <span
              style={{
                fontSize: pt(scale.footerSize),
                color: SENIOR_LIFE.muted,
                paddingRight: pt(10),
              }}
            >
              {tagline}
            </span>
            <span style={{ fontSize: pt(scale.footerSize), color: SENIOR_LIFE.blue }}>
              {agentLine}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShippingPreviewBody({
  record,
  preset,
  sender,
  options,
}: {
  record: MailingLabelRecord;
  preset: Extract<LabelPreset, { kind: "shipping" }>;
  sender: SenderAddress;
  options: LabelSheetOptions;
}) {
  const scale = SHIPPING_TYPE_SCALE[preset.id as keyof typeof SHIPPING_TYPE_SCALE];
  const from = formatAddressBlock(sender);
  const to = formatAddressBlock(record);
  const fromNames = senderNameLines(sender);
  const fromPhone = uspsLine(sender.phone);

  return (
    <div
      className="h-full w-full bg-white"
      style={{
        padding: pt(scale.pad),
        fontFamily: "Helvetica, Arial, sans-serif",
        color: SENIOR_LIFE.ink,
      }}
    >
      <div className="flex justify-between">
        <div className="flex-grow" style={{ paddingRight: pt(8) }}>
          <div
            style={{
              fontSize: pt(scale.fromLabelSize),
              fontWeight: 700,
              letterSpacing: pt(1),
              color: SENIOR_LIFE.muted,
              marginBottom: pt(scale.lineGap),
            }}
          >
            FROM:
          </div>
          {fromNames.map((line) => (
            <div key={line} style={{ fontSize: pt(scale.fromSize), lineHeight: 1.3 }}>
              {line}
            </div>
          ))}
          <div style={{ fontSize: pt(scale.fromSize), lineHeight: 1.3 }}>{from.line1}</div>
          {from.line2 ? (
            <div style={{ fontSize: pt(scale.fromSize), lineHeight: 1.3 }}>{from.line2}</div>
          ) : null}
          <div style={{ fontSize: pt(scale.fromSize), lineHeight: 1.3 }}>{from.cityStateZip}</div>
          {fromPhone ? (
            <div style={{ fontSize: pt(scale.fromSize), lineHeight: 1.3 }}>{fromPhone}</div>
          ) : null}
        </div>
        {options.showLogo ? (
          <Image
            src={SENIOR_LIFE_LOGO_PRINT}
            alt="Senior Life"
            width={600}
            height={170}
            unoptimized
            style={{ height: pt(scale.logoHeight), width: "auto", objectFit: "contain" }}
          />
        ) : null}
      </div>

      <div
        style={{
          borderBottom: `${Math.max(1, pt(0.75))}px solid ${SENIOR_LIFE.hairline}`,
          marginTop: pt(scale.lineGap * 3),
        }}
      />

      <div style={{ paddingLeft: pt(scale.toIndent), paddingTop: pt(scale.toTopGap) }}>
        <div
          style={{
            fontSize: pt(scale.toLabelSize),
            fontWeight: 700,
            letterSpacing: pt(1),
            color: SENIOR_LIFE.muted,
            marginBottom: pt(scale.lineGap + 2),
          }}
        >
          TO:
        </div>
        <div
          style={{
            fontSize: pt(scale.toNameSize),
            fontWeight: 700,
            marginBottom: pt(scale.lineGap),
          }}
        >
          {to.nameLine}
        </div>
        <div style={{ fontSize: pt(scale.toAddressSize), lineHeight: 1.35 }}>{to.line1}</div>
        {to.line2 ? (
          <div style={{ fontSize: pt(scale.toAddressSize), lineHeight: 1.35 }}>{to.line2}</div>
        ) : null}
        <div style={{ fontSize: pt(scale.toAddressSize), lineHeight: 1.35 }}>
          {to.cityStateZip}
        </div>
      </div>
    </div>
  );
}

/** Placeholder record so the preview has something to show before anything is selected. */
export const PREVIEW_SAMPLE: MailingLabelRecord = {
  id: "preview",
  source: "manual",
  sourceRef: null,
  crmContactId: null,
  firstName: "Maria",
  lastName: "Rodriguez",
  addressLine1: "4821 SW 8th St",
  addressLine2: "Apt 3B",
  city: "Miami",
  state: "FL",
  postalCode: "33134",
  language: "en",
  phone: "",
  email: "",
  status: "pending",
  printedAt: null,
  notes: "",
  letterBody: "",
  letterGeneratedAt: null,
  letterEditedAt: null,
  letterContext: "",
  createdAt: null,
  updatedAt: null,
};
