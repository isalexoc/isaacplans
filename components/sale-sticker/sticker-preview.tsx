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

const SIZE = SALE_STICKER_RENDER_SIZE;
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
          background:
            "radial-gradient(circle at 50% 34%, #FFE79A 0%, #FFD65A 56%, #FFB020 100%)",
          border: "3px solid #FFF3C4",
          boxShadow: "0 4px 12px rgba(0,0,0,0.30)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: size * 0.46,
            color: "#3A2400",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          #{n}
        </span>
      </div>
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: captionSize,
          color: "#FFFFFF",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginTop: 4,
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          whiteSpace: "nowrap",
        }}
      >
        {caption}
      </span>
    </div>
  );
}

function Pill({
  label,
  color,
  bg,
  border,
  fontSize,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
  fontSize: number;
}) {
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
        padding: "6px 15px",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        lineHeight: 1.15,
      }}
    >
      {label}
    </span>
  );
}

export const StickerPreview = forwardRef<HTMLDivElement, StickerPreviewProps>(
  function StickerPreview(
    {
      data,
      dailySequence,
      saleDate,
      agentPhotoUrl,
      agentAvatarUrl,
      companyLogoUrl,
      agentName,
      variant = "image",
      animationPhase = 0,
      className,
    },
    ref
  ) {
    const theme = STICKER_THEME;
    const strings = SALE_STICKER_STRINGS[data.language];
    const saleTypeAccent = SALE_TYPE_THEME[data.saleType];
    const leadLabel = resolveLeadSourceLabel(
      data.language,
      data.leadSource,
      data.leadSourceCustom
    );
    const dateLabel = formatStickerDate(saleDate, data.language);
    const isDiecut = variant === "diecut";
    const clientName = data.clientName.trim() || strings.clientPrefix;
    const titlePrefix = strings.clientTitle[data.clientTitle];
    const protectionLine = strings.protectedWith(data.clientTitle);
    const motivational = strings.motivationalPhrase;

    // Sizing (all in 540-base units). Compact for the smaller die-cut sticker.
    const s = isDiecut
      ? {
          pad: "16px 20px 14px", logo: 72, badge: 66, cap: 11.5, headline: 44, trophy: 40, sparkle: 20,
          title: 14, name: 27, nameSm: 22, protect: 13.5, pill: 13.5, date: 13.5, phrase: 15, moti: 15, agent: 15, gap: 6,
        }
      : {
          pad: "18px 26px 16px", logo: 84, badge: 74, cap: 12.5, headline: 52, trophy: 48, sparkle: 26,
          title: 16, name: 33, nameSm: 27, protect: 15.5, pill: 15, date: 15, phrase: 17, moti: 17, agent: 17, gap: 7,
        };

    const pulse = 1 + 0.05 * Math.sin(animationPhase * Math.PI * 2);
    const sparkleRot = animationPhase * 360;

    return (
      <div
        ref={ref}
        className={className}
        style={{
          width: SIZE,
          height: SIZE,
          minWidth: SIZE,
          maxWidth: SIZE,
          boxSizing: "border-box",
          background: "transparent",
          padding: isDiecut ? 16 : 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            background: theme.background,
            borderRadius: isDiecut ? 52 : 0,
            border: isDiecut ? "9px solid #FFFFFF" : "none",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: s.pad,
            fontFamily: FONT,
            color: theme.text,
          }}
        >
          {/* Warm glow low-center + confetti */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(115% 78% at 50% 74%, rgba(255,214,90,0.18) 0%, rgba(255,214,90,0) 54%)",
            }}
          />
          <ConfettiLayer phase={animationPhase} />

          {/* Header: logo + number badge (logo vertically centered against the circle) */}
          <div
            style={{
              position: "relative",
              width: "100%",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", height: s.badge }}>
              {companyLogoUrl ? (
                <img
                  src={companyLogoUrl}
                  alt=""
                  crossOrigin="anonymous"
                  style={{ maxHeight: s.logo, maxWidth: 220, width: "auto", objectFit: "contain" }}
                />
              ) : null}
            </div>
            <NumberBadge
              n={dailySequence}
              caption={strings.numberBadgeLabel}
              size={s.badge}
              captionSize={s.cap}
            />
          </div>

          {/* Headline */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginTop: 4,
              marginBottom: 6,
              flexShrink: 0,
              transform: `scale(${pulse})`,
            }}
          >
            <img src={TROPHY_SVG} alt="" width={s.trophy} height={s.trophy} />
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: s.headline,
                color: theme.gold,
                letterSpacing: "0.01em",
                textShadow: "0 3px 10px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)",
                lineHeight: 1,
              }}
            >
              {strings.saleHeadline}
            </span>
            <img
              src={SPARKLE_SVG}
              alt=""
              width={s.sparkle}
              height={s.sparkle}
              style={{ transform: `rotate(${sparkleRot}deg)` }}
            />
          </div>

          {/* Photo — the hero. Flex-fills; floats centered with breathing room. */}
          <div
            style={{
              position: "relative",
              width: "100%",
              flex: "1 1 auto",
              minHeight: 0,
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
                width: "90%",
                height: "90%",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,214,90,0.5) 0%, rgba(255,214,90,0.14) 46%, rgba(255,214,90,0) 68%)",
              }}
            />
            {isDiecut ? (
              <div
                style={{
                  position: "relative",
                  height: "92%",
                  aspectRatio: "1 / 1",
                  maxWidth: "88%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "5px solid #FFFFFF",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
                  background: "#0E3A6E",
                }}
              >
                {agentAvatarUrl ? (
                  <img
                    src={agentAvatarUrl}
                    alt=""
                    crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </div>
            ) : agentPhotoUrl ? (
              <img
                src={agentPhotoUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  position: "relative",
                  maxHeight: "100%",
                  maxWidth: "80%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.4))",
                }}
              />
            ) : null}
          </div>

          {/* Client title + name */}
          <div style={{ position: "relative", width: "100%", textAlign: "center", flexShrink: 0, marginTop: s.gap }}>
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: s.title,
                color: theme.gold,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                marginBottom: 2,
              }}
            >
              {titlePrefix}
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 700,
                fontSize: clientName.length > 16 ? s.nameSm : s.name,
                color: "#FFFFFF",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                lineHeight: 1.04,
                wordBreak: "break-word",
              }}
            >
              {clientName}
            </div>
          </div>

          {/* Protection tagline */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "96%",
              textAlign: "center",
              flexShrink: 0,
              marginTop: 4,
              fontFamily: FONT,
              fontWeight: 500,
              fontSize: s.protect,
              lineHeight: 1.3,
              color: theme.textMuted,
            }}
          >
            {protectionLine}
          </div>

          {/* Pills */}
          <div
            style={{
              position: "relative",
              width: "100%",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              justifyContent: "center",
              marginTop: s.gap,
              flexShrink: 0,
            }}
          >
            <Pill
              label={strings.saleType[data.saleType]}
              color="#062B12"
              bg={saleTypeAccent.accent}
              border={saleTypeAccent.accent}
              fontSize={s.pill}
            />
            {leadLabel ? (
              <Pill
                label={leadLabel}
                color="#FFFFFF"
                bg="rgba(255,255,255,0.16)"
                border="rgba(255,255,255,0.42)"
                fontSize={s.pill}
              />
            ) : null}
          </div>

          {/* Optional custom phrase */}
          {data.customPhrase.trim() ? (
            <div
              style={{
                position: "relative",
                marginTop: s.gap,
                padding: "5px 16px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.28)",
                color: "#FFFFFF",
                fontFamily: FONT,
                fontWeight: 600,
                fontStyle: "italic",
                fontSize: s.phrase,
                maxWidth: "92%",
                textAlign: "center",
                lineHeight: 1.2,
                flexShrink: 0,
              }}
            >
              “{data.customPhrase.trim()}”
            </div>
          ) : null}

          {/* Always-present motivational ribbon */}
          <div
            style={{
              position: "relative",
              marginTop: s.gap + 1,
              padding: isDiecut ? "6px 18px" : "7px 22px",
              borderRadius: 999,
              background: "linear-gradient(90deg, #FFD65A 0%, #FFB020 100%)",
              boxShadow: "0 3px 10px rgba(0,0,0,0.28)",
              color: "#3A2400",
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: s.moti,
              letterSpacing: "0.01em",
              textAlign: "center",
              lineHeight: 1.15,
              flexShrink: 0,
            }}
          >
            {motivational}
          </div>

          {/* Footer: extra image + agent name + date */}
          <div
            style={{
              position: "relative",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginTop: s.gap + 2,
              flexShrink: 0,
            }}
          >
            {!isDiecut && data.extraImageUrl ? (
              <img
                src={data.extraImageUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  height: 52,
                  width: 52,
                  objectFit: "cover",
                  borderRadius: 12,
                  border: "2px solid rgba(255,255,255,0.55)",
                  flexShrink: 0,
                }}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.15 }}>
              <span
                style={{
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: s.agent,
                  color: "#FFFFFF",
                  letterSpacing: "0.02em",
                  textAlign: "center",
                }}
              >
                {agentName}
              </span>
              <span
                style={{
                  fontFamily: FONT,
                  fontWeight: 500,
                  fontSize: s.date,
                  color: theme.textMuted,
                  letterSpacing: "0.03em",
                  marginTop: 1,
                }}
              >
                {dateLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
