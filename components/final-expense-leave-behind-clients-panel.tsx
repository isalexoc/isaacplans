"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteLeaveBehindClient,
  fetchLeaveBehindClients,
} from "@/lib/leave-behind-clients-api";
import {
  displayNameForClient,
  type LeaveBehindClientRecord,
  type LeaveBehindQuoteType,
} from "@/lib/leave-behind-clients";

type Props = {
  selectedClientId: string | null;
  onSelectClient: (client: LeaveBehindClientRecord) => void;
  onNewClient: () => void;
  refreshKey: number;
  onClientsChange?: (clients: LeaveBehindClientRecord[]) => void;
};

export default function FinalExpenseLeaveBehindClientsPanel({
  selectedClientId,
  onSelectClient,
  onNewClient,
  refreshKey,
  onClientsChange,
}: Props) {
  const t = useTranslations("finalExpenseLeaveBehind.clients");
  const [clients, setClients] = useState<LeaveBehindClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchLeaveBehindClients();
      setClients(list);
      onClientsChange?.(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [onClientsChange, t]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeletingId(id);
    try {
      await deleteLeaveBehindClient(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const typeLabel = (quoteType: LeaveBehindQuoteType) => {
    if (quoteType === "package") return t("typePackage");
    if (quoteType === "single") return t("typeSingle");
    return t("typeCompare");
  };

  return (
    <div className="space-y-6 rounded-xl border border-gray-200/80 bg-white p-6 shadow-lg dark:border-gray-700/80 dark:bg-gray-950 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#003366] dark:text-sky-300">{t("title")}</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300">{t("description")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          onClick={onNewClient}
        >
          <Plus className="h-4 w-4" />
          {t("newClient")}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && clients.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}

      {!loading && clients.length > 0 && (
        <ul className="space-y-2">
          {clients.map((client) => {
            const name = displayNameForClient(client.prospectName, client.quoteData);
            const isSelected = client.id === selectedClientId;
            const updated = client.updatedAt
              ? format(new Date(client.updatedAt), "MMM d, yyyy")
              : "";

            return (
              <li
                key={client.id}
                className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  isSelected
                    ? "border-brand/50 bg-brand/5 dark:bg-brand/10"
                    : "border-border bg-card hover:border-brand/30"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground">
                    {typeLabel(client.quoteType as LeaveBehindQuoteType)}
                    {updated ? ` · ${t("updated", { date: updated })}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "secondary" : "default"}
                    className="gap-1.5"
                    onClick={() => onSelectClient(client)}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {t("open")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 shadow-sm"
                    disabled={deletingId === client.id}
                    onClick={() => handleDelete(client.id)}
                  >
                    {deletingId === client.id ? (
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
