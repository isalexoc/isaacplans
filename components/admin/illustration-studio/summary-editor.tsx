"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
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
import { useIllustrationSummaryAutosave, type SummarySaveStatus } from "@/hooks/use-illustration-summary-autosave";
import { deleteSummaryRequest, summaryPdfUrl } from "@/lib/illustration-studio/api";
import type { IllustrationSummaryRecord, PresentationData } from "@/lib/illustration-studio/types";
import CashValueEditor from "./cash-value-editor";
import IllustrationFacts from "./illustration-facts";
import LivingBenefitsEditor from "./living-benefits-editor";
import PdfPreview from "./pdf-preview";
import { ClientPolicySection, CoverSection, PremiumSection } from "./summary-fields";

function SaveStatus({ status, error, onRetry }: { status: SummarySaveStatus; error: string | null; onRetry: () => void }) {
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {error ?? "Couldn't save."}
        <button type="button" className="font-medium underline" onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "pending") return <span className="text-sm text-muted-foreground">Unsaved changes</span>;
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Check className="h-4 w-4 text-green-600" /> Saved
    </span>
  );
}

export default function SummaryEditor({ summary }: { summary: IllustrationSummaryRecord }) {
  const router = useRouter();
  const { id, extraction } = summary;
  const [p, setP] = useState<PresentationData>(summary.presentation);
  const { status, error, savedVersion, save } = useIllustrationSummaryAutosave(id, p);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const update = (patch: Partial<PresentationData>) => setP((prev) => ({ ...prev, ...patch }));

  /** Opens the tab inside the click (or it's a blocked pop-up), then points it at the PDF once saved. */
  async function present() {
    const tab = window.open("", "_blank");
    if (!(await save())) {
      tab?.close();
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = summaryPdfUrl(id);
    }
  }

  async function download() {
    if (!(await save())) return;
    const link = document.createElement("a");
    link.href = summaryPdfUrl(id, { download: true });
    link.click();
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSummaryRequest(id);
      router.push("/en/admin/illustration-studio");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't delete this summary.");
      setDeleting(false);
    }
  }

  const warnings = extraction.warnings;

  return (
    <div>
      <a
        href="/en/admin/illustration-studio"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All summaries
      </a>

      <div className="mb-5 mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{p.clientName.trim() || "Untitled summary"}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {[[p.carrierDisplayName, p.productName].filter(Boolean).join(" "), summary.sourceFileName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus status={status} error={error} onRetry={() => void save()} />
          <Button onClick={() => void present()}>
            <ExternalLink className="mr-1.5 h-4 w-4" /> Present
          </Button>
          <Button variant="outline" onClick={() => void download()}>
            <Download className="mr-1.5 h-4 w-4" /> Download
          </Button>
          <Button variant="ghost" size="icon" title="Delete" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              <p className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Check before presenting
              </p>
              <ul className="list-disc space-y-0.5 pl-5">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <ClientPolicySection p={p} update={update} />
          <PremiumSection p={p} extraction={extraction} update={update} />
          <CashValueEditor
            bars={p.cashValueBars}
            ledger={extraction.ledger}
            issueAge={extraction.insured.issueAge}
            onChange={(cashValueBars) => update({ cashValueBars })}
          />
          <LivingBenefitsEditor
            rows={p.livingBenefits}
            age={p.livingBenefitsAge}
            extraction={extraction}
            onChange={({ rows, age }) => update({ livingBenefits: rows, livingBenefitsAge: age })}
          />
          <CoverSection p={p} update={update} />
          <IllustrationFacts extraction={extraction} />
        </div>

        <div className="h-[85vh] lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:self-start">
          <PdfPreview id={id} version={savedVersion} />
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !deleting && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this summary?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits are removed for good. The carrier&apos;s illustration isn&apos;t affected — you can make a new
              summary from it any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
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
