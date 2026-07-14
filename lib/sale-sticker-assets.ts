/** Sizes, palette, and decorative SVG art for the sale sticker. */

/** Base render size (px). Rich PNG captures at scale 2 → 1080². */
export const SALE_STICKER_RENDER_SIZE = 540;
/** Final rich image output size (px). */
export const SALE_STICKER_OUTPUT_SIZE = 1080;
/** WhatsApp tray-sticker size spec (px, transparent WebP). */
export const WHATSAPP_STICKER_SIZE = 512;

/** Solid fallback behind the rich PNG (matches the darkest gradient stop). */
export const STICKER_BG_FALLBACK = "#0A1B3D";

export type StickerTheme = {
  /** Rich-image opaque background. */
  background: string;
  /** Glow/vignette overlay. */
  glow: string;
  gold: string;
  goldDeep: string;
  accent: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  cardBorder: string;
};

/** Sale-type accent so in-person vs telesales read differently. */
export const SALE_TYPE_THEME: Record<"in_person" | "telesales", { accent: string; accentSoft: string }> = {
  in_person: { accent: "#34D399", accentSoft: "rgba(52,211,153,0.18)" },
  telesales: { accent: "#38BDF8", accentSoft: "rgba(56,189,248,0.18)" },
};

export const STICKER_THEME: StickerTheme = {
  background: "linear-gradient(150deg, #0A1B3D 0%, #10336F 48%, #0E7CC4 100%)",
  glow: "radial-gradient(120% 90% at 50% 8%, rgba(255,214,90,0.22) 0%, rgba(255,214,90,0) 55%)",
  gold: "#FFD65A",
  goldDeep: "#FFB020",
  accent: "#38BDF8",
  accentSoft: "rgba(56,189,248,0.16)",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.82)",
  cardBorder: "rgba(255,255,255,0.16)",
};

function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

// Solid fills only + explicit width/height so html2canvas renders it fully
// (gradients / <defs> get clipped or dropped in html2canvas's SVG handling).
export const TROPHY_SVG = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M18 8h28v10a14 14 0 0 1-28 0V8z" fill="#FFD65A"/>
  <path d="M18 12h-7a8 8 0 0 0 9 12.5V12z" fill="#FFB020"/>
  <path d="M46 12h7a8 8 0 0 1-9 12.5V12z" fill="#FFB020"/>
  <rect x="28.5" y="30" width="7" height="12" fill="#E7952A"/>
  <rect x="19" y="42" width="26" height="6.5" rx="2.5" fill="#FFD65A"/>
  <rect x="23" y="48.5" width="18" height="6.5" rx="2.5" fill="#E7952A"/>
  <path d="M32 11l1.7 3.5 3.8.5-2.8 2.7.7 3.8L32 19.9l-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" fill="#FFF7DE"/>
</svg>`);

export const SPARKLE_SVG = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path d="M12 0c.6 6.2 2.5 8.2 12 12-9.5 3.8-11.4 5.8-12 12-.6-6.2-2.5-8.2-12-12C9.5 8.2 11.4 6.2 12 0z" fill="#FFE9A8"/>
</svg>`);

export const BURST_SVG = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <g fill="#FFD65A" opacity="0.9">
    <path d="M60 0l7 20 7-20zM60 120l7-20 7 20zM0 60l20 7-20 7zM120 60l-20 7 20 7z" transform="translate(-7 -7)"/>
  </g>
  <circle cx="60" cy="60" r="44" fill="#FFD65A"/>
  <circle cx="60" cy="60" r="34" fill="#FFB020"/>
</svg>`);

/** Deterministic confetti pieces (percent positions) so captures are stable. */
export type ConfettiPiece = { top: string; left: string; size: number; color: string; rotate: number; round: boolean };

export const CONFETTI_PIECES: ConfettiPiece[] = [
  { top: "6%", left: "10%", size: 12, color: "#FFD65A", rotate: 18, round: false },
  { top: "12%", left: "82%", size: 10, color: "#34D399", rotate: -22, round: true },
  { top: "20%", left: "20%", size: 8, color: "#F472B6", rotate: 40, round: false },
  { top: "9%", left: "60%", size: 9, color: "#38BDF8", rotate: 12, round: true },
  { top: "28%", left: "88%", size: 11, color: "#FFD65A", rotate: -30, round: false },
  { top: "66%", left: "6%", size: 10, color: "#38BDF8", rotate: 25, round: false },
  { top: "78%", left: "92%", size: 9, color: "#F472B6", rotate: -12, round: true },
  { top: "88%", left: "16%", size: 8, color: "#34D399", rotate: 33, round: false },
  { top: "84%", left: "74%", size: 12, color: "#FFD65A", rotate: -18, round: false },
  { top: "50%", left: "94%", size: 7, color: "#FFFFFF", rotate: 10, round: true },
  { top: "40%", left: "4%", size: 7, color: "#FFFFFF", rotate: -25, round: true },
];
