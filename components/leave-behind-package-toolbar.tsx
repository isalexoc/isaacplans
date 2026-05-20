"use client";

import { FileImage, Eye, Loader2, Pencil, Plus, Save, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PackagePreviewAsset } from "@/lib/leave-behind-package";
import type { LeaveBehindAutosaveStatus } from "@/hooks/use-leave-behind-package-autosave";
import { COMPARISON_TIER_ORDER } from "@/lib/final-expense-leave-behind-tiers";

export type LeaveBehindPackageToolbarProps = {
  hasPreview: boolean;
  isEditing: boolean;
  previewAsset: PackagePreviewAsset;
  assetLabels: Record<PackagePreviewAsset, string>;
  isDownloading: boolean;
  isSharing: boolean;
  isSaving: boolean;
  autosaveStatus?: LeaveBehindAutosaveStatus;
  labels: {
    newQuote: string;
    editDetails: string;
    generatePreview: string;
    viewPreview: string;
    download: string;
    downloading: string;
    share: string;
    sharing: string;
    saveClient: string;
    saveNow: string;
    saving: string;
    autosaveSaving: string;
    autosaveSaved: string;
    autosaveError: string;
    draftLocal: string;
    previewImages: string;
  };
  onPreviewAssetChange: (asset: PackagePreviewAsset) => void;
  onNewQuote?: () => void;
  onEditDetails: () => void;
  onUpdatePreview: () => void;
  onDownload: () => void;
  onShare: () => void;
  onSave: () => void;
  saveMessage?: string | null;
  className?: string;
};

const ASSET_ORDER: PackagePreviewAsset[] = [...COMPARISON_TIER_ORDER, "compare"];

export function LeaveBehindPackageToolbar({
  hasPreview,
  isEditing,
  previewAsset,
  assetLabels,
  isDownloading,
  isSharing,
  isSaving,
  autosaveStatus = "idle",
  labels,
  onPreviewAssetChange,
  onNewQuote,
  onEditDetails,
  onUpdatePreview,
  onDownload,
  onShare,
  onSave,
  saveMessage,
  className,
}: LeaveBehindPackageToolbarProps) {
  const busy = isDownloading || isSharing || isSaving;
  const downloadLabel =
    previewAsset === "compare"
      ? labels.download
      : `${labels.download} (${assetLabels[previewAsset]})`;

  return (
    <div
      className={cn(
        "sticky top-16 z-20 -mx-1 space-y-3 rounded-xl border border-border/80 bg-background/95 p-3 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:top-20",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {onNewQuote && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onNewQuote}>
            <Plus className="h-4 w-4" />
            {labels.newQuote}
          </Button>
        )}

        {hasPreview && (
          <Button
            type="button"
            variant={isEditing ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={onEditDetails}
          >
            {isEditing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {isEditing ? labels.viewPreview : labels.editDetails}
          </Button>
        )}

        {!hasPreview && (
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-[#003366] text-white hover:bg-[#004080] hover:text-white"
            disabled={busy}
            onClick={onUpdatePreview}
          >
            <Sparkles className="h-4 w-4" />
            {labels.generatePreview}
          </Button>
        )}

        {hasPreview && !isEditing && (
          <>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-[#003366] text-white hover:bg-[#004080] hover:text-white"
              disabled={busy}
              onClick={onDownload}
            >
              <FileImage className="h-4 w-4" />
              {isDownloading ? labels.downloading : downloadLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={onShare}
            >
              <Share2 className="h-4 w-4" />
              {isSharing ? labels.sharing : labels.share}
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isSaving}
          onClick={onSave}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? labels.saving : labels.saveNow}
        </Button>
      </div>

      <p
        className={cn(
          "text-xs",
          autosaveStatus === "error"
            ? "text-red-600 dark:text-red-400"
            : autosaveStatus === "saved"
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-muted-foreground"
        )}
        role="status"
        aria-live="polite"
      >
        {autosaveStatus === "pending" && labels.autosaveSaving}
        {autosaveStatus === "saved" && labels.autosaveSaved}
        {autosaveStatus === "error" && labels.autosaveError}
        {autosaveStatus === "idle" && saveMessage}
        {autosaveStatus === "idle" && !saveMessage && labels.draftLocal ? labels.draftLocal : null}
      </p>

      {hasPreview && !isEditing && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.previewImages}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ASSET_ORDER.map((asset) => (
              <Button
                key={asset}
                type="button"
                size="sm"
                variant={previewAsset === asset ? "default" : "outline"}
                className={cn(
                  "h-8 text-xs",
                  previewAsset === asset && "bg-[#003366] text-white hover:bg-[#004080]"
                )}
                onClick={() => onPreviewAssetChange(asset)}
              >
                {assetLabels[asset]}
              </Button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
