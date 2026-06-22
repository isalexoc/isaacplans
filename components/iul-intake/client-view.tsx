"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Pencil, Eye, EyeOff, FileText, Copy, Check } from "lucide-react";
import { fetchIntake } from "@/lib/iul-intake-api";
import { formatMoneyDisplay } from "@/lib/iul-intake/money";
import IntakeBreadcrumb from "@/components/iul-intake/intake-breadcrumb";
import {
  INTAKE_SECTIONS,
  isFieldVisible,
  type IntakeField,
  type Beneficiary,
  type FileRef,
} from "@/lib/iul-intake/fields";
import type { IntakeData } from "@/lib/iul-intake/schema";
import type { IntakeSession } from "@/lib/iul-intake/types";
import {
  UI,
  pickLocale,
  tr,
  fieldLabel,
  optionLabel,
  sectionTitle,
  type IntakeLocale,
} from "@/lib/iul-intake/ui-strings";

function displayValue(field: IntakeField, data: IntakeData, locale: IntakeLocale): string {
  const raw = data[field.key];
  if (raw == null || raw === "") return "";
  const value = String(raw);
  if (field.type === "select" && field.options) {
    const opt = field.options.find((o) => o.value === value);
    return opt ? optionLabel(opt, locale) : value;
  }
  return value;
}

function maskValue(value: string): string {
  if (!value) return "";
  const last = value.slice(-4);
  return `••••${last}`;
}

/** A value with a one-tap copy button (copies the real value for pasting into carrier apps). */
function CopyableValue({
  value,
  display,
  locale,
}: {
  value: string;
  display: string;
  locale: IntakeLocale;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span>{display}</span>;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <span className="group inline-flex max-w-full items-start gap-1.5">
      <span className="min-w-0 break-words">{display}</span>
      <button
        type="button"
        onClick={copy}
        title={tr(UI.copy, locale)}
        aria-label={tr(UI.copy, locale)}
        className="mt-0.5 shrink-0 text-muted-foreground transition hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

export default function ClientView({ token }: { token: string }) {
  const locale = pickLocale(useLocale());
  const [session, setSession] = useState<IntakeSession | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchIntake(token);
        if (active) {
          setSession(s);
          setState("ready");
        }
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {tr(UI.loading, locale)}
      </div>
    );
  }
  if (state === "error" || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-red-600">
        <AlertCircle className="mr-2 h-5 w-5" /> {tr(UI.loadError, locale)}
      </div>
    );
  }

  const data = session.data ?? {};
  const isOwner = session.role === "owner";
  const beneficiaries: Beneficiary[] = Array.isArray(data.beneficiaries) ? data.beneficiaries : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <IntakeBreadcrumb current={tr(UI.navSummary, locale)} />
        <div className="mb-4 flex items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button variant="outline" size="sm" onClick={() => setReveal((r) => !r)}>
                {reveal ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                {reveal ? tr(UI.hide, locale) : tr(UI.reveal, locale)}
              </Button>
            )}
            <Button asChild size="sm">
              <Link href={{ pathname: "/iul/intake/[token]", params: { token } }}>
                <Pencil className="mr-1 h-4 w-4" />
                {tr(UI.editForm, locale)}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold">{session.contactName || tr(UI.viewTitle, locale)}</h1>
          <Badge variant={session.status === "completed" ? "default" : "secondary"}>
            {session.status === "completed"
              ? tr(UI.statusCompleted, locale)
              : session.status === "in_progress"
                ? tr(UI.statusInProgress, locale)
                : tr(UI.statusDraft, locale)}
          </Badge>
        </div>

        <div className="space-y-5">
          {INTAKE_SECTIONS.map((section) => {
            if (section.key === "beneficiaries") {
              return (
                <section key={section.key} className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
                  <h2 className="mb-3 text-lg font-semibold">{sectionTitle(section, locale)}</h2>
                  {beneficiaries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tr(UI.notProvided, locale)}</p>
                  ) : (
                    <ul className="space-y-2">
                      {beneficiaries.map((b, i) => {
                        const name = [b.firstName, b.lastName].filter(Boolean).join(" ");
                        const detailParts = (ssn: string) =>
                          [b.relationship, b.percent ? `${b.percent}%` : "", b.dateOfBirth, ssn ? `SSN ${ssn}` : ""]
                            .filter(Boolean)
                            .join(" · ");
                        const displayDetail = detailParts(b.ssn ? (reveal ? b.ssn : maskValue(b.ssn)) : "");
                        const copyDetail = [name, detailParts(b.ssn)].filter(Boolean).join(" · ");
                        return (
                          <li key={i} className="rounded-md border p-3 text-sm">
                            <div className="font-medium">
                              {tr(UI.beneficiary, locale)} {i + 1}: {name}
                            </div>
                            <div className="text-muted-foreground">
                              <CopyableValue value={copyDetail} display={displayDetail} locale={locale} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            }

            const visibleFields = section.fields.filter((f) => isFieldVisible(f, data));
            return (
              <section key={section.key} className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
                <h2 className="mb-3 text-lg font-semibold">{sectionTitle(section, locale)}</h2>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {visibleFields.map((field) => {
                    if (field.type === "file") {
                      const fileList: FileRef[] = Array.isArray(data[field.key]) ? (data[field.key] as FileRef[]) : [];
                      return (
                        <div key={field.key} className="sm:col-span-2">
                          <dt className="text-xs text-muted-foreground">{fieldLabel(field, locale)}</dt>
                          <dd className="text-sm">
                            {fileList.length === 0 ? (
                              tr(UI.empty, locale)
                            ) : (
                              <ul className="mt-1 space-y-1">
                                {fileList.map((f) => (
                                  <li key={f.url} className="flex min-w-0 items-start gap-1.5">
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-blue-600 hover:underline">
                                      {f.name}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </dd>
                        </div>
                      );
                    }
                    const raw = String(data[field.key] ?? "");
                    const value = displayValue(field, data, locale);
                    let display = value;
                    let copyText = value;
                    if (field.type === "money" && raw) {
                      display = `$${formatMoneyDisplay(raw)}`;
                      copyText = raw;
                    }
                    if (field.sensitive) {
                      copyText = raw;
                      if (!reveal) display = maskValue(value);
                    }
                    return (
                      <div key={field.key} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{fieldLabel(field, locale)}</dt>
                        <dd className="text-sm">
                          {value ? (
                            <CopyableValue value={copyText} display={display} locale={locale} />
                          ) : (
                            tr(UI.empty, locale)
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
