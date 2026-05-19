"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/leave-behind-money-input";
import {
  LEAVE_BEHIND_COMPARE_MIN_HEIGHT,
  LEAVE_BEHIND_COMPARE_WIDTH,
} from "@/lib/leave-behind-assets";
import type { LeaveBehindAgentProfile } from "@/lib/leave-behind-agent-profile";
import { AgentFooter } from "@/components/leave-behind/agent-footer";
import type { LeaveBehindPlanType } from "@/lib/leave-behind-clients";
import type { ComparisonTier } from "@/lib/final-expense-leave-behind-tiers";
import {
  COMPARISON_TIER_ORDER,
  TIER_LABEL_KEYS,
  TIER_MEDAL_URLS,
  TIER_THEMES,
} from "@/lib/final-expense-leave-behind-tiers";
import { tierComputedFromInputs } from "@/lib/leave-behind-package";
import type { CompareTierInputs } from "@/lib/leave-behind-clients";

export type CompareQuotePreviewProps = {
  prospectName: string;
  tierInputs: Record<ComparisonTier, CompareTierInputs>;
  highlightTier: ComparisonTier;
  planType: LeaveBehindPlanType;
  planTypeLabel: string;
  avoidList: string[];
  protectList: string[];
  agentProfile: LeaveBehindAgentProfile;
};

export const CompareQuotePreview = forwardRef<HTMLDivElement, CompareQuotePreviewProps>(
  function CompareQuotePreview(
    {
      prospectName,
      tierInputs,
      highlightTier,
      planType,
      planTypeLabel,
      avoidList,
      protectList,
      agentProfile,
    },
    ref
  ) {
    const t = useTranslations("finalExpenseLeaveBehind");

    return (
      <div
        ref={ref}
        style={{
          width: LEAVE_BEHIND_COMPARE_WIDTH,
          minHeight: LEAVE_BEHIND_COMPARE_MIN_HEIGHT,
          boxSizing: "border-box",
          padding: "28px 32px 0",
          background: "linear-gradient(180deg, #05080f 0%, #0a1424 42%, #060a12 100%)",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          color: "#f4f4f5",
          overflow: "hidden",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <img
            src={agentProfile.companyLogoUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              display: "block",
              margin: "0 auto",
              maxHeight: 56,
              maxWidth: 380,
              width: "auto",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </div>
        {prospectName.trim() && (
          <p
            style={{
              textAlign: "center",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "rgba(244,244,245,0.9)",
              marginBottom: 8,
            }}
          >
            {t("compare.preparedFor")} {prospectName.trim()}
          </p>
        )}
        <p
          style={{
            textAlign: "center",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "0.03em",
            color: "#fafafa",
            marginBottom: 18,
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          {t("compare.comparisonHeadline")}
        </p>
        <div style={{ width: "100%", marginBottom: 24, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: "100%",
              maxWidth: 1000,
              padding: "18px 24px 20px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(0,0,0,0.32)",
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(212,168,75,0.95)",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              {t("compare.imagePlanTypeLabel")}
            </p>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.5,
                color: "rgba(250,250,250,0.95)",
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              {planTypeLabel}
            </p>
            {(planType === "modified" || planType === "guaranteed") && (
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "rgba(232,213,163,0.92)",
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                {planType === "modified" ? t("phase2.rop2Years") : t("phase2.rop3Years")}
              </p>
            )}
            {(avoidList.length > 0 || protectList.length > 0) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "18px 48px",
                  marginTop: 6,
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  paddingTop: 14,
                }}
              >
                {avoidList.length > 0 && (
                  <div style={{ textAlign: "center", maxWidth: 400 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "rgba(212,168,75,0.95)",
                        marginBottom: 6,
                      }}
                    >
                      {t("phase2.avoidPrefix")}
                    </p>
                    <p style={{ fontSize: 15, lineHeight: 1.5, color: "rgba(250,250,250,0.95)" }}>
                      {avoidList.join(", ")}
                    </p>
                  </div>
                )}
                {protectList.length > 0 && (
                  <div style={{ textAlign: "center", maxWidth: 400 }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "rgba(212,168,75,0.95)",
                        marginBottom: 6,
                      }}
                    >
                      {t("phase2.protectPrefix")}
                    </p>
                    <p style={{ fontSize: 15, lineHeight: 1.5, color: "rgba(250,250,250,0.95)" }}>
                      {protectList.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          {COMPARISON_TIER_ORDER.map((tier) => {
            const th = TIER_THEMES[tier];
            const inp = tierInputs[tier];
            const { naturalNum, accidentalNum, premiumNum, premiumDisplay, total } =
              tierComputedFromInputs(tier, inp);
            const highlighted = highlightTier === tier;
            const tierName = t(`phase1.${TIER_LABEL_KEYS[tier]}`);

            return (
              <div
                key={tier}
                style={{
                  position: "relative",
                  borderRadius: 12,
                  padding: "18px 14px 20px",
                  background: th.cardGradient,
                  border: highlighted
                    ? `3px solid ${th.accentHero}`
                    : `1px solid ${th.borderAccent}`,
                  boxShadow: highlighted
                    ? `0 0 0 2px rgba(255,255,255,0.1), 0 12px 28px rgba(0,0,0,0.45)`
                    : "0 6px 14px rgba(0,0,0,0.32)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                {highlighted && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: th.accentHero,
                      color: "#0a0a0a",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      padding: "5px 12px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("compare.selectedBadge")}
                  </div>
                )}
                <img
                  src={TIER_MEDAL_URLS[tier]}
                  alt=""
                  width={48}
                  height={48}
                  crossOrigin="anonymous"
                  style={{ objectFit: "contain", height: 48, width: 48, marginBottom: 10 }}
                  aria-hidden
                />
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: th.accentHero,
                    marginBottom: 12,
                  }}
                >
                  {tierName}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: th.accent,
                    marginBottom: 6,
                  }}
                >
                  {t("compare.totalCoverage")}
                </p>
                <p
                  style={{
                    fontSize: 34,
                    fontWeight: 800,
                    lineHeight: 1.05,
                    color: th.accentHero,
                    marginBottom: 12,
                  }}
                >
                  ${formatCurrency(total)}
                </p>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "rgba(250,250,250,0.92)",
                    marginBottom: 10,
                    width: "100%",
                  }}
                >
                  <span style={{ color: th.accent, fontWeight: 600 }}>{t("compare.naturalShort")}</span>{" "}
                  ${formatCurrency(naturalNum)}
                  <br />
                  <span style={{ color: th.accent, fontWeight: 600 }}>{t("compare.accidentalShort")}</span>{" "}
                  ${formatCurrency(accidentalNum)}
                </div>
                {premiumNum > 0 && (
                  <p style={{ fontSize: 14, lineHeight: 1.45, color: th.accentMuted, marginTop: "auto" }}>
                    {t("phase2.smallPremiumOf")}{" "}
                    <span style={{ color: th.accentHero, fontWeight: 700 }}>
                      ${premiumDisplay || formatCurrency(premiumNum)}
                    </span>{" "}
                    {t("compare.perMonth")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <AgentFooter profile={agentProfile} variant="compare" />
      </div>
    );
  }
);
