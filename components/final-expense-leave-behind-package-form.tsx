"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import html2canvas from "html2canvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { readLeaveBehindPackageDraft } from "@/lib/leave-behind-package-draft";
import { useLeaveBehindPackageAutosave } from "@/hooks/use-leave-behind-package-autosave";
import type {
  LeaveBehindClientRecord,
  LeaveBehindPlanType,
  PackageQuoteData,
} from "@/lib/leave-behind-clients";
import { migrateLeaveBehindPlanType } from "@/lib/leave-behind-clients";
import {
  LeaveBehindPremiumField,
  LeaveBehindWholeDollarField,
} from "@/components/leave-behind-money-input";
import { LEAVE_BEHIND_PLAN_LABEL_DEFAULTS } from "@/lib/leave-behind-plan-labels";
import {
  LEAVE_BEHIND_COMPARE_MIN_HEIGHT,
  LEAVE_BEHIND_COMPARE_WIDTH,
  LEAVE_BEHIND_SINGLE_CARD_WIDTH,
} from "@/lib/leave-behind-assets";
import {
  COMPARISON_CAPTURE_BG,
  COMPARISON_TIER_ORDER,
  TIER_LABEL_KEYS,
  TIER_THEMES,
  type ComparisonTier,
} from "@/lib/final-expense-leave-behind-tiers";
import {
  emptyPackageData,
  packageFilenameSlug,
  parseNames,
  tierComputedFromInputs,
  toPackageData,
  allTiersCompleteForCompare,
  isProspectNameComplete,
  isTierCoverageComplete,
  pickDefaultPackagePreviewAsset,
  validateForPreviewAsset,
  type PackagePreviewAsset,
} from "@/lib/leave-behind-package";
import { parseWholeDollarInput } from "@/lib/leave-behind-money-input";
import { LeaveBehindPackageToolbar } from "@/components/leave-behind-package-toolbar";
import { IncompletePreviewOverlay } from "@/components/leave-behind/incomplete-preview-overlay";
import { SingleQuoteCardPreview } from "@/components/leave-behind/single-quote-card-preview";
import { CompareQuotePreview } from "@/components/leave-behind/compare-quote-preview";
import { useLeaveBehindAgentProfile } from "@/components/leave-behind/leave-behind-agent-profile-context";
import { Button } from "@/components/ui/button";

export type FinalExpenseLeaveBehindPackageFormProps = {
  clientId?: string | null;
  initialData?: PackageQuoteData | null;
  onClientSaved?: (client: LeaveBehindClientRecord) => void;
  onNewQuote?: () => void;
  onRequireAgentProfile?: () => void;
};

