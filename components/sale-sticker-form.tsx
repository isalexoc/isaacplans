"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useLeaveBehindAgentProfile } from "@/components/leave-behind/leave-behind-agent-profile-context";
import { agentDisplayName } from "@/lib/leave-behind-agent-profile";
import { resolveAgentCutoutUrl } from "@/lib/sale-sticker-cloudinary";
import { StickerPreview } from "@/components/sale-sticker/sticker-preview";
import { StickerPreviewFrame } from "@/components/sale-sticker/sticker-preview-frame";
import { StickerToolbar } from "@/components/sale-sticker/sticker-toolbar";
import {
  CLIENT_TITLES,
  LEAD_SOURCE_KEYS,
  MAX_PHRASE_CHARS,
  STICKER_LANGUAGES,
  SALE_TYPES,
  emptyStickerData,
  isStickerComplete,
  saleStickerFilenameSlug,
  todayLocalDateString,
  type LeadSourceKey,
  type SaleStickerData,
  type SaleStickerRecord,
} from "@/lib/sale-sticker";
import {
  fetchSaleStickers,
  requestAnimatedSticker,
  saveSaleSticker,
  uploadSaleStickerExtraImage,
} from "@/lib/sale-sticker-api";
import {
  clearSaleStickerDraft,
  readSaleStickerDraft,
  writeSaleStickerDraft,
} from "@/lib/sale-sticker-draft";
import {
  captureGifFrame,
  captureRichStickerPng,
  downloadStickerBlob,
  prepareStickerNode,
} from "@/lib/sale-sticker-capture";
import { STICKER_BG_FALLBACK } from "@/lib/sale-sticker-assets";
import { shareLeaveBehindPng } from "@/lib/leave-behind-share-image";

const ANIM_FRAMES = 12;
const ANIM_FPS = 12;

export type SaleStickerFormProps = {
  stickerId?: string | null;
  initialRecord?: SaleStickerRecord | null;
  onStickerSaved?: (record: SaleStickerRecord) => void;
  onNewSticker?: () => void;
  onRequireAgentProfile?: () => void;
};

