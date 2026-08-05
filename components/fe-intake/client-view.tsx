"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Pencil, Eye, EyeOff, Copy, Check, Unlock, Lock } from "lucide-react";
import { fetchFeIntake, reopenFeIntake } from "@/lib/fe-intake-api";
import FeIntakeBreadcrumb from "@/components/fe-intake/intake-breadcrumb";
import {
  FE_SECTIONS,
  isFieldVisible,
  isRowFilled,
  type FeField,
  type RepeaterRow,
} from "@/lib/fe-intake/fields";
import type { FeIntakeData } from "@/lib/fe-intake/schema";
import type { FeIntakeSession } from "@/lib/fe-intake/types";
import {
  UI,
  pickLocale,
  tr,
  fieldLabel,
  optionLabel,
  rowLabel,
  sectionTitle,
  type FeLocale,
} from "@/lib/fe-intake/ui-strings";

function displayValue(field: FeField, raw: unknown, locale: FeLocale): string {
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
function CopyableValue({ value, display, locale }: { value: string; display: string; locale: FeLocale }) {
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

export default function FeClientView({ token }: { token: string }) {
  const locale = pickLocale(useLocale());
  const [session, setSession] = useState<FeIntakeSession | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reveal, setReveal] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchFeIntake(token);
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

  async function handleReopen(allow: boolean) {
    if (!session) return;
    setReopening(true);
    try {
      const updated = await reopenFeIntake(session.token, allow);
      setSession((prev) =>
        prev ? { ...prev, reopenedForClient: updated.reopenedForClient, status: updated.status } : prev
      );
    } catch {
      /* surfaced by disabled state reset */
    } finally {
      setReopening(false);
    }
  }

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

  const data: FeIntakeData = session.data ?? {};
  const isOwner = session.role === "owner";

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <FeIntakeBreadcrumb current={tr(UI.navSummary, locale)} />
        <div className="mb-4 flex items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button variant="outline" size="sm" onClick={() => setReveal((r) => !r)}>
                {reveal ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                {reveal ? tr(UI.hide, locale) : tr(UI.reveal, locale)}
              </Button>
            )}
            {isOwner && session.status === "completed" && (
              <Button
                variant="outline"
                size="sm"
                disabled={reopening}
                className={session.reopenedForClient ? "text-green-600 hover:text-green-700" : "text-blue-600 hover:text-blue-700"}
                onClick={() => handleReopen(!session.reopenedForClient)}
              >
                {reopening ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : session.reopenedForClient ? (
                  <Lock className="mr-1 h-4 w-4" />
                ) : (
                  <Unlock className="mr-1 h-4 w-4" />
                )}
                {session.reopenedForClient ? tr(UI.lockClientEdit, locale) : tr(UI.allowClientEdit, locale)}
              </Button>
            )}
            <Button asChild size="sm">
              <Link href={{ pathname: "/final-expense/intake/[token]", params: { token } }}>
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
          {FE_SECTIONS.map((section) => {
            const visibleFields = section.fields.filter((f) => isFieldVisible(f, data));
            return (
              <section key={section.key} className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
                <h2 className="mb-3 text-lg font-semibold">{sectionTitle(section, locale)}</h2>

                {visibleFields
                  .filter((f) => f.type === "repeater")
                  .map((field) => {
                    const rows: RepeaterRow[] = Array.isArray(data[field.key])
                      ? (data[field.key] as RepeaterRow[])
                      : [];
                    const filled = rows.filter((r) => isRowFilled(field, r ?? {}));
                    if (filled.length === 0) {
                      return (
                        <p key={field.key} className="text-sm text-muted-foreground">
                          {tr(UI.notProvided, locale)}
                        </p>
                      );
                    }
                    return (
                      <ul key={field.key} className="space-y-3">
                        {filled.map((row, i) => (
                          <li key={i} className="rounded-md border p-3">
                            <div className="mb-2 text-sm font-medium">
                              {rowLabel(field, locale)} {i + 1}
                            </div>
                            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                              {(field.rowFields ?? []).map((sub) => {
                                if (!isFieldVisible(sub, row as Record<string, unknown>)) return null;
                                const raw = String(row[sub.key] ?? "");
                                const value = displayValue(sub, raw, locale);
                                return (
                                  <div key={sub.key} className="min-w-0">
                                    <dt className="text-xs text-muted-foreground">{fieldLabel(sub, locale)}</dt>
                                    <dd className="text-sm">{value || tr(UI.empty, locale)}</dd>
                                  </div>
                                );
                              })}
                            </dl>
                          </li>
                        ))}
                      </ul>
                    );
                  })}

                {visibleFields.some((f) => f.type !== "repeater") && (
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {visibleFields
                      .filter((f) => f.type !== "repeater")
                      .map((field) => {
                        const raw = String(data[field.key] ?? "");
                        const value = displayValue(field, raw, locale);
                        let display = value;
                        let copyText = value;
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
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
