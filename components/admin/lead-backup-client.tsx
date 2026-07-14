"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ImageUp,
  Info,
  Loader2,
  ScanLine,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Fields = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  leadType: string;
  leadId: string;
  purchaseDate: string;
  purchasePrice: string;
};

const EMPTY: Fields = {
  firstName: "", lastName: "", phone: "", email: "", address1: "", city: "", state: "",
  postalCode: "", dateOfBirth: "", leadType: "", leadId: "", purchaseDate: "", purchasePrice: "",
};

const FIELD_LAYOUT: { key: keyof Fields; label: string; required?: boolean; span2?: boolean }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "phone", label: "Phone", required: true },
  { key: "email", label: "Email" },
  { key: "address1", label: "Street address", span2: true },
  { key: "city", label: "City" },
  { key: "state", label: "State (2-letter)" },
  { key: "postalCode", label: "ZIP" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "leadType", label: "Lead type / source" },
  { key: "leadId", label: "Lead ID" },
  { key: "purchaseDate", label: "Purchase date" },
  { key: "purchasePrice", label: "Purchase price" },
];

type SubmitResult = {
  success: boolean;
  error?: string;
  alreadyProcessed?: boolean;
  existingStatus?: string | null;
  processed?: boolean;
  ok?: boolean;
  reason?: string | null;
  contactId?: string | null;
};

type Step = "upload" | "review" | "done";

export default function LeadBackupClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const phoneMissing = !fields.phone.replace(/\D/g, "") || fields.phone.replace(/\D/g, "").length < 10;

  function pickFile(f: File | null) {
    if (!f) return;
    setError(null);
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/lead-backup/extract", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Could not read the screenshot.");
        return;
      }
      setFields({ ...EMPTY, ...(data.parsed as Partial<Fields>) });
      setStep("review");
    } catch {
      setError("Network error while reading the screenshot.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit() {
    if (phoneMissing) {
      setError("A valid 10-digit phone number is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/lead-backup/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed: fields }),
      });
      const data = (await res.json()) as SubmitResult;
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to process the lead.");
        return;
      }
      setResult(data);
      setStep("done");
    } catch {
      setError("Network error while sending the lead.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep("upload");
    setFile(null);
    setPreviewUrl(null);
    setFields(EMPTY);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ScanLine className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Backup</h1>
          <p className="text-sm text-muted-foreground">
            Manually process a Senior Life lead from a screenshot when the confirmation email didn&apos;t arrive.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Upload the lead screenshot</CardTitle>
            <CardDescription>
              Upload a clear screenshot of the &quot;Detalles de Lead&quot; screen. The details are read with AI,
              and you&apos;ll review them before anything is sent to the CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
            >
              <ImageUp className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {file ? "Choose a different screenshot" : "Click to choose a screenshot"}
              </span>
              <span className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 10 MB</span>
            </button>

            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Lead screenshot preview"
                className="mx-auto max-h-72 w-auto rounded-lg border border-border"
              />
            )}

            <Button
              type="button"
              className="w-full gap-2"
              disabled={!file || extracting}
              onClick={handleExtract}
            >
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              {extracting ? "Reading lead…" : "Read lead from screenshot"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Review &amp; correct the details</CardTitle>
            <CardDescription>
              Check every field against the screenshot and fix any misreads. On confirm, this creates/updates
              the contact in GoHighLevel and applies the Senior Life tags — exactly like an emailed lead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Lead screenshot"
                className="mx-auto max-h-56 w-auto rounded-lg border border-border"
              />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELD_LAYOUT.map(({ key, label, required, span2 }) => (
                <div key={key} className={`space-y-1.5 ${span2 ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor={`ltw-${key}`} className="text-sm">
                    {label}
                    {required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
                  </Label>
                  <Input
                    id={`ltw-${key}`}
                    value={fields[key]}
                    onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                    aria-invalid={key === "phone" && phoneMissing}
                    className={key === "phone" && phoneMissing ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {key === "phone" && phoneMissing && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      A valid 10-digit phone is required.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button type="button" variant="ghost" className="gap-2" onClick={reset}>
                <ArrowLeft className="h-4 w-4" />
                Start over
              </Button>
              <Button
                type="button"
                className="gap-2 bg-[#003366] text-white hover:bg-[#004080] hover:text-white"
                disabled={submitting || phoneMissing}
                onClick={handleSubmit}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Sending to CRM…" : "Confirm & send to CRM"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Result ── */}
      {step === "done" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResultBanner result={result} />
            <Button type="button" className="gap-2" onClick={reset}>
              <ScanLine className="h-4 w-4" />
              Process another lead
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResultBanner({ result }: { result: SubmitResult }) {
  if (result.alreadyProcessed) {
    return (
      <Banner tone="info" icon={<Info className="h-5 w-5" />} title="Already processed">
        This lead was already in the system (status: {result.existingStatus ?? "completed"}). Nothing was
        changed, to avoid a duplicate.
      </Banner>
    );
  }
  if (result.ok && result.contactId) {
    return (
      <Banner tone="success" icon={<CheckCircle2 className="h-5 w-5" />} title="Lead sent to the CRM">
        Contact <code className="rounded bg-black/10 px-1 dark:bg-white/10">{result.contactId}</code> was
        created/updated and the Senior Life tags were applied — same as an emailed lead.
      </Banner>
    );
  }
  if (result.ok && !result.processed) {
    return (
      <Banner tone="info" icon={<Info className="h-5 w-5" />} title="Already queued">
        This lead is already queued or processing. No duplicate was created.
      </Banner>
    );
  }
  return (
    <Banner tone="warning" icon={<TriangleAlert className="h-5 w-5" />} title="Accepted, but processing hit an issue">
      The lead was saved but the CRM step reported: <strong>{result.reason ?? "unknown"}</strong>. It will be
      retried automatically by the daily reconcile. If it keeps failing, check the CRM credentials / logs.
    </Banner>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: "success" | "info" | "warning";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const styles: Record<typeof tone, string> = {
    success: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  };
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${styles[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
