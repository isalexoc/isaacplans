import { ImageResponse } from "next/og";
import enLeaveBehind from "@/messages/en/final-expense/leave-behind.json";
import esLeaveBehind from "@/messages/es/final-expense/leave-behind.json";
import { TIER_MEDAL_URLS } from "@/lib/final-expense-leave-behind-tiers";
import type { SupportedLocale } from "@/lib/seo/i18n";

export const runtime = "edge";
export const alt = "Final expense leave-behind quote images for agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type OgCopy = {
  eyebrow: string;
  title: string;
  highlight: string;
  subtitle: string;
  bronze: string;
  silver: string;
  gold: string;
  compare: string;
  brand: string;
  footerCta: string;
};

function copyForLocale(locale: string): OgCopy {
  const root =
    locale === "es"
      ? esLeaveBehind.finalExpenseLeaveBehind
      : enLeaveBehind.finalExpenseLeaveBehind;
  const landing = root.landing;
  const subtitle = landing.heroSubtitle;
  return {
    eyebrow: landing.eyebrow,
    title: landing.heroTitle,
    highlight: landing.heroTitleHighlight,
    subtitle: subtitle.length > 118 ? `${subtitle.slice(0, 118)}…` : subtitle,
    bronze: landing.tierBronze,
    silver: landing.tierSilver,
    gold: landing.tierGold,
    compare: landing.tierCompare,
    brand: "Isaac Plans",
    footerCta: locale === "es" ? "Inicia sesión para crear" : "Sign in to create",
  };
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: SupportedLocale }>;
}) {
  const { locale } = await params;
  const copy = copyForLocale(locale);

  const cards = [
    { medal: TIER_MEDAL_URLS.bronze, label: copy.bronze, bg: "#4a2c18", border: "#c67d3e", rotate: -6, scale: 1 },
    { medal: TIER_MEDAL_URLS.silver, label: copy.silver, bg: "#2a3848", border: "#b4c2d4", rotate: 0, scale: 1.08 },
    { medal: TIER_MEDAL_URLS.gold, label: copy.gold, bg: "#4a3a10", border: "#d4af37", rotate: 6, scale: 1 },
  ] as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #060a12 0%, #0c1424 40%, #0f2744 70%, #060a12 100%)",
          padding: "56px 64px",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(56, 189, 248, 0.35)",
              background: "rgba(14, 165, 233, 0.12)",
              color: "#bae6fd",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {copy.eyebrow}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 22 }}>{copy.brand}</div>
        </div>

        <div style={{ display: "flex", flex: 1, gap: 48 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "#f8fafc",
                lineHeight: 1.15,
                marginBottom: 8,
              }}
            >
              {copy.title}
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                lineHeight: 1.15,
                marginBottom: 24,
                color: "#7dd3fc",
              }}
            >
              {copy.highlight}
            </div>
            <p style={{ fontSize: 22, color: "#94a3b8", lineHeight: 1.45, maxWidth: 520 }}>
              {copy.subtitle}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
              {cards.map((card) => (
                <div
                  key={card.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: 148,
                    padding: "16px 12px",
                    borderRadius: 14,
                    border: `2px solid ${card.border}`,
                    background: `linear-gradient(165deg, #120a06 0%, ${card.bg} 55%, #100806 100%)`,
                    transform: `rotate(${card.rotate}deg) scale(${card.scale})`,
                    boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.medal} width={48} height={48} alt="" />
                  <div
                    style={{
                      color: card.border,
                      fontSize: 16,
                      fontWeight: 700,
                      marginTop: 8,
                    }}
                  >
                    {card.label}
                  </div>
                  <div style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700, marginTop: 6 }}>
                    $15,000
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#060a12",
                color: "#64748b",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              + {copy.compare}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ color: "#64748b", fontSize: 18 }}>isaacplans.com</div>
          <div style={{ color: "#38bdf8", fontSize: 20, fontWeight: 600 }}>{copy.footerCta}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
