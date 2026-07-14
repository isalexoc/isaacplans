"use client";

import { Clapperboard, Download, Loader2, Plus, Save, Share2, Sparkles, Sticker } from "lucide-react";
import { Button } from "@/components/ui/button";

export type StickerToolbarLabels = {
  newSticker: string;
  save: string;
  saving: string;
  downloadImage: string;
  downloadingImage: string;
  downloadSticker: string;
  downloadingSticker: string;
  downloadAnimated: string;
  downloadingAnimated: string;
  downloadGif: string;
  downloadingGif: string;
  share: string;
  sharing: string;
};

export type StickerToolbarProps = {
  labels: StickerToolbarLabels;
  disabled: boolean;
  isSaving: boolean;
  isDownloadingImage: boolean;
  isDownloadingSticker: boolean;
  isDownloadingAnimated: boolean;
  isDownloadingGif: boolean;
  isSharing: boolean;
  saveMessage: string | null;
  onNew: () => void;
  onSave: () => void;
  onDownloadImage: () => void;
  onDownloadSticker: () => void;
  onDownloadAnimated: () => void;
  onDownloadGif: () => void;
  onShare: () => void;
};

export function StickerToolbar({
  labels,
  disabled,
  isSaving,
  isDownloadingImage,
  isDownloadingSticker,
  isDownloadingAnimated,
  isDownloadingGif,
  isSharing,
  saveMessage,
  onNew,
  onSave,
  onDownloadImage,
  onDownloadSticker,
  onDownloadAnimated,
  onDownloadGif,
  onShare,
}: StickerToolbarProps) {
  const busy =
    isSaving ||
    isDownloadingImage ||
    isDownloadingSticker ||
    isDownloadingAnimated ||
    isDownloadingGif ||
    isSharing;

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-3 shadow-sm dark:border-gray-700/80 dark:bg-gray-950">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="gap-1.5" onClick={onNew}>
          <Plus className="h-4 w-4" />
          {labels.newSticker}
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <Button
          type="button"
          className="gap-1.5 bg-[#003366] text-white hover:bg-[#004080] hover:text-white"
          disabled={disabled || busy}
          onClick={onDownloadImage}
        >
          {isDownloadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isDownloadingImage ? labels.downloadingImage : labels.downloadImage}
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="gap-1.5"
          disabled={disabled || busy}
          onClick={onDownloadSticker}
        >
          {isDownloadingSticker ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sticker className="h-4 w-4" />
          )}
          {isDownloadingSticker ? labels.downloadingSticker : labels.downloadSticker}
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="gap-1.5"
          disabled={disabled || busy}
          onClick={onDownloadAnimated}
        >
          {isDownloadingAnimated ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isDownloadingAnimated ? labels.downloadingAnimated : labels.downloadAnimated}
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="gap-1.5"
          disabled={disabled || busy}
          onClick={onDownloadGif}
        >
          {isDownloadingGif ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clapperboard className="h-4 w-4" />
          )}
          {isDownloadingGif ? labels.downloadingGif : labels.downloadGif}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          disabled={disabled || busy}
          onClick={onShare}
        >
          {isSharing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          {isSharing ? labels.sharing : labels.share}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {saveMessage ? (
            <span className="text-sm text-muted-foreground">{saveMessage}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5"
            disabled={disabled || busy}
            onClick={onSave}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? labels.saving : labels.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
