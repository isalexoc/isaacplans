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
  agentPhotoUrl: string; // (unused) background-removed cutout
  agentAvatarUrl: string; // filled headshot for the round avatar
  companyLogoUrl: string;
  agentName: string;
  variant?: StickerPreviewVariant;
  /** 0..1 phase for animated frames; 0 = static. */
  animationPhase?: number;
  /** When true (GIF frames), the personal image does an intro spin-in. */
  animateExtra?: boolean;
  className?: string;
};

// Fixed WIDTH; height flows with content (html2canvas renders block flow reliably).
const W = SALE_STICKER_RENDER_SIZE;
const FONT = "'Poppins','Segoe UI',system-ui,-apple-system,sans-serif";
const smoothstep = (t: number) => t * t * (3 - 2 * t);

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
        padding: "8px 18px",
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
    { data, dailySequence, saleDate, agentAvatarUrl, companyLogoUrl, agentName, animationPhase = 0, animateExtra = false, className },
    ref
  ) {
    const theme = STICKER_THEME;
    const strings = SALE_STICKER_STRINGS[data.language];
    const saleTypeAccent = SALE_TYPE_THEME[data.saleType];
    const leadLabel = resolveLeadSourceLabel(data.language, data.leadSource, data.leadSourceCustom);
    const dateLabel = formatStickerDate(saleDate, data.language);
    const clientName = data.clientName.trim() || strings.clientPrefix;
    const titlePrefix = strings.clientTitle[data.clientTitle];
    const protectionLine = strings.protectedWith(data.clientTitle);
    const motivational = strings.motivationalPhrase;

    const p = animationPhase;
    const sparkleRot = p * 360;

    const s = { logo: 92, badge: 88, cap: 14, headline: 66, trophy: 58, sparkle: 30, avatar: 264, title: 22, name: 46, nameSm: 38, protect: 21, pill: 19, phrase: 22, moti: 22, agent: 21, date: 18 };

    // Personal-image intro (GIF only): spins in big, shrinks, and lands at the footer.
    let extraOverlay: React.ReactNode = null;
    if (animateExtra && data.extraImageUrl) {
      const t = Math.min(p / 0.5, 1);
      const e = smoothstep(t);
      const scale = 3.0 - e * 2.45; // 3.0 → 0.55
      const rot = (1 - e) * 720; // two spins → 0
      const topPct = 30 + e * 61; // 30% → 91% (down to the footer)
      const opacity = p >= 0.5 ? 0 : t > 0.82 ? Math.max(0, 1 - (t - 0.82) / 0.18) : 1;
      extraOverlay = (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
          <img
            src={data.extraImageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              left: "50%",
              top: `${topPct}%`,
              width: 104,
              height: 104,
              objectFit: "cover",
              borderRadius: "50%",
              border: "4px solid #FFFFFF",
              boxShadow: "0 0 26px 8px rgba(255,214,90,0.8), 0 8px 16px rgba(0,0,0,0.45)",
              transform: `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`,
              opacity,
            }}
          />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={className}
        style={{ width: W, boxSizing: "border-box", position: "relative" }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            boxSizing: "border-box",
            background: theme.background,
            overflow: "hidden",
            padding: "24px 30px 26px",
            fontFamily: FONT,
            color: theme.text,
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 70% at 50% 60%, rgba(255,214,90,0.16) 0%, rgba(255,214,90,0) 55%)" }} />
          <ConfettiLayer phase={animationPhase} />

          <div style={{ position: "relative" }}>
            {/* Header: logo + number badge */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", height: s.badge }}>
                {companyLogoUrl ? (
                  <img src={companyLogoUrl} alt="" crossOrigin="anonymous" style={{ maxHeight: s.logo, maxWidth: 240, width: "auto", objectFit: "contain" }} />
                ) : null}
              </div>
              <NumberBadge n={dailySequence} caption={strings.numberBadgeLabel} size={s.badge} captionSize={s.cap} />
            </div>

            {/* Headline */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 8, marginBottom: 8 }}>
              <img src={TROPHY_SVG} alt="" width={s.trophy} height={s.trophy} />
              <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: s.headline, color: theme.gold, letterSpacing: "0.01em", textShadow: "0 3px 10px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)", lineHeight: 1 }}>
                {strings.saleHeadline}
              </span>
              <img src={SPARKLE_SVG} alt="" width={s.sparkle} height={s.sparkle} style={{ transform: `rotate(${sparkleRot}deg)` }} />
            </div>

            {/* Round agent avatar (profile-style frame) */}
            <div style={{ position: "relative", width: "100%", height: s.avatar + 24, display: "flex", alignItems: "center", justifyContent: "center", margin: "4px 0" }}>
              <div style={{ position: "absolute", left: "50%", top: "50%", width: s.avatar + 60, height: s.avatar + 60, marginLeft: -(s.avatar + 60) / 2, marginTop: -(s.avatar + 60) / 2, borderRadius: "50%", background: "radial-gradient(circle at 50% 50%, rgba(255,214,90,0.45) 0%, rgba(255,214,90,0.12) 46%, rgba(255,214,90,0) 68%)" }} />
              <div style={{ position: "relative", width: s.avatar, height: s.avatar, borderRadius: "50%", overflow: "hidden", border: "5px solid #FFFFFF", boxShadow: "0 0 0 5px rgba(255,214,90,0.35), 0 10px 22px rgba(0,0,0,0.42)", background: "#0E3A6E" }}>
                {agentAvatarUrl ? (
                  <img src={agentAvatarUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>
            </div>

            {/* Client title + name */}
            <div style={{ position: "relative", textAlign: "center", marginTop: 14 }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: s.title, color: theme.gold, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>
                {titlePrefix}
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: clientName.length > 16 ? s.nameSm : s.name, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1.05, wordBreak: "break-word" }}>
                {clientName}
              </div>
            </div>

            {/* Protection tagline */}
            <div style={{ position: "relative", textAlign: "center", marginTop: 6, marginLeft: "auto", marginRight: "auto", maxWidth: "96%", fontFamily: FONT, fontWeight: 500, fontSize: s.protect, lineHeight: 1.3, color: theme.textMuted }}>
              {protectionLine}
            </div>

            {/* Pills */}
            <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "center", marginTop: 14 }}>
              <Pill label={strings.saleType[data.saleType]} color="#062B12" bg={saleTypeAccent.accent} border={saleTypeAccent.accent} fontSize={s.pill} />
              {leadLabel ? <Pill label={leadLabel} color="#FFFFFF" bg="rgba(255,255,255,0.16)" border="rgba(255,255,255,0.42)" fontSize={s.pill} /> : null}
            </div>

            {/* Optional custom phrase */}
            {data.customPhrase.trim() ? (
              <div style={{ position: "relative", marginTop: 14, textAlign: "center" }}>
                <span style={{ display: "inline-block", padding: "8px 22px", borderRadius: 999, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.28)", color: "#FFFFFF", fontFamily: FONT, fontWeight: 600, fontStyle: "italic", fontSize: s.phrase, maxWidth: "90%", lineHeight: 1.2 }}>
                  “{data.customPhrase.trim()}”
                </span>
              </div>
            ) : null}

            {/* Always-present motivational ribbon */}
            <div style={{ position: "relative", marginTop: 16, textAlign: "center" }}>
              <span style={{ display: "inline-block", padding: "10px 28px", borderRadius: 999, background: "linear-gradient(90deg, #FFD65A 0%, #FFB020 100%)", boxShadow: "0 3px 10px rgba(0,0,0,0.28)", color: "#3A2400", fontFamily: FONT, fontWeight: 700, fontSize: s.moti, lineHeight: 1.15 }}>
                {motivational}
              </span>
            </div>

            {/* Footer: personal image (round) + agent name + date */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 18 }}>
              {data.extraImageUrl ? (
                <img src={data.extraImageUrl} alt="" crossOrigin="anonymous" style={{ height: 60, width: 60, objectFit: "cover", borderRadius: "50%", border: "3px solid rgba(255,255,255,0.7)", boxShadow: "0 3px 8px rgba(0,0,0,0.35)" }} />
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.15 }}>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: s.agent, color: "#FFFFFF", letterSpacing: "0.02em" }}>{agentName}</span>
                <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: s.date, color: theme.textMuted, marginTop: 2 }}>{dateLabel}</span>
              </div>
            </div>
          </div>

          {extraOverlay}
        </div>
      </div>
    );
  }
);
