"use client";

import { useState } from "react";
import { Loader2, Search, Landmark } from "lucide-react";
import { SMALL_INPUT, SMALL_LABEL, OUTLINE_BTN, ChoiceCard } from "@/components/intake-ui";
import { UI, tr, type IntakeLocale } from "@/lib/iul-intake/ui-strings";

type Match = { routingNumber: string; bankName: string; city: string; state: string };

/**
 * Find a bank's ACH routing number so the agent can read it back and have the client confirm it.
 *
 * **Suggests, never fills on its own — not even on a single match.** A wrong routing number means
 * the premium does not draft, which means a lapsed policy and a very bad phone call. The value of
 * this feature is the client saying "yes, that's it" out loud; a silent auto-fill removes the only
 * verification step it has.
 *
 * Renders nothing when the lookup is not configured, so the form behaves exactly as before.
 */
export default function RoutingLookupPanel({
  locale,
  bankName,
  onPick,
}: {
  locale: IntakeLocale;
  /** Prefilled from the bank name field, since the agent has usually already typed it. */
  bankName: string;
  onPick: (match: Match) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(bankName);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Match[] | null>(null);
  const [unconfigured, setUnconfigured] = useState(false);

  if (unconfigured) return null;

  async function run() {
    setBusy(true);
    setResults(null);
    try {
      const q = new URLSearchParams({ bankName: name, state });
      if (city.trim()) q.set("city", city.trim());
      const res = await fetch(`/api/iul-intake/routing-lookup?${q}`, {
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (json?.configured === false) {
        setUnconfigured(true);
        return;
      }
      setResults(Array.isArray(json?.results) ? json.results : []);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-brand underline"
      >
        <Search className="h-3.5 w-3.5" />
        {tr(UI.routingLookupOpen, locale)}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border-2 border-gray-200 p-4 dark:border-gray-800">
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <Landmark className="h-4 w-4 shrink-0 text-brand" />
        {tr(UI.routingLookupTitle, locale)}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={SMALL_LABEL}>{tr(UI.routingLookupBank, locale)}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bank of America"
            className={SMALL_INPUT}
          />
        </div>
        <div>
          {/* "State" alone invites the wrong answer: the ACH number follows where the account was
              OPENED, not where the client lives now. */}
          <label className={SMALL_LABEL}>{tr(UI.routingLookupState, locale)}</label>
          <input
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="TX"
            maxLength={2}
            className={SMALL_INPUT}
          />
        </div>
        <div className="sm:col-span-3">
          <label className={SMALL_LABEL}>{tr(UI.routingLookupCity, locale)}</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Houston"
            className={SMALL_INPUT}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={busy || !name.trim() || state.length !== 2}
        className={`${OUTLINE_BTN} mt-3 w-auto px-4 py-2 text-sm`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {busy ? tr(UI.routingLookupSearching, locale) : tr(UI.routingLookupSearch, locale)}
      </button>

      {results !== null && results.length === 0 && !busy && (
        <p className="mt-3 text-sm text-muted-foreground">{tr(UI.routingLookupNone, locale)}</p>
      )}

      {results !== null && results.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">{tr(UI.routingLookupConfirm, locale)}</p>
          <div role="radiogroup" className="space-y-2">
            {results.map((m) => (
              <ChoiceCard
                key={m.routingNumber}
                selected={false}
                label={`${m.routingNumber} — ${m.bankName}${m.city ? `, ${m.city}` : ""} ${m.state}`}
                onClick={() => {
                  onPick(m);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{tr(UI.routingLookupAchNote, locale)}</p>
        </div>
      )}
    </div>
  );
}
