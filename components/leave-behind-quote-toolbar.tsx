"use client";

import { FileImage, Eye, Loader2, Pencil, Plus, Save, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type LeaveBehindQuoteToolbarProps = {
  hasPreview: boolean;
  isEditing: boolean;
  canShare: boolean;
  isDownloading: boolean;
  isSharing: boolean;
  isSaving: boolean;
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
    saving: string;
  };
  onNewQuote?: () => void;
  onEditDetails: () => void;
  onUpdatePreview: () => void;
  onDownload: () => void;
  onShare: () => void;
  onSave: () => void;
  saveMessage?: string | null;
  className?: string;
};

export function LeaveBehindQuoteToolbar({
  hasPreview,
  isEditing,
  canShare,
  isDownloading,
  isSharing,
  isSaving,
  labels,
  onNewQuote,
  onEditDetails,
  onUpdatePreview,
  onDownload,
  onShare,
  onSave,
  saveMessage,
  className,
}: LeaveBehindQuoteToolbarProps) {
  const busy = isDownloading || isSharing || isSaving;

  return (
    <div
      className={cn(
        "sticky top-16 z-20 -mx-1 rounded-xl border border-border/80 bg-background/95 p-3 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-background/85 sm:top-20",
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
            {isEditing ? (
              <Eye className="h-4 w-4" />
            ) : (
              <Pencil className="h-4 w-4" />
            )}
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

        {hasPreview && (
          <>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-[#003366] text-white hover:bg-[#004080] hover:text-white"
              disabled={busy}
              onClick={onDownload}
            >
              <FileImage className="h-4 w-4" />
              {isDownloading ? labels.downloading : labels.download}
            </Button>
            {canShare && (
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
            )}
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
          {isSaving ? labels.saving : labels.saveClient}
        </Button>
      </div>
      {saveMessage && <p className="mt-2 text-sm text-muted-foreground">{saveMessage}</p>}
    </div>
  );
}
