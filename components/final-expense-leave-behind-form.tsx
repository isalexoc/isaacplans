"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LEAVE_BEHIND_PLAN_LABEL_DEFAULTS } from "@/lib/leave-behind-plan-labels";
import html2canvas from "html2canvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveLeaveBehindClient } from "@/lib/leave-behind-clients-api";
import type {
  LeaveBehindClientRecord,
  LeaveBehindPlanType,
  SingleQuoteData,
} from "@/lib/leave-behind-clients";
import { migrateLeaveBehindPlanType } from "@/lib/leave-behind-clients";
import {
  LeaveBehindPremiumField,
  LeaveBehindWholeDollarField,
} from "@/components/leave-behind-money-input";
import {
  formatCurrency,
  formatPremiumForQuote,
  parsePremiumAmount,
  parseWholeDollarInput,
} from "@/lib/leave-behind-money-input";
import { LeaveBehindQuoteToolbar } from "@/components/leave-behind-quote-toolbar";
import { measureLeaveBehindSingleCardCapture } from "@/lib/leave-behind-capture";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PresentationTier } from "@/lib/final-expense-leave-behind-tiers";
import {
  TIER_LABEL_KEYS,
  TIER_MEDAL_URLS,
  TIER_THEMES,
} from "@/lib/final-expense-leave-behind-tiers";

export type { PresentationTier } from "@/lib/final-expense-leave-behind-tiers";

// 2x resolution (560px) for crisp html2canvas capture at 280px display
const SENIOR_LIFE_LOGO =
  "https://res.cloudinary.com/isaacdev/image/upload/w_560,f_png/v1773060314/Full-Logo-Gold.144f1298_iluidv.png";
// Isaac Orraiz banner - agent signature at bottom of quote
const ISAAC_BANNER =
  "https://res.cloudinary.com/isaacdev/image/upload/v1773068098/bfi_wi8szs.png";

function initialCoverageFromData(data?: SingleQuoteData | null): string {
  if (!data) return "";
  return parseWholeDollarInput(data.naturalDeath || data.accidentalDeath || "");
}

