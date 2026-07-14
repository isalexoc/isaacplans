"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSaleSticker, fetchSaleStickers } from "@/lib/sale-sticker-api";
import type { SaleStickerRecord } from "@/lib/sale-sticker";

type Props = {
  selectedStickerId: string | null;
  onSelectSticker: (record: SaleStickerRecord) => void;
  onNewSticker: () => void;
  refreshKey: number;
};

export default function SaleStickerListPanel({
  selectedStickerId,
  onSelectSticker,
  onNewSticker,
  refreshKey,
}: Props) {
  const t = useTranslations("saleSticker.list");
  const [stickers, setStickers] = useState<SaleStickerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStickers(await fetchSaleStickers());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeletingId(id);
    try {
      await deleteSaleSticker(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/80 dark:bg-gray-950 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#003366] dark:text-sky-300">{t("title")}</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300">{t("description")}</p>
        </div>
        <Button type="button" variant="outline" className="shrink-0 gap-2" onClick={onNewSticker}>
          <Plus className="h-4 w-4" />
          {t("newSticker")}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      )}

      {error && !loading && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && stickers.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}

      {!loading && stickers.length > 0 && (
        <ul className="space-y-2">
          {stickers.map((sticker) => {
            const isSelected = sticker.id === selectedStickerId;
            const created = sticker.createdAt
              ? format(new Date(sticker.createdAt), "MMM d, yyyy")
              : "";
            return (
              <li
                key={sticker.id}
                className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  isSelected
                    ? "border-brand/50 bg-brand/5 dark:bg-brand/10"
                    : "border-border bg-card hover:border-brand/30"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    <span className="mr-2 inline-flex items-center rounded-full bg-[#003366] px-2 py-0.5 text-xs font-bold text-white dark:bg-sky-600">
                      #{sticker.dailySequence}
                    </span>
                    {sticker.clientName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`saleType.${sticker.saleType}`)}
                    {created ? ` · ${created}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "secondary" : "default"}
                    className="gap-1.5"
                    onClick={() => onSelectSticker(sticker)}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {t("open")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 shadow-sm"
                    disabled={deletingId === sticker.id}
                    onClick={() => handleDelete(sticker.id)}
                  >
                    {deletingId === sticker.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {t("delete")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
