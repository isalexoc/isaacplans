"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Pencil, Eye, EyeOff, FileText } from "lucide-react";
import { fetchIntake } from "@/lib/iul-intake-api";
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
                      {beneficiaries.map((b, i) => (
                        <li key={i} className="rounded-md border p-3 text-sm">
                          <div className="font-medium">
                            {tr(UI.beneficiary, locale)} {i + 1}: {[b.firstName, b.lastName].filter(Boolean).join(" ")}
                          </div>
                          <div className="text-muted-foreground">
                            {[
                              b.relationship,
                              b.percent ? `${b.percent}%` : "",
                              b.dateOfBirth,
                              b.ssn ? (reveal ? b.ssn : maskValue(b.ssn)) : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </li>
                      ))}
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
                                  <li key={f.url}>
                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                                      <FileText className="h-4 w-4" />
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
                    const value = displayValue(field, data, locale);
                    const shown = field.sensitive && !reveal ? maskValue(value) : value;
                    return (
                      <div key={field.key}>
                        <dt className="text-xs text-muted-foreground">{fieldLabel(field, locale)}</dt>
                        <dd className="text-sm">{shown || tr(UI.empty, locale)}</dd>
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
