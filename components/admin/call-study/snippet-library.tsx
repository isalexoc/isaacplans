"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Library, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SnippetWithCall } from "@/lib/call-study/store";

/**
 * Every call's best lines in one place, filtered.
 *
 * This is the screen the script is actually written from. One call's analysis is interesting;
 * twenty calls' rebuttals narrowed to "price objections on IUL calls that closed", read side by
 * side, is how you find out which words work.
 *
 * Quotes are verbatim by construction — the analysis prompt refuses to paraphrase — because a
 * cleaned-up line cannot be said out loud on the next call.
 */

const CATEGORIES = [
  { value: "", label: "Everything" },
  { value: "opening", label: "Openings" },
  { value: "discovery", label: "Discovery" },
  { value: "rapport", label: "Rapport" },
  { value: "presentation", label: "Presentation" },
  { value: "objection", label: "Objections (what they said)" },
  { value: "rebuttal", label: "Rebuttals (what worked)" },
  { value: "price", label: "Price" },
  { value: "trial_close", label: "Trial closes" },
  { value: "close", label: "Closes" },
  { value: "story", label: "Stories" },
];

const OUTCOMES = [
  { value: "", label: "Any outcome" },
  { value: "sold", label: "Only calls that sold" },
  { value: "not_sold", label: "Only calls that didn't" },
  { value: "follow_up", label: "Follow-ups" },
];

const LOBS = [
  { value: "", label: "Any product" },
  { value: "iul", label: "IUL" },
  { value: "final_expense", label: "Final Expense" },
  { value: "term_life", label: "Term Life" },
  { value: "whole_life", label: "Whole Life" },
  { value: "annuity", label: "Annuity" },
  { value: "aca", label: "ACA" },
];

const OUTCOME_BADGE: Record<string, string> = {
  sold: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  not_sold: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  follow_up: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  unknown: "bg-muted text-muted-foreground",
};

export default function SnippetLibrary() {
  const [snippets, setSnippets] = useState<SnippetWithCall[]>([]);
  const [objectionTypes, setObjectionTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedAll, setCopiedAll] = useState(false);

  const [category, setCategory] = useState("");
  const [objectionType, setObjectionType] = useState("");
  const [outcome, setOutcome] = useState("");
  const [lineOfBusiness, setLineOfBusiness] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (objectionType) params.set("objectionType", objectionType);
      if (outcome) params.set("outcome", outcome);
      if (lineOfBusiness) params.set("lineOfBusiness", lineOfBusiness);

      const res = await fetch(`/api/admin/call-study/snippets?${params}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) {
        setSnippets(json.snippets ?? []);
        setObjectionTypes(json.objectionTypes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [category, objectionType, outcome, lineOfBusiness]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Copy the whole filtered set — the actual "start writing the script" action. */
  async function copyAll() {
    const text = snippets
      .map((s) => `${s.quote}\n  — ${s.speakerName ?? s.speakerRole} · ${s.callTitle}${s.why ? ` · ${s.why}` : ""}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 dark:bg-gray-950">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Library className="h-5 w-5" /> Script library
          </p>
          {snippets.length > 0 && (
            <Button size="sm" variant="outline" onClick={copyAll}>
              {copiedAll ? <Check className="mr-1 h-4 w-4 text-green-600" /> : <Copy className="mr-1 h-4 w-4" />}
              {copiedAll ? "Copied" : `Copy all ${snippets.length}`}
            </Button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={objectionType}
            onChange={(e) => setObjectionType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Any objection type</option>
            {objectionTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={lineOfBusiness}
            onChange={(e) => setLineOfBusiness(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {LOBS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : snippets.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-muted-foreground dark:bg-gray-950">
          Nothing here yet. Analyse a call and its best lines land in this library.
        </div>
      ) : (
        <ul className="space-y-3">
          {snippets.map((s) => (
            <li key={s.id} className="rounded-lg border bg-white p-4 dark:bg-gray-950">
              <blockquote className="border-l-2 border-brand pl-3 text-sm leading-relaxed">
                “{s.quote}”
              </blockquote>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">{s.category}</span>
                {s.objectionType && <span className="rounded bg-muted px-1.5 py-0.5">{s.objectionType}</span>}
                <span className={`rounded px-1.5 py-0.5 ${OUTCOME_BADGE[s.callOutcome] ?? ""}`}>
                  {s.callOutcome === "unknown" ? "untagged" : s.callOutcome.replace("_", " ")}
                </span>
                {s.callLineOfBusiness && <span className="rounded bg-muted px-1.5 py-0.5">{s.callLineOfBusiness}</span>}
                <span>
                  {s.speakerName ?? s.speakerRole} · {s.callTitle}
                </span>
              </div>
              {s.why && <p className="mt-1.5 text-xs italic text-muted-foreground">{s.why}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
