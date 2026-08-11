"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Printer, RefreshCw, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { mailingLabelDisplayName } from "@/lib/mailing-labels/format";
import type { MailingLabelRecord } from "@/lib/mailing-labels/types";

/**
 * The letter that goes inside the envelope.
 *
 * Draft → edit → print. Regenerating matters as much as generating: a prospect with no call history
 * today may have three summarized calls next week, so the same letter can be redrafted later with
 * whatever the CRM knows by then.
 */

function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LetterPanel({
  labels,
  onGenerate,
  onSave,
  onPrint,
  busy,
  error,
}: {
  labels: MailingLabelRecord[];
  onGenerate: (id: string) => Promise<MailingLabelRecord | null>;
  onSave: (id: string, body: string) => Promise<MailingLabelRecord | null>;
  onPrint: (ids: string[]) => Promise<void>;
  busy: boolean;
  error: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(labels[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selected = useMemo(
    () => labels.find((l) => l.id === selectedId) ?? null,
    [labels, selectedId]
  );

  // Load the stored letter whenever a different prospect is picked, and again after a
  // generate/save changes the record's timestamps, so the box always shows what's on the server.
  // Note it must NOT touch `saved` — this effect fires right after a save and would clear the
  // confirmation before it was ever visible.
  useEffect(() => {
    setDraft(selected?.letterBody ?? "");
    setDirty(false);
  }, [selected?.id, selected?.letterGeneratedAt, selected?.letterEditedAt, selected?.letterBody]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return labels;
    return labels.filter((l) =>
      [l.firstName, l.lastName, l.city].join(" ").toLowerCase().includes(q)
    );
  }, [labels, query]);

  const withLetters = useMemo(() => labels.filter((l) => l.letterBody.trim()), [labels]);

  const generate = async () => {
    if (!selected) return;
    setGenerating(true);
    setSaved(false);
    try {
      await onGenerate(selected.id);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!selected || !draft.trim()) return;
    const result = await onSave(selected.id, draft);
    if (result) {
      setDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prospects</CardTitle>
          <CardDescription>
            {withLetters.length} of {labels.length} have a letter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
            />
          </div>

          {visible.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No prospects match.</p>
          ) : (
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {visible.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(record.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      record.id === selectedId
                        ? "bg-primary/10 font-medium text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="block truncate">{mailingLabelDisplayName(record)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {record.city}, {record.state}
                      {record.letterBody.trim() ? " · letter ready" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {withLetters.length > 0 ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onPrint(withLetters.map((l) => l.id))}
              disabled={busy}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print all {withLetters.length}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        {!selected ? (
          <CardContent className="py-12">
            <p className="text-sm text-muted-foreground">
              Add a prospect first, then come back to write their letter.
            </p>
          </CardContent>
        ) : (
          <>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    Letter for {mailingLabelDisplayName(selected)}
                    {selected.language === "es" ? (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Español
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <CardDescription>
                    {selected.letterGeneratedAt ? (
                      <>
                        Drafted {relativeDate(selected.letterGeneratedAt)}
                        {selected.letterContext ? ` · ${selected.letterContext}` : ""}
                        {selected.letterEditedAt
                          ? ` · edited ${relativeDate(selected.letterEditedAt)}`
                          : ""}
                      </>
                    ) : (
                      "No letter yet. Draft one, then edit it however you like."
                    )}
                  </CardDescription>
                </div>
                <Button onClick={generate} disabled={generating || busy} variant="outline">
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : selected.letterBody ? (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {selected.letterBody ? "Regenerate" : "Draft letter"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {!selected.crmContactId ? (
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  This prospect isn&apos;t linked to a CRM contact yet, so there are no call notes to
                  personalize from. Drafting will try to match them by phone or email first.
                </p>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="ml-letter">Letter text</Label>
                <Textarea
                  id="ml-letter"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setDirty(true);
                    setSaved(false);
                  }}
                  rows={16}
                  className="font-serif text-base leading-relaxed"
                  placeholder="Draft a letter, or write your own here."
                />
                <p className="text-xs text-muted-foreground">
                  The date, their address, your signature, and your phone are added by the
                  letterhead — just the body goes here. Leave a blank line between paragraphs.
                </p>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={save} disabled={!dirty || !draft.trim() || busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onPrint([selected.id])}
                  disabled={busy || dirty || !selected.letterBody.trim()}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print this letter
                </Button>
                {dirty ? (
                  <span className="text-sm text-muted-foreground">
                    Save your edits before printing.
                  </span>
                ) : null}
                {saved ? (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <Check className="h-4 w-4" /> Saved
                  </span>
                ) : null}
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
