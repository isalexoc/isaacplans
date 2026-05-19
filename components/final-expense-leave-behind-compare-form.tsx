"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LEAVE_BEHIND_PLAN_LABEL_DEFAULTS } from "@/lib/leave-behind-plan-labels";
import html2canvas from "html2canvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveLeaveBehindClient } from "@/lib/leave-behind-clients-api";
import type {
  CompareQuoteData,
  LeaveBehindClientRecord,
  LeaveBehindPlanType,
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
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ComparisonTier } from "@/lib/final-expense-leave-behind-tiers";
import {
  COMPARISON_CAPTURE_BG,
  COMPARISON_TIER_ORDER,
  TIER_LABEL_KEYS,
  TIER_MEDAL_URLS,
  TIER_THEMES,
} from "@/lib/final-expense-leave-behind-tiers";

const SENIOR_LIFE_LOGO =
  "https://res.cloudinary.com/isaacdev/image/upload/w_440,f_png/v1773060314/Full-Logo-Gold.144f1298_iluidv.png";
const ISAAC_BANNER =
  "https://res.cloudinary.com/isaacdev/image/upload/v1773068098/bfi_wi8szs.png";

const COMPARE_WIDTH = 1280;
const COMPARE_MIN_HEIGHT = 720;

function parseNames(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type TierInputs = { natural: string; accidental: string; premium: string };

function emptyTierInputs(): Record<ComparisonTier, TierInputs> {
  const empty: TierInputs = { natural: "", accidental: "", premium: "" };
  return { bronze: { ...empty }, silver: { ...empty }, gold: { ...empty } };
}

function normalizeTierInputs(
  raw?: Record<ComparisonTier, TierInputs> | null
): Record<ComparisonTier, TierInputs> {
  const base = emptyTierInputs();
  if (!raw) return base;
  for (const tier of COMPARISON_TIER_ORDER) {
    const block = raw[tier];
    if (!block) continue;
    const coverage = parseWholeDollarInput(block.natural || block.accidental || "");
    base[tier] = { natural: coverage, accidental: coverage, premium: block.premium ?? "" };
  }
  return base;
}

export type FinalExpenseLeaveBehindCompareFormProps = {
  clientId?: string | null;
  initialData?: CompareQuoteData | null;
  onClientSaved?: (client: LeaveBehindClientRecord) => void;
  onNewQuote?: () => void;
};

export default function FinalExpenseLeaveBehindCompareForm({
  clientId = null,
  initialData = null,
  onClientSaved,
  onNewQuote,
}: FinalExpenseLeaveBehindCompareFormProps) {
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
  const [tierInputs, setTierInputs] = useState<Record<ComparisonTier, TierInputs>>(
    normalizeTierInputs(initialData?.tierInputs)
  );
  const [highlightTier, setHighlightTier] = useState<ComparisonTier>(
    initialData?.highlightTier ?? "gold"
  );
  const [prospectName, setProspectName] = useState(initialData?.prospectName ?? "");
  const [planType, setPlanType] = useState<LeaveBehindPlanType>(() =>
    migrateLeaveBehindPlanType(initialData?.planType)
  );
  const [avoidNames, setAvoidNames] = useState(initialData?.avoidNames ?? "");
  const [protectNames, setProtectNames] = useState(initialData?.protectNames ?? "");
  const [tierErrors, setTierErrors] = useState<Partial<Record<ComparisonTier, string>>>({});

  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const updateTierCoverage = (tier: ComparisonTier, value: string) => {
    const coverage = parseWholeDollarInput(value);
    setTierInputs((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], natural: coverage, accidental: coverage },
    }));
  };

  const updateTierPremium = (tier: ComparisonTier, value: string) => {
    setTierInputs((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], premium: value },
    }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<ComparisonTier, string>> = {};
    for (const tier of COMPARISON_TIER_ORDER) {
      const inp = tierInputs[tier];
      const coverageNum = parseInt(parseWholeDollarInput(inp.natural), 10) || 0;
      if (!inp.natural.trim() || coverageNum < 1) {
        errs[tier] = t("compare.validationTier", {
          tier: t(`phase1.${TIER_LABEL_KEYS[tier]}`),
        });
      }
    }
    setTierErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGenerate = () => {
    if (!validate()) return;
    setHasPreview(true);
    setPhase(2);
    requestAnimationFrame(() => {
      document.getElementById("leave-behind-compare-preview")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleEditDetails = () => {
    if (phase === 1 && hasPreview) {
      setPhase(2);
      requestAnimationFrame(() => {
        document.getElementById("leave-behind-compare-preview")?.scrollIntoView({
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
    editDetails: t("compare.editButton"),
    viewPreview: t("workflow.viewPreview"),
    generatePreview: t("workflow.generatePreview"),
    download: t("compare.downloadButton"),
    downloading: t("compare.downloading"),
    share: t("compare.shareButton"),
    sharing: t("compare.sharing"),
    saveClient: t("clients.saveClient"),
    saving: t("clients.saving"),
  };

  const buildQuoteData = (): CompareQuoteData => ({
    prospectName,
    tierInputs,
    highlightTier,
    planType,
    avoidNames,
    protectNames,
    phase,
  });

  const handleSaveClient = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const client = await saveLeaveBehindClient({
        id: clientId,
        quoteType: "compare",
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
    if (!compareRef.current) return null;
    compareRef.current.scrollIntoView({ behavior: "auto", block: "center" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const images = compareRef.current.querySelectorAll<HTMLImageElement>("img");
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

    const canvas = await html2canvas(compareRef.current, {
      backgroundColor: COMPARISON_CAPTURE_BG,
      scale: 2,
      logging: false,
      useCORS: true,
      imageTimeout: 15000,
      windowWidth: Math.max(compareRef.current.scrollWidth, COMPARE_WIDTH),
      windowHeight: Math.max(compareRef.current.scrollHeight, COMPARE_MIN_HEIGHT),
    });

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
    });
  };

  const handleDownload = async () => {
    if (!compareRef.current) return;
    setIsDownloading(true);
    try {
      const blob = await captureImageAsBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `senior-life-plan-compare-${Date.now()}.png`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error("Error downloading comparison image:", error);
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
      const file = new File([blob], `senior-life-plan-compare-${Date.now()}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t("compare.shareTitle"),
          text: prospectName.trim()
            ? t("compare.shareTextPreparedFor", { name: prospectName.trim() })
            : t("compare.shareTextDefault"),
        });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing comparison image:", error);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const tierComputed = (tier: ComparisonTier) => {
    const inp = tierInputs[tier];
    const coverageNum = parseInt(parseWholeDollarInput(inp.natural), 10) || 0;
    const naturalNum = coverageNum;
    const accidentalNum = coverageNum;
    const premiumNum = parsePremiumAmount(inp.premium);
    const premiumDisplay = formatPremiumForQuote(inp.premium);
    return { naturalNum, accidentalNum, premiumNum, premiumDisplay, total: naturalNum + accidentalNum };
  };

  const avoidList = parseNames(avoidNames);
  const protectList = parseNames(protectNames);

  const planTypeDisplay = () => {
    switch (planType) {
      case "modified":
        return t("phase1.planModified", { default: planLabelFallback.planModified });
      case "guaranteed":
        return t("phase1.planGuaranteed", { default: planLabelFallback.planGuaranteed });
      default:
        return t("phase1.planPreferred", { default: planLabelFallback.planPreferred });
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
          id="leave-behind-compare-form"
          className="space-y-6 rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/80 dark:bg-gray-950 md:p-8"
        >
          <div>
            <h2 className="mb-2 text-2xl font-bold text-[#003366] dark:text-sky-300">{t("compare.phase1Title")}</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">{t("compare.phase1Description")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="compare-prospect" className="text-base text-foreground">
              {t("compare.prospectName")}
            </Label>
            <Input
              id="compare-prospect"
              type="text"
              placeholder={t("compare.prospectNamePlaceholder")}
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("compare.prospectNameHint")}</p>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200/90 p-4 dark:border-gray-700/90">
            <div>
              <h3 className="text-lg font-semibold text-[#003366] dark:text-sky-300">{t("compare.sharedDetailsTitle")}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("compare.sharedDetailsHint")}</p>
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
                  <RadioGroupItem value="preferred" id="cmp-plan-preferred" />
                  <Label htmlFor="cmp-plan-preferred" className="cursor-pointer font-normal text-foreground">
                    {t("phase1.planPreferred", {
                      default: planLabelFallback.planPreferred,
                    })}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="modified" id="cmp-plan-modified" />
                  <Label htmlFor="cmp-plan-modified" className="cursor-pointer font-normal text-foreground">
                    {t("phase1.planModified", {
                      default: planLabelFallback.planModified,
                    })}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="guaranteed" id="cmp-plan-guaranteed" />
                  <Label htmlFor="cmp-plan-guaranteed" className="cursor-pointer font-normal text-foreground">
                    {t("phase1.planGuaranteed", {
                      default: planLabelFallback.planGuaranteed,
                    })}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compare-avoid" className="text-foreground">
                {t("phase1.avoidNames")}
              </Label>
              <Input
                id="compare-avoid"
                type="text"
                placeholder={t("phase1.avoidNamesPlaceholder")}
                value={avoidNames}
                onChange={(e) => setAvoidNames(e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("phase1.avoidHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="compare-protect" className="text-foreground">
                {t("phase1.protectNames")}
              </Label>
              <Input
                id="compare-protect"
                type="text"
                placeholder={t("phase1.protectNamesPlaceholder")}
                value={protectNames}
                onChange={(e) => setProtectNames(e.target.value)}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("phase1.protectHint")}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base text-foreground">{t("compare.highlightLabel")}</Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("compare.highlightHint")}</p>
            <RadioGroup
              value={highlightTier}
              onValueChange={(v) => setHighlightTier(v as ComparisonTier)}
              className="grid gap-2 sm:grid-cols-3"
            >
              {COMPARISON_TIER_ORDER.map((tier) => (
                <div key={tier} className="flex items-center space-x-2">
                  <RadioGroupItem value={tier} id={`hl-${tier}`} />
                  <Label htmlFor={`hl-${tier}`} className="cursor-pointer font-normal text-foreground">
                    {t(`phase1.${TIER_LABEL_KEYS[tier]}`)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-8">
            {COMPARISON_TIER_ORDER.map((tier) => {
              const inp = tierInputs[tier];
              const err = tierErrors[tier];
              return (
                <div
                  key={tier}
                  className="space-y-4 rounded-lg border border-gray-200/90 p-4 dark:border-gray-700/90"
                  style={{
                    borderColor: err ? "rgba(239,68,68,0.5)" : undefined,
                  }}
                >
                  <h3 className="text-lg font-semibold text-[#003366] dark:text-sky-300">
                    {t("compare.tierBlockTitle", { tier: t(`phase1.${TIER_LABEL_KEYS[tier]}`) })}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <LeaveBehindWholeDollarField
                      id={`coverage-${tier}`}
                      label={
                        <Label className="text-foreground">{t("phase1.coverageAmount")}</Label>
                      }
                      placeholder={t("phase1.coverageAmountPlaceholder")}
                      value={inp.natural}
                      onChange={(v) => updateTierCoverage(tier, v)}
                    />
                    <LeaveBehindPremiumField
                      id={`premium-${tier}`}
                      label={
                        <Label className="text-foreground">{t("phase1.monthlyPremium")}</Label>
                      }
                      placeholder={t("phase1.monthlyPremiumPlaceholder")}
                      value={inp.premium}
                      onChange={(v) => updateTierPremium(tier, v)}
                    />
                  </div>
                  {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
                </div>
              );
            })}
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
          id="leave-behind-compare-preview"
          className={cn(
            "space-y-6",
            phase === 1 && "fixed left-[-10000px] top-0 w-[1280px] opacity-0 pointer-events-none"
          )}
          aria-hidden={phase === 1}
        >
          {phase === 2 && (
            <div className="max-w-xl mx-auto space-y-2">
            <Label htmlFor="compare-highlight-preview" className="text-sm font-medium text-foreground">
              {t("compare.highlightLabel")}
            </Label>
            <Select
              value={highlightTier}
              onValueChange={(v) => setHighlightTier(v as ComparisonTier)}
            >
              <SelectTrigger id="compare-highlight-preview" className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPARISON_TIER_ORDER.map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {t(`phase1.${TIER_LABEL_KEYS[tier]}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("compare.imageStyleHint")}</p>
            </div>
          )}

          <div className="w-full overflow-x-auto border border-gray-300/80 bg-muted/30 py-4 dark:border-gray-600/80">
            <div
              ref={compareRef}
              style={{
                width: COMPARE_WIDTH,
                minHeight: COMPARE_MIN_HEIGHT,
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
                  src={SENIOR_LIFE_LOGO}
                  alt="Senior Life Insurance Company"
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

              {/* Shared context — centered max width so content does not look stretched edge-to-edge */}
              <div
                style={{
                  width: "100%",
                  marginBottom: 24,
                  display: "flex",
                  justifyContent: "center",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 1000,
                    padding: "18px 24px 20px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(0,0,0,0.32)",
                    boxSizing: "border-box",
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
                      maxWidth: 820,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    {planTypeDisplay()}
                  </p>
                  {(planType === "modified" || planType === "guaranteed") && (
                    <p
                      style={{
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: "rgba(232,213,163,0.92)",
                        marginBottom: 12,
                        textAlign: "center",
                        maxWidth: 820,
                        marginLeft: "auto",
                        marginRight: "auto",
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
                        alignItems: "flex-start",
                        gap: "18px 48px",
                        marginTop: 6,
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                        paddingTop: 14,
                      }}
                    >
                      {avoidList.length > 0 && (
                        <div
                          style={{
                            textAlign: "center",
                            flex: "0 1 auto",
                            maxWidth: 400,
                            minWidth: 0,
                          }}
                        >
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
                        <div
                          style={{
                            textAlign: "center",
                            flex: "0 1 auto",
                            maxWidth: 400,
                            minWidth: 0,
                          }}
                        >
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
                  marginBottom: 0,
                }}
              >
                {COMPARISON_TIER_ORDER.map((tier) => {
                  const th = TIER_THEMES[tier];
                  const { naturalNum, accidentalNum, premiumNum, premiumDisplay, total } =
                    tierComputed(tier);
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
                        <span style={{ color: th.accent, fontWeight: 600 }}>{t("compare.naturalShort")}</span> $
                        {formatCurrency(naturalNum)}
                        <br />
                        <span style={{ color: th.accent, fontWeight: 600 }}>{t("compare.accidentalShort")}</span> $
                        {formatCurrency(accidentalNum)}
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

              {/* Footer: flex centers banner; image uses intrinsic aspect — never width 100% */}
              <div
                style={{
                  marginTop: 30,
                  marginLeft: -32,
                  marginRight: -32,
                  width: "calc(100% + 64px)",
                  padding: "22px 36px 26px",
                  backgroundColor: "#021428",
                  borderTop: "1px solid rgba(255,255,255,0.14)",
                  boxSizing: "border-box",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <img
                  src={ISAAC_BANNER}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    display: "block",
                    width: "auto",
                    height: "auto",
                    maxWidth: 1000,
                    maxHeight: 100,
                    objectFit: "contain",
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