export default function FinalExpenseLeaveBehindPackageForm({
  clientId = null,
  initialData = null,
  onClientSaved,
  onNewQuote,
  onRequireAgentProfile,
}: FinalExpenseLeaveBehindPackageFormProps) {
  const t = useTranslations("finalExpenseLeaveBehind");
  const { profile, isComplete: agentProfileComplete } = useLeaveBehindAgentProfile();
  const locale = useLocale();
  const planLabelFallback =
    LEAVE_BEHIND_PLAN_LABEL_DEFAULTS[locale === "es" ? "es" : "en"];

  const [data, setData] = useState<PackageQuoteData>(() =>
    initialData ? { ...initialData } : emptyPackageData()
  );
  const [phase, setPhase] = useState<1 | 2>(initialData?.phase ?? 1);
  const [hasPreview, setHasPreview] = useState((initialData?.phase ?? 1) === 2);
  const [showDraftHint, setShowDraftHint] = useState(false);
  const lastEditedTierRef = useRef<ComparisonTier>("bronze");
  const [previewAsset, setPreviewAsset] = useState<PackagePreviewAsset>(() =>
    initialData
      ? pickDefaultPackagePreviewAsset(initialData.tierInputs)
      : "bronze"
  );
  const [tierErrors, setTierErrors] = useState<Partial<Record<ComparisonTier, boolean>>>({});
  const [prospectNameError, setProspectNameError] = useState(false);
  const [validationKind, setValidationKind] = useState<"tier" | "compare" | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  const formSectionRef = useRef<HTMLDivElement>(null);
  const prospectFieldRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<ComparisonTier, HTMLDivElement | null>>({
    bronze: null,
    silver: null,
    gold: null,
  });
  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    if (initialData || clientId) return;
    const draft = readLeaveBehindPackageDraft();
    if (!draft) return;
    setData(draft);
    setPhase(draft.phase ?? 1);
    setHasPreview((draft.phase ?? 1) === 2);
    setPreviewAsset(pickDefaultPackagePreviewAsset(draft.tierInputs));
    setShowDraftHint(true);
  }, [initialData, clientId]);

  const avoidList = parseNames(data.avoidNames);
  const protectList = parseNames(data.protectNames);
  const detailCharCount =
    data.avoidNames.length + data.protectNames.length + data.prospectName.trim().length;
  const isDenseCard =
    detailCharCount > 100 ||
    avoidList.length + protectList.length > 4 ||
    avoidList.some((n) => n.length > 28) ||
    protectList.some((n) => n.length > 28);

  const planTypeLabel = useMemo(() => {
    switch (data.planType) {
      case "modified":
        return t("phase1.planModified", { default: planLabelFallback.planModified });
      case "guaranteed":
        return t("phase1.planGuaranteed", { default: planLabelFallback.planGuaranteed });
      default:
        return t("phase1.planPreferred", { default: planLabelFallback.planPreferred });
    }
  }, [data.planType, planLabelFallback, t]);

  const assetLabels = useMemo(
    (): Record<PackagePreviewAsset, string> => ({
      bronze: t("phase1.tierBronze"),
      silver: t("phase1.tierSilver"),
      gold: t("phase1.tierGold"),
      compare: t("package.compareImage"),
    }),
    [t]
  );

  const clearTierError = (tier: ComparisonTier) => {
    setTierErrors((prev) => {
      if (!prev[tier]) return prev;
      const next = { ...prev };
      delete next[tier];
      if (Object.keys(next).length === 0) setValidationKind(null);
      return next;
    });
  };

  const focusPreviewOnBestTier = useCallback(() => {
    setPreviewAsset(
      pickDefaultPackagePreviewAsset(data.tierInputs, lastEditedTierRef.current)
    );
  }, [data.tierInputs]);

  const updateTierCoverage = (tier: ComparisonTier, value: string) => {
    lastEditedTierRef.current = tier;
    clearTierError(tier);
    const coverage = parseWholeDollarInput(value);
    setData((prev) => ({
      ...prev,
      tierInputs: {
        ...prev.tierInputs,
        [tier]: { ...prev.tierInputs[tier], natural: coverage, accidental: coverage },
      },
    }));
  };

  const updateTierPremium = (tier: ComparisonTier, value: string) => {
    lastEditedTierRef.current = tier;
    setData((prev) => ({
      ...prev,
      tierInputs: {
        ...prev.tierInputs,
        [tier]: { ...prev.tierInputs[tier], premium: value },
      },
    }));
  };

  const compareReady = useMemo(
    () => allTiersCompleteForCompare(data.tierInputs),
    [data.tierInputs]
  );

  const scrollToFormIssue = (focusProspect?: boolean) => {
    setPhase(1);
    requestAnimationFrame(() => {
      if (focusProspect) {
        prospectFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById("pkg-prospect")?.focus();
      } else {
        formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const validateProspectNameField = (): boolean => {
    const ok = isProspectNameComplete(data.prospectName);
    setProspectNameError(!ok);
    return ok;
  };

  const validateAgentProfile = (): boolean => {
    if (agentProfileComplete && profile) return true;
    onRequireAgentProfile?.();
    return false;
  };

  const validateActiveAsset = (): boolean => {
    if (!validateAgentProfile()) return false;
    if (!validateProspectNameField()) {
      scrollToFormIssue(true);
      return false;
    }
    const errs = validateForPreviewAsset(previewAsset, data.tierInputs);
    setTierErrors(errs);
    setValidationKind(
      Object.keys(errs).length === 0 ? null : previewAsset === "compare" ? "compare" : "tier"
    );
    if (Object.keys(errs).length > 0) {
      scrollToFormIssue(false);
      return false;
    }
    return true;
  };

  const quoteData = useMemo<PackageQuoteData>(
    () => ({ ...data, phase }),
    [data, phase]
  );

  const handleClientSavedFromAutosave = useCallback(
    (client: LeaveBehindClientRecord) => {
      setShowDraftHint(false);
      onClientSaved?.(client);
    },
    [onClientSaved]
  );

  const { status: autosaveStatus, saveNow, isSaving } = useLeaveBehindPackageAutosave({
    clientId,
    quoteData,
    onClientSaved: handleClientSavedFromAutosave,
  });

  const handleGenerate = () => {
    setTierErrors({});
    setValidationKind(null);
    if (!validateAgentProfile()) return;
    if (!validateProspectNameField()) {
      scrollToFormIssue(true);
      return;
    }
    focusPreviewOnBestTier();
    setHasPreview(true);
    setPhase(2);
    requestAnimationFrame(() => {
      document.getElementById("leave-behind-package-preview")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleEditDetails = () => {
    if (phase === 1 && hasPreview) {
      if (!validateAgentProfile()) return;
      if (!validateProspectNameField()) {
        scrollToFormIssue(true);
        return;
      }
      focusPreviewOnBestTier();
      setPhase(2);
      requestAnimationFrame(() => {
        document.getElementById("leave-behind-package-preview")?.scrollIntoView({
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

  const handleSaveClient = async () => {
    if (!validateProspectNameField()) {
      scrollToFormIssue(true);
      return;
    }
    setSaveMessage(null);
    const ok = await saveNow();
    if (ok) {
      setShowDraftHint(false);
      setSaveMessage(t("clients.saved"));
    } else {
      setSaveMessage(t("clients.saveFailed"));
    }
  };

  const getCaptureElement = (): HTMLElement | null => {
    if (previewAsset === "compare") {
      return (
        compareRef.current ??
        document.getElementById("leave-behind-compare-capture")
      );
    }
    return cardRefs.current[previewAsset];
  };

  const captureImageAsBlob = async (): Promise<Blob | null> => {
    const el = getCaptureElement();
    if (!el) return null;
    el.scrollIntoView({ behavior: "auto", block: "center" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 50));

    const images = el.querySelectorAll<HTMLImageElement>("img");
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

    const isCompare = previewAsset === "compare";

    const canvas = await html2canvas(el, {
      backgroundColor: isCompare
        ? COMPARISON_CAPTURE_BG
        : TIER_THEMES[previewAsset].captureBg,
      scale: 2,
      logging: false,
      useCORS: true,
      imageTimeout: 15000,
      ...(isCompare
        ? {
            windowWidth: Math.max(el.scrollWidth, LEAVE_BEHIND_COMPARE_WIDTH),
            windowHeight: Math.max(el.scrollHeight, LEAVE_BEHIND_COMPARE_MIN_HEIGHT),
          }
        : {
            width: LEAVE_BEHIND_SINGLE_CARD_WIDTH,
            windowWidth: LEAVE_BEHIND_SINGLE_CARD_WIDTH,
            height: Math.ceil(el.getBoundingClientRect().height) || el.scrollHeight,
            windowHeight: Math.ceil(el.getBoundingClientRect().height) || el.scrollHeight,
          }),
    });

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
    });
  };

  const downloadSuffix =
    previewAsset === "compare" ? "compare" : `${previewAsset}-card`;

  const handleDownload = async () => {
    if (!validateActiveAsset()) return;
    setIsDownloading(true);
    try {
      const blob = await captureImageAsBlob();
      if (!blob) {
        console.error("Leave-behind download: capture returned no image");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = packageFilenameSlug(data.prospectName, downloadSuffix);
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error("Error downloading leave-behind image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!navigator.share) return;
    if (!validateActiveAsset()) return;
    setIsSharing(true);
    try {
      const blob = await captureImageAsBlob();
      if (!blob) return;
      const file = new File(
        [blob],
        packageFilenameSlug(data.prospectName, downloadSuffix),
        { type: "image/png" }
      );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title:
            previewAsset === "compare"
              ? t("compare.shareTitle")
              : t("phase2.shareTitle"),
          text: data.prospectName.trim()
            ? t("phase2.shareTextPreparedFor", { name: data.prospectName.trim() })
            : t("phase2.shareTextDefault"),
        });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing leave-behind image:", error);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const toolbarLabels = {
    newQuote: t("clients.newClient"),
    editDetails: t("package.editButton"),
    viewPreview: t("workflow.viewPreview"),
    generatePreview: t("workflow.generatePreview"),
    download: t("package.downloadImage"),
    downloading: t("package.downloading"),
    share: t("package.shareImage"),
    sharing: t("package.sharing"),
    saveClient: t("clients.saveClient"),
    saveNow: t("clients.saveNow"),
    saving: t("clients.saving"),
    autosaveSaving: t("clients.autosaveSaving"),
    autosaveSaved: t("clients.autosaveSaved"),
    autosaveError: t("clients.autosaveError"),
    draftLocal: showDraftHint ? t("clients.draftRestored") : "",
    previewImages: t("package.previewImages"),
  };

  const showForm = phase === 1 || !hasPreview;
  const previewHidden = phase === 1 && hasPreview;

  return (
    <div className="space-y-6">
      {!agentProfileComplete && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            {t("agentProfile.setupRequired")}
          </p>
          <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
            {t("agentProfile.setupRequiredHint")}
          </p>
          {onRequireAgentProfile && (
            <Button
              type="button"
              size="sm"
              className="mt-3 bg-[#003366] text-white hover:bg-[#004080] hover:text-white dark:bg-[#003366] dark:text-white"
              onClick={onRequireAgentProfile}
            >
              {t("agentProfile.setupCta")}
            </Button>
          )}
        </div>
      )}

      <LeaveBehindPackageToolbar
        hasPreview={hasPreview}
        isEditing={phase === 1 && hasPreview}
        previewAsset={previewAsset}
        assetLabels={assetLabels}
        canShare={canShare}
        isDownloading={isDownloading}
        isSharing={isSharing}
        isSaving={isSaving}
        autosaveStatus={autosaveStatus}
        labels={toolbarLabels}
        onPreviewAssetChange={setPreviewAsset}
        onNewQuote={onNewQuote}
        onEditDetails={handleEditDetails}
        onUpdatePreview={handleGenerate}
        onDownload={handleDownload}
        onShare={handleShare}
        onSave={handleSaveClient}
        saveMessage={saveMessage}
      />

      {showForm && (
        <div
          ref={formSectionRef}
          className="space-y-8 rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/80 dark:bg-gray-950 md:p-8"
        >
          <div>
            <h2 className="text-2xl font-bold text-[#003366] dark:text-sky-300">
              {t("package.title")}
            </h2>
            <p className="mt-1 text-gray-600 dark:text-gray-300">{t("package.description")}</p>
          </div>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-[#003366] dark:text-sky-300">
              {t("package.clientSection")}
            </h3>
            <div ref={prospectFieldRef} className="space-y-2">
              <Label htmlFor="pkg-prospect" className="text-base">
                {t("phase1.prospectName")}{" "}
                <span className="text-red-600 dark:text-red-400" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="pkg-prospect"
                value={data.prospectName}
                onChange={(e) => {
                  const value = e.target.value;
                  setData((p) => ({ ...p, prospectName: value }));
                  if (prospectNameError && isProspectNameComplete(value)) {
                    setProspectNameError(false);
                  }
                }}
                placeholder={t("phase1.prospectNamePlaceholder")}
                aria-invalid={prospectNameError}
                aria-describedby={prospectNameError ? "pkg-prospect-error" : "pkg-prospect-hint"}
                className={cn(prospectNameError && "border-red-500 focus-visible:ring-red-500")}
              />
              {prospectNameError ? (
                <p id="pkg-prospect-error" className="text-sm text-red-600 dark:text-red-400">
                  {t("validation.prospectNameRequired")}
                </p>
              ) : (
                <p id="pkg-prospect-hint" className="text-sm text-muted-foreground">
                  {t("phase1.prospectNameHint")}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-lg border border-border/80 bg-muted/20 p-4 md:p-6">
            <div>
              <h3 className="text-lg font-semibold text-[#003366] dark:text-sky-300">
                {t("package.tiersSection")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("package.tiersHint")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 pr-4 font-semibold text-foreground">{t("package.tierColumn")}</th>
                    <th className="pb-3 pr-4 font-semibold text-foreground">{t("phase1.coverageAmount")}</th>
                    <th className="pb-3 font-semibold text-foreground">{t("phase1.monthlyPremium")}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_TIER_ORDER.map((tier) => {
                    const inp = data.tierInputs[tier];
                    const hasErr = tierErrors[tier];
                    return (
                      <tr
                        key={tier}
                        className={cn(
                          "border-b border-border/60 align-top",
                          hasErr && "bg-red-50/50 dark:bg-red-950/20"
                        )}
                      >
                        <td className="py-4 pr-4">
                          <span className="font-semibold text-[#003366] dark:text-sky-300">
                            {t(`phase1.${TIER_LABEL_KEYS[tier]}`)}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <LeaveBehindWholeDollarField
                            id={`pkg-coverage-${tier}`}
                            label={<span className="sr-only">{t("phase1.coverageAmount")}</span>}
                            value={inp.natural}
                            onChange={(v) => updateTierCoverage(tier, v)}
                            placeholder={t("phase1.coverageAmountPlaceholder")}
                          />
                        </td>
                        <td className="py-4">
                          <LeaveBehindPremiumField
                            id={`pkg-premium-${tier}`}
                            label={<span className="sr-only">{t("phase1.monthlyPremium")}</span>}
                            value={inp.premium}
                            onChange={(v) => updateTierPremium(tier, v)}
                            placeholder={t("phase1.monthlyPremiumPlaceholder")}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {validationKind === "compare" && Object.keys(tierErrors).length > 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("package.tiersValidationCompare")}
              </p>
            )}
            {validationKind === "tier" && Object.keys(tierErrors).length > 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("package.tierValidation", {
                  tier: t(`phase1.${TIER_LABEL_KEYS[previewAsset as ComparisonTier]}`),
                })}
              </p>
            )}
          </section>

          <section className="space-y-4 rounded-lg border border-border/80 p-4 md:p-6">
            <h3 className="text-lg font-semibold text-[#003366] dark:text-sky-300">
              {t("package.sharedSection")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("package.sharedHint")}</p>

            <div className="space-y-3">
              <Label className="text-base">{t("phase1.planType")}</Label>
              <RadioGroup
                value={data.planType}
                onValueChange={(v) =>
                  setData((p) => ({ ...p, planType: v as LeaveBehindPlanType }))
                }
                className="grid gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="preferred" id="pkg-plan-preferred" />
                  <Label htmlFor="pkg-plan-preferred" className="cursor-pointer font-normal">
                    {t("phase1.planPreferred", { default: planLabelFallback.planPreferred })}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="modified" id="pkg-plan-modified" />
                  <Label htmlFor="pkg-plan-modified" className="cursor-pointer font-normal">
                    {t("phase1.planModified", { default: planLabelFallback.planModified })}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="guaranteed" id="pkg-plan-guaranteed" />
                  <Label htmlFor="pkg-plan-guaranteed" className="cursor-pointer font-normal">
                    {t("phase1.planGuaranteed", { default: planLabelFallback.planGuaranteed })}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-base">{t("compare.highlightLabel")}</Label>
              <Select
                value={data.highlightTier}
                onValueChange={(v) =>
                  setData((p) => ({ ...p, highlightTier: v as ComparisonTier }))
                }
              >
                <SelectTrigger className="w-full sm:max-w-xs">
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
              <p className="text-sm text-muted-foreground">{t("compare.highlightHint")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pkg-avoid">{t("phase1.avoidNames")}</Label>
                <Input
                  id="pkg-avoid"
                  value={data.avoidNames}
                  onChange={(e) => setData((p) => ({ ...p, avoidNames: e.target.value }))}
                  placeholder={t("phase1.avoidNamesPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-protect">{t("phase1.protectNames")}</Label>
                <Input
                  id="pkg-protect"
                  value={data.protectNames}
                  onChange={(e) => setData((p) => ({ ...p, protectNames: e.target.value }))}
                  placeholder={t("phase1.protectNamesPlaceholder")}
                />
              </div>
            </div>
          </section>

          {phase === 1 && hasPreview && (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {t("workflow.editingHint")}
            </p>
          )}
        </div>
      )}

      {hasPreview && profile && (
        <div
          id="leave-behind-package-preview"
          className={cn("space-y-4", previewHidden && "fixed left-[-10000px] top-0 opacity-0 pointer-events-none")}
          aria-hidden={previewHidden}
        >
          {phase === 2 && (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium text-foreground">{t("package.previewTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("package.previewHint")}</p>
            </div>
          )}

          <div
            className={cn(
              phase === 2 && previewAsset !== "compare" && "mx-auto max-w-sm max-h-[min(90vh,1400px)] overflow-y-auto",
              phase === 2 && previewAsset === "compare" && "w-full overflow-x-auto"
            )}
          >
            {COMPARISON_TIER_ORDER.map((tier) => {
              const inp = data.tierInputs[tier];
              const computed = tierComputedFromInputs(tier, inp);
              const visible = phase === 2 && previewAsset === tier;
              const tierComplete = isTierCoverageComplete(tier, data.tierInputs);
              return (
                <div
                  key={tier}
                  className={cn(
                    "mx-auto w-[360px] max-w-full",
                    !visible &&
                      "fixed left-[-10000px] top-0 opacity-0 pointer-events-none"
                  )}
                  aria-hidden={!visible}
                >
                  <IncompletePreviewOverlay
                    incomplete={visible && !tierComplete}
                    title={t("package.tierIncompleteTitle")}
                    hint={t("package.tierIncompleteHint")}
                  >
                    <SingleQuoteCardPreview
                      ref={(node) => {
                        cardRefs.current[tier] = node;
                      }}
                      tier={tier}
                      prospectName={data.prospectName}
                      naturalNum={computed.naturalNum}
                      accidentalNum={computed.accidentalNum}
                      premiumNum={computed.premiumNum}
                      premiumDisplay={computed.premiumDisplay}
                      totalCoverage={computed.total}
                      avoidList={avoidList}
                      protectList={protectList}
                      planType={data.planType}
                      agentProfile={profile}
                      isDenseCard={isDenseCard}
                    />
                  </IncompletePreviewOverlay>
                </div>
              );
            })}

            <div
              className={cn(
                phase === 2 &&
                  previewAsset !== "compare" &&
                  "fixed left-[-10000px] top-0 w-[1280px] opacity-0 pointer-events-none"
              )}
              aria-hidden={phase === 2 && previewAsset !== "compare"}
            >
              <IncompletePreviewOverlay
                incomplete={phase === 2 && previewAsset === "compare" && !compareReady}
                title={t("package.tierIncompleteTitle")}
                hint={t("package.compareRequiresAllTiers")}
                className="inline-block min-w-0"
              >
                <div className="border border-gray-300/80 bg-muted/30 py-4 dark:border-gray-600/80">
                  <CompareQuotePreview
                    id="leave-behind-compare-capture"
                    ref={(node) => {
                      compareRef.current = node;
                    }}
                    prospectName={data.prospectName}
                    tierInputs={data.tierInputs}
                    highlightTier={data.highlightTier}
                    planType={data.planType}
                    planTypeLabel={planTypeLabel}
                    avoidList={avoidList}
                    protectList={protectList}
                    agentProfile={profile}
                  />
                </div>
              </IncompletePreviewOverlay>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