export default function SaleStickerForm({
  stickerId = null,
  initialRecord = null,
  onStickerSaved,
  onNewSticker,
  onRequireAgentProfile,
}: SaleStickerFormProps) {
  const t = useTranslations("saleSticker");
  const { profile, isComplete: agentProfileComplete } = useLeaveBehindAgentProfile();

  const [data, setData] = useState<SaleStickerData>(() =>
    initialRecord
      ? {
          clientName: initialRecord.clientName,
          clientTitle: initialRecord.clientTitle,
          leadSource: initialRecord.leadSource,
          leadSourceCustom: initialRecord.leadSourceCustom,
          saleType: initialRecord.saleType,
          language: initialRecord.language,
          customPhrase: initialRecord.customPhrase,
          extraImageUrl: initialRecord.extraImageUrl,
          extraImagePublicId: initialRecord.extraImagePublicId,
        }
      : emptyStickerData()
  );

  const [savedId, setSavedId] = useState<string | null>(stickerId);
  const [committedSequence, setCommittedSequence] = useState<number | null>(
    initialRecord?.dailySequence ?? null
  );
  const [saleDate] = useState<string>(initialRecord?.saleDate ?? todayLocalDateString());
  const [todayCount, setTodayCount] = useState(0);

  const [clientNameError, setClientNameError] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [extraRemoveBg, setExtraRemoveBg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [isDownloadingGif, setIsDownloadingGif] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [animPhase, setAnimPhase] = useState(0);
  const [capturingGif, setCapturingGif] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const richRef = useRef<HTMLDivElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Restore a session draft for brand-new stickers only.
  useEffect(() => {
    if (initialRecord || stickerId) return;
    const draft = readSaleStickerDraft();
    if (draft) setData(draft);
  }, [initialRecord, stickerId]);

  // Persist a draft while composing an unsaved sticker.
  useEffect(() => {
    if (savedId) return;
    writeSaleStickerDraft(data);
  }, [data, savedId]);

  // Count today's sales for the provisional "#N" preview.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchSaleStickers();
        if (cancelled) return;
        const today = todayLocalDateString();
        setTodayCount(list.filter((s) => s.saleDate === today).length);
      } catch {
        // provisional number stays at 1
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displaySequence = committedSequence ?? todayCount + 1;

  const agentPhotoUrl = useMemo(
    () =>
      profile
        ? resolveAgentCutoutUrl(profile.profileImagePublicId, profile.profileImageUrl)
        : "",
    [profile]
  );
  // Filled headshot (not background-removed) for the round avatar on the die-cut sticker.
  const agentAvatarUrl = profile?.profileImageUrl ?? "";
  const companyLogoUrl = profile?.companyLogoUrl ?? "";
  const agentName = profile ? agentDisplayName(profile.firstName, profile.lastName) : "";

  const complete = isStickerComplete(data);

  const update = useCallback((patch: Partial<SaleStickerData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const validate = (): boolean => {
    if (!agentProfileComplete || !profile) {
      onRequireAgentProfile?.();
      return false;
    }
    if (!isStickerComplete(data)) {
      setClientNameError(!data.clientName.trim());
      return false;
    }
    return true;
  };

  /** Create the DB row (assigns the authoritative #N) or update an existing one. */
  const commitSticker = useCallback(async (): Promise<SaleStickerRecord | null> => {
    const record = await saveSaleSticker({ id: savedId, saleDate, data });
    setSavedId(record.id);
    setCommittedSequence(record.dailySequence);
    clearSaleStickerDraft();
    onStickerSaved?.(record);
    // Ensure the visible number reflects the committed value before capture.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return record;
  }, [savedId, saleDate, data, onStickerSaved]);

  const handleSave = async () => {
    if (!validate()) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await commitSticker();
      setSaveMessage(t("messages.saved"));
    } catch {
      setSaveMessage(t("messages.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExtraUpload = async (file: File) => {
    setUploadingExtra(true);
    try {
      const { url, publicId } = await uploadSaleStickerExtraImage(file, {
        removeBackground: extraRemoveBg,
      });
      update({ extraImageUrl: url, extraImagePublicId: publicId });
    } catch {
      toast({ title: t("form.extraUploadFailed"), variant: "destructive" });
    } finally {
      setUploadingExtra(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!validate()) return;
    setIsDownloadingImage(true);
    try {
      await commitSticker();
      const el = richRef.current;
      if (!el) return;
      const blob = await captureRichStickerPng(el, STICKER_BG_FALLBACK);
      if (!blob) {
        toast({ title: t("messages.captureFailed"), variant: "destructive" });
        return;
      }
      downloadStickerBlob(
        blob,
        saleStickerFilenameSlug(data.clientName, displaySequence, saleDate, "png")
      );
    } catch (error) {
      console.error("Error downloading sale sticker image:", error);
      toast({ title: t("messages.captureFailed"), variant: "destructive" });
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const handleDownloadGif = async () => {
    if (!validate()) return;
    setIsDownloadingGif(true);
    setCapturingGif(true); // enables the personal-image spin-in on the capture node
    try {
      await commitSticker();
      // Let the node re-render with the animated overlay before we preload/capture.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const el = richRef.current;
      if (!el) return;
      await prepareStickerNode(el);
      const frames: Blob[] = [];
      for (let i = 0; i < ANIM_FRAMES; i++) {
        setAnimPhase(i / ANIM_FRAMES);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const frame = await captureGifFrame(el, STICKER_BG_FALLBACK);
        if (frame) frames.push(frame);
      }
      setAnimPhase(0);
      if (frames.length < 2) {
        toast({ title: t("messages.captureFailed"), variant: "destructive" });
        return;
      }
      const gif = await requestAnimatedSticker(frames, ANIM_FPS, "gif");
      const name = saleStickerFilenameSlug(data.clientName, displaySequence, saleDate, "webp").replace(
        /\.webp$/,
        ".gif"
      );
      downloadStickerBlob(gif, name);
    } catch (error) {
      console.error("Error building animated GIF:", error);
      toast({ title: t("messages.animateFailed"), variant: "destructive" });
    } finally {
      setAnimPhase(0);
      setCapturingGif(false);
      setIsDownloadingGif(false);
    }
  };

  const handleShare = async () => {
    if (!validate()) return;
    setIsSharing(true);
    try {
      await commitSticker();
      const el = richRef.current;
      if (!el) return;
      const blob = await captureRichStickerPng(el, STICKER_BG_FALLBACK);
      if (!blob) {
        toast({ title: t("messages.captureFailed"), variant: "destructive" });
        return;
      }
      const filename = saleStickerFilenameSlug(data.clientName, displaySequence, saleDate, "png");
      const result = await shareLeaveBehindPng({
        blob,
        filename,
        title: t("share.title"),
        text: data.clientName.trim()
          ? t("share.textPreparedFor", { name: data.clientName.trim() })
          : t("share.textDefault"),
        downloadFallback: () => downloadStickerBlob(blob, filename),
      });
      if (result === "downloaded") {
        toast({ title: t("messages.shareDownloadedInstead") });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing sale sticker:", error);
        toast({ title: t("messages.shareFailed"), variant: "destructive" });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const toolbarLabels = {
    newSticker: t("toolbar.newSticker"),
    save: t("toolbar.save"),
    saving: t("toolbar.saving"),
    downloadImage: t("toolbar.downloadImage"),
    downloadingImage: t("toolbar.downloadingImage"),
    downloadGif: t("toolbar.downloadGif"),
    downloadingGif: t("toolbar.downloadingGif"),
    share: t("toolbar.share"),
    sharing: t("toolbar.sharing"),
  };

  return (
    <div className="space-y-6">
      {!agentProfileComplete && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            {t("profileRequired.title")}
          </p>
          <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
            {t("profileRequired.hint")}
          </p>
          {onRequireAgentProfile && (
            <Button
              type="button"
              size="sm"
              className="mt-3 bg-[#003366] text-white hover:bg-[#004080] hover:text-white"
              onClick={onRequireAgentProfile}
            >
              {t("profileRequired.cta")}
            </Button>
          )}
        </div>
      )}

      <StickerToolbar
        labels={toolbarLabels}
        disabled={!complete || !agentProfileComplete}
        isSaving={isSaving}
        isDownloadingImage={isDownloadingImage}
        isDownloadingGif={isDownloadingGif}
        isSharing={isSharing}
        saveMessage={saveMessage}
        onNew={() => onNewSticker?.()}
        onSave={handleSave}
        onDownloadImage={handleDownloadImage}
        onDownloadGif={handleDownloadGif}
        onShare={handleShare}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Form ── */}
        <div className="space-y-8 rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/80 dark:bg-gray-950 md:p-8">
          <div>
            <h2 className="text-2xl font-bold text-[#003366] dark:text-sky-300">
              {t("form.title")}
            </h2>
            <p className="mt-1 text-gray-600 dark:text-gray-300">{t("form.description")}</p>
            <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              {committedSequence
                ? t("form.numberCommitted", { n: displaySequence })
                : t("form.numberPreview", { n: displaySequence })}
            </p>
          </div>

          {/* Sale type */}
          <section className="space-y-3">
            <Label className="text-base">{t("form.saleTypeLabel")}</Label>
            <div className="grid grid-cols-2 gap-3">
              {SALE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update({ saleType: type })}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm font-semibold transition-colors",
                    data.saleType === type
                      ? "border-[#003366] bg-[#003366] text-white dark:border-sky-400 dark:bg-sky-500"
                      : "border-border bg-card text-foreground hover:border-[#003366]/40"
                  )}
                  aria-pressed={data.saleType === type}
                >
                  {t(`form.saleType.${type}` as const)}
                </button>
              ))}
            </div>
          </section>

          {/* Client name */}
          <section className="space-y-2">
            <Label htmlFor="sticker-client" className="text-base">
              {t("form.clientNameLabel")}{" "}
              <span className="text-red-600 dark:text-red-400" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="sticker-client"
              value={data.clientName}
              maxLength={60}
              onChange={(e) => {
                update({ clientName: e.target.value });
                if (clientNameError && e.target.value.trim()) setClientNameError(false);
              }}
              placeholder={t("form.clientNamePlaceholder")}
              aria-invalid={clientNameError}
              className={cn(clientNameError && "border-red-500 focus-visible:ring-red-500")}
            />
            {clientNameError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("form.clientNameRequired")}
              </p>
            )}
          </section>

          {/* Client title (Mr./Mrs. ↔ Sr./Sra.) */}
          <section className="space-y-3">
            <Label className="text-base">{t("form.clientTitleLabel")}</Label>
            <div className="inline-flex rounded-lg border border-border p-1">
              {CLIENT_TITLES.map((title) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => update({ clientTitle: title })}
                  className={cn(
                    "rounded-md px-5 py-1.5 text-sm font-semibold transition-colors",
                    data.clientTitle === title
                      ? "bg-[#003366] text-white dark:bg-sky-500"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={data.clientTitle === title}
                >
                  {t(`form.clientTitle.${title}` as const)}
                </button>
              ))}
            </div>
          </section>

          {/* Lead source */}
          <section className="space-y-2">
            <Label className="text-base">{t("form.leadSourceLabel")}</Label>
            <Select
              value={data.leadSource}
              onValueChange={(v) => update({ leadSource: v as LeadSourceKey })}
            >
              <SelectTrigger className="w-full sm:max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`form.leadSource.${key}` as const)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.leadSource === "other" && (
              <Input
                value={data.leadSourceCustom}
                maxLength={24}
                onChange={(e) => update({ leadSourceCustom: e.target.value })}
                placeholder={t("form.leadSourceCustomPlaceholder")}
                className="mt-2 sm:max-w-sm"
              />
            )}
          </section>

          {/* Sticker language */}
          <section className="space-y-3">
            <Label className="text-base">{t("form.languageLabel")}</Label>
            <div className="inline-flex rounded-lg border border-border p-1">
              {STICKER_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => update({ language: lang })}
                  className={cn(
                    "rounded-md px-5 py-1.5 text-sm font-semibold transition-colors",
                    data.language === lang
                      ? "bg-[#003366] text-white dark:bg-sky-500"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={data.language === lang}
                >
                  {t(`form.language.${lang}` as const)}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{t("form.languageHint")}</p>
          </section>

          {/* Optional phrase */}
          <section className="space-y-2">
            <Label htmlFor="sticker-phrase" className="text-base">
              {t("form.phraseLabel")}{" "}
              <span className="text-muted-foreground">({t("form.optional")})</span>
            </Label>
            <Input
              id="sticker-phrase"
              value={data.customPhrase}
              maxLength={MAX_PHRASE_CHARS}
              onChange={(e) => update({ customPhrase: e.target.value })}
              placeholder={t("form.phrasePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("form.phraseCounter", {
                count: data.customPhrase.length,
                max: MAX_PHRASE_CHARS,
              })}
            </p>
          </section>

          {/* Optional extra image */}
          <section className="space-y-3">
            <Label className="text-base">
              {t("form.extraImageLabel")}{" "}
              <span className="text-muted-foreground">({t("form.optional")})</span>
            </Label>
            <p className="text-xs text-muted-foreground">{t("form.extraImageHint")}</p>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {data.extraImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.extraImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-1 text-center text-[10px] text-muted-foreground">
                    {t("form.extraImagePlaceholder")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={extraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleExtraUpload(file);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingExtra}
                    onClick={() => extraInputRef.current?.click()}
                  >
                    {uploadingExtra ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {t("form.uploadExtraImage")}
                  </Button>
                  {data.extraImageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => update({ extraImageUrl: "", extraImagePublicId: "" })}
                    >
                      <X className="mr-1 h-4 w-4" />
                      {t("form.removeExtraImage")}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="extra-remove-bg"
                    checked={extraRemoveBg}
                    onCheckedChange={(v) => setExtraRemoveBg(v === true)}
                  />
                  <Label
                    htmlFor="extra-remove-bg"
                    className="cursor-pointer text-sm font-normal leading-snug"
                  >
                    {t("form.extraRemoveBg")}
                  </Label>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Live preview ── */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-foreground">{t("preview.title")}</p>
            <p className="text-sm text-muted-foreground">{t("preview.hint")}</p>
          </div>
          <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-xl shadow-lg">
            <StickerPreviewFrame>
              <StickerPreview
                data={data}
                dailySequence={displaySequence}
                saleDate={saleDate}
                agentPhotoUrl={agentPhotoUrl}
                agentAvatarUrl={agentAvatarUrl}
                companyLogoUrl={companyLogoUrl}
                agentName={agentName}
                variant="image"
              />
            </StickerPreviewFrame>
          </div>
        </div>
      </div>

      {/*
        Offscreen, native-size (unscaled) capture node. The on-screen preview is
        CSS-scaled to fit, which html2canvas mis-renders — so downloads are always
        captured from this full-size node instead.
      */}
      <div
        aria-hidden
        style={{ position: "fixed", left: -12000, top: 0, pointerEvents: "none" }}
      >
        <StickerPreview
          ref={richRef}
          data={data}
          dailySequence={displaySequence}
          saleDate={saleDate}
          agentPhotoUrl={agentPhotoUrl}
          agentAvatarUrl={agentAvatarUrl}
          companyLogoUrl={companyLogoUrl}
          agentName={agentName}
          variant="image"
          animationPhase={animPhase}
          animateExtra={capturingGif}
        />
      </div>
    </div>
  );
}
