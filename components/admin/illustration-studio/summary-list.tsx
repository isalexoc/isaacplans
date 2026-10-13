"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteSummaryRequest, summaryPdfUrl } from "@/lib/illustration-studio/api";
import { getCarrier } from "@/lib/illustration-studio/carriers";
import { formatCurrency, PREMIUM_MODE_LABEL } from "@/lib/illustration-studio/format";
import type { IllustrationSummaryListItem } from "@/lib/illustration-studio/types";

function CarrierSwatch({ item }: { item: IllustrationSummaryListItem }) {
  const { theme } = getCarrier(item.carrierKey);
  return (
    <span
      aria-hidden
      className="h-9 w-1.5 shrink-0 rounded-full"
      style={{ background: `linear-gradient(${theme.pillars.dieTooSoon}, ${theme.pillars.liveTooLong}, ${theme.pillars.becomeIll})` }}
    />
  );
}

export default function SummaryList({ summaries }: { summaries: IllustrationSummaryListItem[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<IllustrationSummaryListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteSummaryRequest(pendingDelete.id);
      setPendingDelete(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this summary.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white dark:bg-gray-950">
      <div className="border-b px-4 py-3 text-sm font-semibold">Saved summaries</div>
      {summaries.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          No summaries yet. Drop an illustration above to make the first one.
        </div>
      ) : (
        <ul className="divide-y">
          {summaries.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-4">
              <CarrierSwatch item={item} />
              <a href={`/en/admin/illustration-studio/${item.id}`} className="group min-w-0 flex-1">
                <div className="truncate font-medium group-hover:underline">
                  {item.clientName || <span className="text-muted-foreground">No client name</span>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {[
                    [item.carrierDisplayName, item.productName].filter(Boolean).join(" "),
                    `${formatCurrency(item.premium.amount, true)} ${PREMIUM_MODE_LABEL[item.premium.mode]}`,
                    `${formatCurrency(item.deathBenefit)} death benefit`,
                    `edited ${new Date(item.updatedAt).toLocaleDateString()}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </a>
              <Button asChild variant="ghost" size="icon" title="Download PDF">
                <a href={summaryPdfUrl(item.id, { download: true })}>
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="ghost" size="icon" title="Open PDF">
                <a href={summaryPdfUrl(item.id)} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" title="Delete" onClick={() => setPendingDelete(item)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this summary?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.clientName || "This summary"} and your edits to it are removed for good.
              The carrier&apos;s illustration isn&apos;t affected — you can make a new summary from it any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
