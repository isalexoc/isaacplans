"use client";

/**
 * Review queue for IUL leads that arrive over Telegram.
 *
 * The raw message sits beside the editable fields on purpose: when the provider changes their
 * format, the fastest way to see what happened is to read what they actually sent next to what the
 * parser made of it. "Re-parse" re-runs the parser over the stored message after a fix, without
 * touching the CRM.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Lead = {
  leadKey: string;
  status: string;
  needsReview: boolean;
  reviewReason: string | null;
  errorMessage: string | null;
  parseSource: string | null;
  matchedBy: string | null;
  contactId: string | null;
  contactUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  stateCode: string | null;
  tagsAdded: string[];
  cadenceStarted: boolean;
  attemptCount: number;
  rawText: string;
  parsed: Record<string, string | undefined>;
  unmatchedLines: string[];
  warnings: string[];
  createdAt: string;
  messageAt: string | null;
};

type ConfigInfo = {
  enabled: boolean;
  dryRun: boolean;
  allowlistCount: number;
  tags: string[];
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  needs_review: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  dismissed: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  ignored: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const FIELDS: { key: string; label: string; required?: boolean; span2?: boolean }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "phoneE164", label: "Phone (+1…)", required: true },
  { key: "email", label: "Email" },
  { key: "stateRaw", label: "State" },
  { key: "bestCallTime", label: "Best time to call" },
  { key: "monthlySavings", label: "Monthly savings" },
  { key: "adName", label: "Ad / campaign" },
  { key: "goal", label: "Goal", span2: true },
  { key: "enteredAtRaw", label: "Lead entered" },
  { key: "localCallNote", label: "Call note" },
];

const NANP = /^\+1[2-9]\d{2}[2-9]\d{6}$/;

export default function TelegramLeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [view, setView] = useState<"attention" | "completed" | "all">("attention");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "submit" | "reparse" | "dismiss">(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/telegram-leads?view=${view}`, {
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads);
        setConfig(data.config);
      } else {
        setMessage({ tone: "err", text: data.error ?? "Could not load leads." });
      }
    } catch {
      setMessage({ tone: "err", text: "Network error loading leads." });
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(
    () => leads.find((l) => l.leadKey === selected) ?? null,
    [leads, selected]
  );

  const openLead = (lead: Lead) => {
    setSelected(lead.leadKey);
    setMessage(null);
    setFields({
      firstName: lead.parsed.firstName ?? lead.firstName ?? "",
      lastName: lead.parsed.lastName ?? lead.lastName ?? "",
      phoneE164: lead.parsed.phoneE164 ?? lead.phone ?? "",
      email: lead.parsed.email ?? lead.email ?? "",
      stateRaw: lead.parsed.stateRaw ?? "",
      goal: lead.parsed.goal ?? "",
      monthlySavings: lead.parsed.monthlySavings ?? "",
      bestCallTime: lead.parsed.bestCallTime ?? "",
      adName: lead.parsed.adName ?? "",
      enteredAtRaw: lead.parsed.enteredAtRaw ?? "",
      localCallNote: lead.parsed.localCallNote ?? "",
    });
  };

  const act = async (action: "submit" | "reparse" | "dismiss") => {
    if (!current) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/telegram-leads/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadKey: current.leadKey, action, fields }),
      });
      const data = await res.json();

      if (!data.success) {
        setMessage({ tone: "err", text: data.error ?? "Something went wrong." });
        return;
      }

      if (action === "reparse") {
        const p = data.parsed as Record<string, unknown>;
        const fresh: Record<string, string> = {};
        for (const [k, v] of Object.entries(p)) {
          if (typeof v === "string" && v) fresh[k] = v;
        }
        setFields((f) => ({ ...f, ...fresh }));
        setMessage({ tone: "ok", text: "Re-parsed from the original message. Nothing sent to the CRM." });
        return;
      }

      if (action === "dismiss") {
        setMessage({ tone: "ok", text: "Dismissed." });
      } else {
        setMessage({
          tone: "ok",
          text: data.dryRun
            ? "Dry run — the CRM write was logged, not sent."
            : `Sent to CRM (${data.matchedBy}). ${
                data.cadenceStarted
                  ? "Follow-up started."
                  : "Existing contact — follow-up deliberately not restarted."
              }`,
        });
      }
      setSelected(null);
      await load();
    } catch {
      setMessage({ tone: "err", text: "Network error." });
    } finally {
      setBusy(null);
    }
  };

  const phoneValid = NANP.test((fields.phoneE164 ?? "").trim());

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Telegram Leads</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          IUL leads delivered over Telegram by Empiregrowth. Anything the parser could not read
          safely lands here instead of being guessed at.
        </p>
      </div>

      {config && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
          <Badge className={config.enabled ? STATUS_STYLES.completed : STATUS_STYLES.pending}>
            {config.enabled ? "Live" : "Disabled (capturing only)"}
          </Badge>
          {config.dryRun && <Badge className={STATUS_STYLES.processing}>Dry run</Badge>}
          {config.allowlistCount === 0 && (
            <Badge className={STATUS_STYLES.failed}>No chat allowlisted</Badge>
          )}
          <span className="text-slate-500 dark:text-slate-400">
            Tags: {config.tags.join(", ")}
          </span>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        {(["attention", "completed", "all"] as const).map((v) => (
          <Button
            key={v}
            type="button"
            variant={view === v ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setView(v);
              setSelected(null);
            }}
          >
            {v === "attention" ? "Needs attention" : v === "completed" ? "Synced" : "All"}
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {message && (
        <div
          className={cn(
            "mb-4 rounded-lg border-2 p-3 text-sm",
            message.tone === "ok"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          )}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {view === "attention" ? "Needs attention" : view === "completed" ? "Synced" : "All leads"}
          </CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${leads.length} lead${leads.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Why</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">
                    Nothing here. {view === "attention" && "Every lead went through cleanly."}
                  </TableCell>
                </TableRow>
              )}
              {leads.map((lead) => (
                <TableRow
                  key={lead.leadKey}
                  data-state={selected === lead.leadKey ? "selected" : undefined}
                >
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">
                    {new Date(lead.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {lead.phone || "—"}
                  </TableCell>
                  <TableCell>{lead.stateCode || "—"}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLES[lead.status] ?? STATUS_STYLES.pending}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {lead.reviewReason || lead.errorMessage || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {lead.status === "completed"
                      ? lead.cadenceStarted
                        ? "started"
                        : "not restarted"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {lead.contactUrl && (
                        <a
                          href={lead.contactUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Open in CRM"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => openLead(lead)}>
                        Review
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {current && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Review lead</CardTitle>
            <CardDescription>
              {current.leadKey}
              {current.parseSource ? ` · read by ${current.parseSource}` : ""}
              {current.attemptCount > 0 ? ` · ${current.attemptCount} attempt(s)` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  What the provider sent
                </Label>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border-2 border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed dark:border-slate-700 dark:bg-slate-900/50">
                  {current.rawText || "(no text — the message was a photo, sticker or voice note)"}
                </pre>
                {current.unmatchedLines.length > 0 && (
                  <div className="mt-3 rounded-lg border-2 border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <div className="mb-1 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5" /> Lines the parser did not recognise
                    </div>
                    <ul className="list-inside list-disc space-y-0.5">
                      {current.unmatchedLines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {current.warnings.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Warnings: {current.warnings.join(", ")}
                  </p>
                )}
              </div>

              <div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <div key={f.key} className={f.span2 ? "sm:col-span-2" : undefined}>
                      <Label htmlFor={`tg-${f.key}`} className="mb-1 block text-xs">
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        id={`tg-${f.key}`}
                        value={fields[f.key] ?? ""}
                        onChange={(e) =>
                          setFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                        aria-invalid={f.key === "phoneE164" && !phoneValid}
                        className={cn(
                          f.key === "phoneE164" && !phoneValid && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                    </div>
                  ))}
                </div>

                {!phoneValid && (
                  <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    A valid US number is required, in +1XXXXXXXXXX form.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void act("submit")}
                    disabled={!phoneValid || busy !== null}
                    className="gap-2"
                  >
                    {busy === "submit" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send to CRM
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void act("reparse")}
                    disabled={busy !== null}
                    className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", busy === "reparse" && "animate-spin")} />
                    Re-parse
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void act("dismiss")}
                    disabled={busy !== null}
                    className="gap-2 text-slate-500"
                  >
                    <Trash2 className="h-4 w-4" />
                    Not a lead
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>

                {current.status === "completed" && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Already synced
                    {current.cadenceStarted
                      ? " — follow-up started."
                      : " — existing contact, follow-up not restarted."}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
