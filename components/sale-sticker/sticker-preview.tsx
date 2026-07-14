"use client";

import { forwardRef } from "react";
import type { SaleStickerData } from "@/lib/sale-sticker";
import {
  CONFETTI_PIECES,
  SALE_STICKER_RENDER_SIZE,
  SALE_TYPE_THEME,
  SPARKLE_SVG,
  STICKER_THEME,
  TROPHY_SVG,
} from "@/lib/sale-sticker-assets";
import {
  SALE_STICKER_STRINGS,
  formatStickerDate,
  resolveLeadSourceLabel,
} from "@/lib/sale-sticker-strings";

export type StickerPreviewVariant = "image" | "diecut";

export type StickerPreviewProps = {
  data: SaleStickerData;
  dailySequence: number;
  saleDate: string;
  agentPhotoUrl: string; // background-removed cutout (rich image)
  agentAvatarUrl: string; // filled headshot (round avatar on die-cut)
  companyLogoUrl: string;
  agentName: string;
  variant?: StickerPreviewVariant;
  /** 0..1 phase for animated frames; 0 = static. */
  animationPhase?: number;
  className?: string;
};

// Fixed WIDTH; height flows with content (html2canvas renders block flow
// reliably — unlike flex-grow / aspect-ratio, which it mis-measures).
const W = SALE_STICKER_RENDER_SIZE;
const FONT = "'Poppins','Segoe UI',system-ui,-apple-system,sans-serif";

