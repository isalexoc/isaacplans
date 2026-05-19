"use client";

import { forwardRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { LeaveBehindAgentProfile } from "@/lib/leave-behind-agent-profile";
import { AgentFooter } from "@/components/leave-behind/agent-footer";
import { formatCurrency } from "@/lib/leave-behind-money-input";
import type { LeaveBehindPlanType } from "@/lib/leave-behind-clients";
import type { ComparisonTier } from "@/lib/final-expense-leave-behind-tiers";
import { LEAVE_BEHIND_SINGLE_CARD_WIDTH } from "@/lib/leave-behind-assets";
import {
  TIER_LABEL_KEYS,
  TIER_MEDAL_URLS,
  TIER_THEMES,
} from "@/lib/final-expense-leave-behind-tiers";

export type SingleQuoteCardPreviewProps = {
  tier: ComparisonTier;
  prospectName: string;
  naturalNum: number;
  accidentalNum: number;
  premiumNum: number;
  premiumDisplay: string;
  totalCoverage: number;
  avoidList: string[];
  protectList: string[];
  planType: LeaveBehindPlanType;
  agentProfile: LeaveBehindAgentProfile;
  isDenseCard?: boolean;
  className?: string;
};

export const SingleQuoteCardPreview = forwardRef<HTMLDivElement, SingleQuoteCardPreviewProps>(
  function SingleQuoteCardPreview(
    {
      tier,
      prospectName,
      naturalNum,
      accidentalNum,
      premiumNum,
      premiumDisplay,
      totalCoverage,
      avoidList,
      protectList,
      planType,
      agentProfile,
      isDenseCard = false,
      className,
    },
    ref
  ) {
    const t = useTranslations("finalExpenseLeaveBehind");
    const tierTheme = TIER_THEMES[tier];
    const tierDisplayName = t(`phase1.${TIER_LABEL_KEYS[tier]}`);

    return (
      <div
        ref={ref}
        className={cn("mx-auto shrink-0", className)}
        style={{
          width: LEAVE_BEHIND_SINGLE_CARD_WIDTH,
          minWidth: LEAVE_BEHIND_SINGLE_CARD_WIDTH,
          maxWidth: LEAVE_BEHIND_SINGLE_CARD_WIDTH,
          background: tierTheme.cardGradient,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div
          className="flex w-full flex-col items-center gap-4 px-6 pb-8 pt-6 text-center"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        >
          <div className="flex w-full flex-col items-center gap-3">
            <img
              src={agentProfile.companyLogoUrl}
              alt=""
              width={280}
              height={84}
              crossOrigin="anonymous"
              className="mx-auto max-h-[84px] w-auto max-w-[280px] object-contain"
            />
            <div className="flex flex-row items-center justify-center gap-2.5 w-full max-w-[320px] mx-auto">
              <img
                src={TIER_MEDAL_URLS[tier]}
                alt=""
                width={48}
                height={48}
                crossOrigin="anonymous"
                className="object-contain h-12 w-12 shrink-0 select-none"
                draggable={false}
                aria-hidden
              />
              <p
                className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] leading-tight px-3 py-1.5 rounded-full min-w-0 text-center"
                style={{
                  color: tierTheme.accentHero,
                  border: `1px solid ${tierTheme.borderAccent}`,
                  backgroundColor: "rgba(0,0,0,0.22)",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {t("phase2.planTierBadge", { tier: tierDisplayName })}
              </p>
            </div>
            <div
              className="w-36 h-0.5 rounded-full"
              style={{ background: tierTheme.lineGradient }}
            />
            {prospectName.trim() && (
              <p
                className="w-full break-words leading-tight uppercase"
                style={{
                  color: "#faf6eb",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: isDenseCard ? "1.35rem" : "1.6rem",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                {prospectName.trim()}
              </p>
            )}
            <div className="space-y-3">
              <p
                className="text-base font-semibold uppercase tracking-[0.15em]"
                style={{
                  color: tierTheme.accent,
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "1.1rem",
                }}
              >
                {t("phase2.totalCoverage")}
              </p>
              <p
                className="font-bold tracking-tight leading-none"
                style={{
                  color: tierTheme.accentHero,
                  fontFamily: "system-ui, sans-serif",
                  fontSize: isDenseCard ? "2.75rem" : "3.25rem",
                }}
              >
                ${formatCurrency(totalCoverage)}
              </p>
              {premiumNum > 0 && (
                <p
                  className="text-xl font-normal leading-relaxed"
                  style={{ color: tierTheme.accentMuted, fontFamily: "system-ui, sans-serif" }}
                >
                  {t("phase2.smallPremiumOf")}{" "}
                  <span style={{ color: tierTheme.accentHero, fontWeight: 700 }}>
                    ${premiumDisplay || formatCurrency(premiumNum)}
                  </span>{" "}
                  {t("phase2.perMonth")}
                </p>
              )}
              <p
                className="text-white/95 leading-relaxed"
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: isDenseCard ? "1rem" : "1.25rem",
                }}
              >
                {t("phase2.naturalDeathLabel")}{" "}
                <span style={{ color: tierTheme.accent, fontWeight: 600 }}>
                  ${formatCurrency(naturalNum)}
                </span>{" "}
                {t("phase2.plusAccidental")}{" "}
                <span style={{ color: tierTheme.accent, fontWeight: 600 }}>
                  ${formatCurrency(accidentalNum)}
                </span>{" "}
                {t("phase2.ifAccidental")}
              </p>
              {(planType === "modified" || planType === "guaranteed") && (
                <p
                  className="text-sm font-medium leading-relaxed mt-2"
                  style={{ color: tierTheme.accent, fontFamily: "system-ui, sans-serif" }}
                >
                  {planType === "modified" ? t("phase2.rop2Years") : t("phase2.rop3Years")}
                </p>
              )}
            </div>
            {avoidList.length > 0 && (
              <div className="pt-3 w-full border-t" style={{ borderColor: tierTheme.borderAccent }}>
                <p
                  className="text-base font-semibold uppercase tracking-wider mb-2"
                  style={{ color: tierTheme.accent, fontFamily: "system-ui, sans-serif" }}
                >
                  {t("phase2.avoidPrefix")}
                </p>
                <p
                  className="w-full break-words font-medium text-white/95 leading-snug"
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: isDenseCard ? "1rem" : "1.25rem",
                  }}
                >
                  {avoidList.join(", ")}
                </p>
              </div>
            )}
            {protectList.length > 0 && (
              <div className="pt-3 w-full border-t" style={{ borderColor: tierTheme.borderAccent }}>
                <p
                  className="text-base font-semibold uppercase tracking-wider mb-2"
                  style={{ color: tierTheme.accent, fontFamily: "system-ui, sans-serif" }}
                >
                  {t("phase2.protectPrefix")}
                </p>
                <p
                  className="w-full break-words font-medium text-white/95 leading-snug"
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: isDenseCard ? "1rem" : "1.25rem",
                  }}
                >
                  {protectList.join(", ")}
                </p>
              </div>
            )}
          </div>
          <div
            className="w-full shrink-0 border-t pt-4 pb-1"
            style={{ borderColor: tierTheme.borderAccent }}
          >
            <AgentFooter profile={agentProfile} variant="card" />
          </div>
        </div>
      </div>
    );
  }
);