function parseNames(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type FinalExpenseLeaveBehindFormProps = {
  clientId?: string | null;
  initialData?: SingleQuoteData | null;
  onClientSaved?: (client: LeaveBehindClientRecord) => void;
  onNewQuote?: () => void;
};

export default function FinalExpenseLeaveBehindForm({
  clientId = null,
  initialData = null,
  onClientSaved,
  onNewQuote,
}: FinalExpenseLeaveBehindFormProps) {
  const t = useTranslations("finalExpenseLeaveBehind");
  const locale = useLocale();
  const planLabelFallback =
    LEAVE_BEHIND_PLAN_LABEL_DEFAULTS[locale === "es" ? "es" : "en"];
  const [phase, setPhase] = useState<1 | 2>(initialData?.phase ?? 1);
  const [hasPreview, setHasPreview] = useState((initialData?.phase ?? 1) === 2);
  const formSectionRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [prospectName, setProspectName] = useState(initialData?.prospectName ?? "");
  const [coverageAmount, setCoverageAmount] = useState(() =>
    initialCoverageFromData(initialData)
  );
  const [monthlyPremium, setMonthlyPremium] = useState(initialData?.monthlyPremium ?? "");
  const [avoidNames, setAvoidNames] = useState(initialData?.avoidNames ?? "");
  const [protectNames, setProtectNames] = useState(initialData?.protectNames ?? "");
  const [planType, setPlanType] = useState<LeaveBehindPlanType>(() =>
    migrateLeaveBehindPlanType(initialData?.planType)
  );
  const [presentationTier, setPresentationTier] = useState<PresentationTier>(
    initialData?.presentationTier ?? "gold"
  );

  const imageRef = useRef<HTMLDivElement>(null);
  const tierTheme = TIER_THEMES[presentationTier];
  const tierDisplayName = t(`phase1.${TIER_LABEL_KEYS[presentationTier]}`);

  const coverageNum = parseInt(parseWholeDollarInput(coverageAmount), 10) || 0;
  const naturalNum = coverageNum;
  const accidentalNum = coverageNum;
  const premiumNum = parsePremiumAmount(monthlyPremium);
  const totalCoverage = naturalNum + accidentalNum;
  const premiumDisplay = formatPremiumForQuote(monthlyPremium);
  const avoidList = parseNames(avoidNames);
  const protectList = parseNames(protectNames);

  const detailCharCount =
    avoidNames.length + protectNames.length + prospectName.trim().length;
  const isDenseCard =
    detailCharCount > 100 ||
    avoidList.length + protectList.length > 4 ||
    avoidList.some((n) => n.length > 28) ||
    protectList.some((n) => n.length > 28);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!coverageAmount.trim() || coverageNum < 1) {
      errs.coverage = t("validation.coverageRequired");
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGenerate = () => {
    if (!validate()) return;
    setHasPreview(true);
    setPhase(2);
    requestAnimationFrame(() => {
      document.getElementById("leave-behind-single-preview")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleEditDetails = () => {
    if (phase === 1 && hasPreview) {
      setPhase(2);
      requestAnimationFrame(() => {
        document.getElementById("leave-behind-single-preview")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }
    setPhase(1);
    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const toolbarLabels = {
    newQuote: t("clients.newClient"),
    editDetails: t("phase2.editButton"),
    viewPreview: t("workflow.viewPreview"),
    generatePreview: t("workflow.generatePreview"),
    download: t("phase2.downloadButton"),
    downloading: t("phase2.downloading"),
    share: t("phase2.shareButton"),
    sharing: t("phase2.sharing"),
    saveClient: t("clients.saveClient"),
    saving: t("clients.saving"),
  };

  const buildQuoteData = (): SingleQuoteData => ({
    prospectName,
    naturalDeath: coverageAmount,
    accidentalDeath: coverageAmount,
    monthlyPremium,
    avoidNames,
    protectNames,
    planType,
    presentationTier,
    phase,
  });

  const handleSaveClient = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const client = await saveLeaveBehindClient({
        id: clientId,
        quoteType: "single",
        prospectName: prospectName.trim() || null,
        quoteData: buildQuoteData(),
      });
      onClientSaved?.(client);
      setSaveMessage(t("clients.saved"));
    } catch {
      setSaveMessage(t("clients.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const captureImageAsBlob = async (): Promise<Blob | null> => {
    if (!imageRef.current) return null;
    imageRef.current.scrollIntoView({ behavior: "auto", block: "center" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 50));

    const images = imageRef.current.querySelectorAll<HTMLImageElement>("img");
    await Promise.all(
      Array.from(images).map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 5000);
          })
      )
    );

    const el = imageRef.current;
    const { width: captureWidth, height: captureHeight } = measureLeaveBehindSingleCardCapture(el);

    const canvas = await html2canvas(el, {
      backgroundColor: tierTheme.captureBg,
      scale: 2,
      logging: false,
      useCORS: true,
      imageTimeout: 15000,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
    });

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        "image/png",
        1.0
      );
    });
  };

  const handleDownload = async () => {
    if (!imageRef.current) return;
    setIsDownloading(true);
    try {
      const blob = await captureImageAsBlob();
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `senior-life-quote-${Date.now()}.png`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error("Error downloading image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!navigator.share) return;
    setIsSharing(true);
    try {
      const blob = await captureImageAsBlob();
      if (!blob) return;

      const file = new File([blob], `senior-life-quote-${Date.now()}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t("phase2.shareTitle"),
          text: prospectName.trim()
            ? t("phase2.shareTextPreparedFor", { name: prospectName.trim() })
            : t("phase2.shareTextDefault"),
        });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing image:", error);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6">
      <LeaveBehindQuoteToolbar
        hasPreview={hasPreview}
        isEditing={phase === 1 && hasPreview}
        canShare={canShare}
        isDownloading={isDownloading}
        isSharing={isSharing}
        isSaving={isSaving}
        labels={toolbarLabels}
        onNewQuote={onNewQuote}
        onEditDetails={handleEditDetails}
        onUpdatePreview={handleGenerate}
        onDownload={handleDownload}
        onShare={handleShare}
        onSave={handleSaveClient}
        saveMessage={saveMessage}
      />

      {(phase === 1 || !hasPreview) && (
        <div
          ref={formSectionRef}
          id="leave-behind-single-form"
          className="space-y-6 rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/80 dark:bg-gray-950 md:p-8"
        >
          <div>
            <h2 className="mb-2 text-2xl font-bold text-[#003366] dark:text-sky-300">
              {t("phase1.title")}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">{t("phase1.description")}</p>
          </div>

          <div className="grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="prospectName" className="text-base text-foreground">
                {t("phase1.prospectName")}
              </Label>
              <Input
                id="prospectName"
                type="text"
                placeholder={t("phase1.prospectNamePlaceholder")}
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("phase1.prospectNameHint")}</p>
            </div>

            <LeaveBehindWholeDollarField
              id="coverage"
              label={
                <Label htmlFor="coverage" className="text-base text-foreground">
                  {t("phase1.coverageAmount")}
                </Label>
              }
              hint={
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("phase1.coverageHint")}</p>
              }
              placeholder={t("phase1.coverageAmountPlaceholder")}
              value={coverageAmount}
              onChange={setCoverageAmount}
              error={errors.coverage}
            />

            <LeaveBehindPremiumField
              id="premium"
              label={
                <Label htmlFor="premium" className="text-base text-foreground">
                  {t("phase1.monthlyPremium")}
                </Label>
              }
              hint={
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("phase1.monthlyPremiumHint")}</p>
              }
              placeholder={t("phase1.monthlyPremiumPlaceholder")}
              value={monthlyPremium}
              onChange={setMonthlyPremium}
            />

            <div className="space-y-2">
              <Label htmlFor="avoid" className="text-base">{t("phase1.avoidNames")}</Label>
              <Input
                id="avoid"
                type="text"
                placeholder={t("phase1.avoidNamesPlaceholder")}
                value={avoidNames}
                onChange={(e) => setAvoidNames(e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("phase1.avoidHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="protect" className="text-foreground">
                {t("phase1.protectNames")}
              </Label>
              <Input
                id="protect"
                type="text"
                placeholder={t("phase1.protectNamesPlaceholder")}
                value={protectNames}
                onChange={(e) => setProtectNames(e.target.value)}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("phase1.protectHint")}</p>
            </div>

            <div className="space-y-3">
              <Label className="text-base text-foreground">{t("phase1.planType")}</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("phase1.planTypeHint")}</p>
              <RadioGroup
                value={planType}
                onValueChange={(v) => setPlanType(v as typeof planType)}
                className="grid gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="preferred" id="plan-preferred" />
                  <Label htmlFor="plan-preferred" className="cursor-pointer font-normal text-foreground">
                    {t("phase1.planPreferred", { default: planLabelFallback.planPreferred })}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="modified" id="plan-modified" />
                  <Label htmlFor="plan-modified" className="cursor-pointer font-normal text-foreground">
                    {t("phase1.planModified", { default: planLabelFallback.planModified })}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="guaranteed" id="plan-guaranteed" />
                  <Label htmlFor="plan-guaranteed" className="cursor-pointer font-normal text-foreground">
                    {t("phase1.planGuaranteed", { default: planLabelFallback.planGuaranteed })}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="presentation-tier" className="text-base text-foreground">
                {t("phase1.presentationTier")}
              </Label>
              <Select
                value={presentationTier}
                onValueChange={(v) => setPresentationTier(v as PresentationTier)}
              >
                <SelectTrigger id="presentation-tier" className="w-full sm:max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bronze">{t("phase1.tierBronze")}</SelectItem>
                  <SelectItem value="silver">{t("phase1.tierSilver")}</SelectItem>
                  <SelectItem value="gold">{t("phase1.tierGold")}</SelectItem>
                  <SelectItem value="platinum">{t("phase1.tierPlatinum")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("phase1.presentationTierHint")}</p>
            </div>
          </div>

          {phase === 1 && hasPreview && (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {t("workflow.editingHint")}
            </p>
          )}
        </div>
      )}

      {hasPreview && (
        <div
          id="leave-behind-single-preview"
          className={cn("space-y-6", phase === 1 && "fixed left-[-10000px] top-0 w-[360px] opacity-0 pointer-events-none")}
          aria-hidden={phase === 1}
        >
          {phase === 2 && (
            <div className="max-w-sm mx-auto space-y-3">
            <div className="space-y-2">
              <Label htmlFor="presentation-tier-preview" className="text-sm font-medium text-foreground">
                {t("phase2.imageTierLabel")}
              </Label>
              <Select
                value={presentationTier}
                onValueChange={(v) => setPresentationTier(v as PresentationTier)}
              >
                <SelectTrigger id="presentation-tier-preview" className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bronze">{t("phase1.tierBronze")}</SelectItem>
                  <SelectItem value="silver">{t("phase1.tierSilver")}</SelectItem>
                  <SelectItem value="gold">{t("phase1.tierGold")}</SelectItem>
                  <SelectItem value="platinum">{t("phase1.tierPlatinum")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            </div>
          )}

          <div
            className={cn(
              "mx-auto max-w-sm",
              phase === 2 && "max-h-[min(90vh,1400px)] overflow-y-auto rounded-xl"
            )}
          >
          <div
            ref={imageRef}
            className="mx-auto w-[360px] max-w-full"
            style={{
              background: tierTheme.cardGradient,
              boxSizing: "border-box",
            }}
          >
            <div
              className="flex w-full flex-col items-center gap-4 px-6 py-6 text-center"
              style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
              }}
            >
              {/* Main quote content */}
              <div className="flex w-full flex-col items-center gap-3">
                <img
                  src={SENIOR_LIFE_LOGO}
                  alt="Senior Life Insurance Company"
                  width={280}
                  height={84}
                  crossOrigin="anonymous"
                  className="object-contain"
                />

                <div className="flex flex-row items-center justify-center gap-2.5 w-full max-w-[320px] mx-auto">
                  <img
                    src={TIER_MEDAL_URLS[presentationTier]}
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

              {/* Decorative accent line */}
              <div
                className="w-36 h-0.5 rounded-full"
                style={{ background: tierTheme.lineGradient }}
              />

              {/* Prospect name - soft cream, always uppercase */}
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

              {/* Total coverage - hero, large & clear for seniors */}
              <div className="space-y-3">
                <p
                  className="text-base font-semibold uppercase tracking-[0.15em]"
                  style={{ color: tierTheme.accent, fontFamily: "system-ui, sans-serif", fontSize: "1.1rem" }}
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
                <div
                  className="pt-3 w-full border-t"
                  style={{ borderColor: tierTheme.borderAccent }}
                >
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
                <div
                  className="pt-3 w-full border-t"
                  style={{ borderColor: tierTheme.borderAccent }}
                >
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

              {/* Agent banner - Isaac Orraiz signature at bottom */}
              <div
                className="w-full shrink-0 border-t pt-4"
                style={{ borderColor: tierTheme.borderAccent }}
              >
                <img
                  src={ISAAC_BANNER}
                  alt="Isaac Orraiz - Senior Life"
                  width={360}
                  height={120}
                  crossOrigin="anonymous"
                  className="block w-full h-auto object-contain object-center"
                />
              </div>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