function ConfettiLayer({ phase }: { phase: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {CONFETTI_PIECES.map((p, i) => {
        const baseTop = parseFloat(p.top);
        const top = ((baseTop + phase * 118 + i * 2) % 116) - 8;
        const rot = p.rotate + phase * 220 * (i % 2 === 0 ? 1 : -1);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${top}%`,
              left: p.left,
              width: p.size,
              height: p.round ? p.size : p.size * 0.5,
              backgroundColor: p.color,
              borderRadius: p.round ? "50%" : 2,
              transform: `rotate(${rot}deg)`,
              opacity: 0.92,
            }}
          />
        );
      })}
    </div>
  );
}

function NumberBadge({ n, caption, size, captionSize }: { n: number; caption: string; size: number; captionSize: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 34%, #FFE79A 0%, #FFD65A 56%, #FFB020 100%)",
          border: "3px solid #FFF3C4",
          boxShadow: "0 4px 12px rgba(0,0,0,0.30)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: size * 0.46, color: "#3A2400", lineHeight: 1, letterSpacing: "-0.02em" }}>
          #{n}
        </span>
      </div>
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: captionSize, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 5, textShadow: "0 1px 3px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
        {caption}
      </span>
    </div>
  );
}

function Pill({ label, color, bg, border, fontSize }: { label: string; color: string; bg: string; border: string; fontSize: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: FONT,
        fontWeight: 600,
        fontSize,
        color,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 999,
        padding: "7px 17px",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        lineHeight: 1.15,
      }}
    >
      {label}
    </span>
  );
}

/** Fixed-size photo box (no aspect-ratio / flex-grow) with a halo behind. */
function PhotoBox({ boxW, boxH, children }: { boxW: number | string; boxH: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: boxW,
        height: boxH,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: boxH + 40,
          height: boxH + 40,
          marginLeft: -(boxH + 40) / 2,
          marginTop: -(boxH + 40) / 2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,214,90,0.5) 0%, rgba(255,214,90,0.14) 46%, rgba(255,214,90,0) 68%)",
        }}
      />
      {children}
    </div>
  );
}

export const StickerPreview = forwardRef<HTMLDivElement, StickerPreviewProps>(
  function StickerPreview(
    { data, dailySequence, saleDate, agentPhotoUrl, agentAvatarUrl, companyLogoUrl, agentName, variant = "image", animationPhase = 0, className },
    ref
  ) {
    const theme = STICKER_THEME;
    const strings = SALE_STICKER_STRINGS[data.language];
    const saleTypeAccent = SALE_TYPE_THEME[data.saleType];
    const leadLabel = resolveLeadSourceLabel(data.language, data.leadSource, data.leadSourceCustom);
    const dateLabel = formatStickerDate(saleDate, data.language);
    const isDiecut = variant === "diecut";
    const clientName = data.clientName.trim() || strings.clientPrefix;
    const titlePrefix = strings.clientTitle[data.clientTitle];
    const protectionLine = strings.protectedWith(data.clientTitle);
    const motivational = strings.motivationalPhrase;
    const sparkleRot = animationPhase * 360;

    const headline = (size: number, trophy: number, sparkle: number, mb: number) => (
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 6, marginBottom: mb }}>
        <img src={TROPHY_SVG} alt="" width={trophy} height={trophy} />
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, color: theme.gold, letterSpacing: "0.01em", textShadow: "0 3px 10px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)", lineHeight: 1 }}>
          {strings.saleHeadline}
        </span>
        <img src={SPARKLE_SVG} alt="" width={sparkle} height={sparkle} style={{ transform: `rotate(${sparkleRot}deg)` }} />
      </div>
    );

    const header = (logo: number, badge: number, cap: number) => (
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", height: badge }}>
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt="" crossOrigin="anonymous" style={{ maxHeight: logo, maxWidth: 230, width: "auto", objectFit: "contain" }} />
          ) : null}
        </div>
        <NumberBadge n={dailySequence} caption={strings.numberBadgeLabel} size={badge} captionSize={cap} />
      </div>
    );

    const clientBlock = (titleSize: number, nameSize: number, nameSmSize: number) => (
      <div style={{ position: "relative", textAlign: "center", marginTop: 12 }}>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: titleSize, color: theme.gold, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>
          {titlePrefix}
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: clientName.length > 16 ? nameSmSize : nameSize, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1.05, wordBreak: "break-word" }}>
          {clientName}
        </div>
      </div>
    );

    const wrap = (children: React.ReactNode, pad: string) => (
      <div
        ref={ref}
        className={className}
        style={{ width: W, boxSizing: "border-box", background: "transparent", padding: isDiecut ? 16 : 0, position: "relative" }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            boxSizing: "border-box",
            background: theme.background,
            borderRadius: isDiecut ? 48 : 0,
            border: isDiecut ? "9px solid #FFFFFF" : "none",
            overflow: "hidden",
            padding: pad,
            fontFamily: FONT,
            color: theme.text,
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 70% at 50% 62%, rgba(255,214,90,0.16) 0%, rgba(255,214,90,0) 55%)" }} />
          <ConfettiLayer phase={animationPhase} />
          <div style={{ position: "relative" }}>{children}</div>
        </div>
      </div>
    );

    // ── HERO layout: simplified + big photo (die-cut sticker / animated webp) ──
    if (isDiecut) {
      return wrap(
        <>
          {header(84, 84, 13)}
          {headline(60, 54, 28, 6)}
          <PhotoBox boxW={244} boxH={244}>
            <div style={{ width: 224, height: 224, borderRadius: "50%", overflow: "hidden", border: "5px solid #FFFFFF", boxShadow: "0 6px 16px rgba(0,0,0,0.35)", background: "#0E3A6E" }}>
              {agentAvatarUrl ? <img src={agentAvatarUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            </div>
          </PhotoBox>
          {clientBlock(20, 46, 38)}
          <div style={{ position: "relative", textAlign: "center", marginTop: 10, fontFamily: FONT, fontWeight: 600, fontSize: 18, color: theme.textMuted, letterSpacing: "0.03em" }}>
            {agentName}
          </div>
        </>,
        "26px 26px 26px"
      );
    }

    // ── FULL layout: everything (large opaque image + GIF) ──
    return wrap(
      <>
        {header(92, 88, 14)}
        {headline(66, 58, 30, 4)}
        <PhotoBox boxW="100%" boxH={300}>
          {agentPhotoUrl ? (
            <img src={agentPhotoUrl} alt="" crossOrigin="anonymous" style={{ position: "relative", maxHeight: 300, maxWidth: "80%", objectFit: "contain", filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.4))" }} />
          ) : null}
        </PhotoBox>
        {clientBlock(19, 42, 34)}
        <div style={{ position: "relative", textAlign: "center", marginTop: 6, marginLeft: "auto", marginRight: "auto", maxWidth: "94%", fontFamily: FONT, fontWeight: 500, fontSize: 18, lineHeight: 1.3, color: theme.textMuted }}>
          {protectionLine}
        </div>
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 14 }}>
          <Pill label={strings.saleType[data.saleType]} color="#062B12" bg={saleTypeAccent.accent} border={saleTypeAccent.accent} fontSize={17} />
          {leadLabel ? <Pill label={leadLabel} color="#FFFFFF" bg="rgba(255,255,255,0.16)" border="rgba(255,255,255,0.42)" fontSize={17} /> : null}
        </div>
        {data.customPhrase.trim() ? (
          <div style={{ position: "relative", marginTop: 14, textAlign: "center" }}>
            <span style={{ display: "inline-block", padding: "7px 20px", borderRadius: 999, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.28)", color: "#FFFFFF", fontFamily: FONT, fontWeight: 600, fontStyle: "italic", fontSize: 20, maxWidth: "90%", lineHeight: 1.2 }}>
              “{data.customPhrase.trim()}”
            </span>
          </div>
        ) : null}
        <div style={{ position: "relative", marginTop: 16, textAlign: "center" }}>
          <span style={{ display: "inline-block", padding: "9px 26px", borderRadius: 999, background: "linear-gradient(90deg, #FFD65A 0%, #FFB020 100%)", boxShadow: "0 3px 10px rgba(0,0,0,0.28)", color: "#3A2400", fontFamily: FONT, fontWeight: 700, fontSize: 20, lineHeight: 1.15 }}>
            {motivational}
          </span>
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 18 }}>
          {data.extraImageUrl ? (
            <img src={data.extraImageUrl} alt="" crossOrigin="anonymous" style={{ height: 58, width: 58, objectFit: "cover", borderRadius: 12, border: "2px solid rgba(255,255,255,0.55)" }} />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.15 }}>
            <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 19, color: "#FFFFFF", letterSpacing: "0.02em" }}>{agentName}</span>
            <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 16, color: theme.textMuted, marginTop: 2 }}>{dateLabel}</span>
          </div>
        </div>
      </>,
      "24px 30px 26px"
    );
  }
);
