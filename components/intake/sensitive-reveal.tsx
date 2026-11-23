"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { revealIntakeValue } from "@/lib/intake-core/api-client";
import { isMaskedValue, maskValue } from "@/lib/intake-shared/masking";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

/**
 * "Show" beside a masked number in an agent's own view of their client's application. The server
 * sends that view masks only (lib/intake-core/save.ts `sessionDataForCaller`); "Show" asks
 * `POST …/reveal` for that one value, which the server puts on record. The value then lives in this
 * page's memory only: never in the form's answers (so no save carries it), gone on "Hide", on a
 * reload, and as soon as the field shows something other than the mask it was revealed for.
 */

/** Where a value sits: a scalar ("ssn"), or a row's sub-field ("dependents.ssn" with its index). */
export type RevealPath = { field: string; rowIndex?: number };

const keyOf = (path: RevealPath) => (path.rowIndex === undefined ? path.field : `${path.field}#${path.rowIndex}`);

type Revealed = { mask: string; value: string };

export type SensitiveReveal = {
  /** The revealed value, while `shown` is still the mask it was revealed for; else null. */
  valueFor: (path: RevealPath, shown: string) => string | null;
  busy: (path: RevealPath) => boolean;
  failed: (path: RevealPath) => boolean;
  show: (path: RevealPath, shown: string) => void;
  hide: (path: RevealPath) => void;
};

/** Null unless this is the agent's own (masked) view, so nothing renders anywhere else. */
export function useSensitiveReveal(lob: string, token: string, enabled: boolean): SensitiveReveal | null {
  const [revealed, setRevealed] = useState<Record<string, Revealed>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const show = useCallback(
    (path: RevealPath, shown: string) => {
      const key = keyOf(path);
      setBusyKey(key);
      setFailedKey(null);
      revealIntakeValue(lob, token, path)
        .then((value) => {
          // The number on file must be the one this mask was made from: a screen that's behind
          // (people reordered and not saved yet) never shows one person's number beside another.
          if (maskValue(value) !== shown) throw new Error("stale");
          setRevealed((prev) => ({ ...prev, [key]: { mask: shown, value } }));
        })
        .catch(() => setFailedKey(key))
        .finally(() => setBusyKey((current) => (current === key ? null : current)));
    },
    [lob, token]
  );

  const hide = useCallback((path: RevealPath) => {
    const key = keyOf(path);
    setRevealed((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  if (!enabled) return null;
  return {
    valueFor: (path, shown) => {
      const hit = revealed[keyOf(path)];
      return hit && hit.mask === shown ? hit.value : null;
    },
    busy: (path) => busyKey === keyOf(path),
    failed: (path) => failedKey === keyOf(path),
    show,
    hide,
  };
}

/** The Show / Hide button, drawn only beside a value that is a mask. */
export function RevealToggle({
  reveal,
  path,
  shown,
  locale,
}: {
  reveal: SensitiveReveal;
  path: RevealPath;
  shown: string;
  locale: IntakeLocale;
}) {
  if (!isMaskedValue(shown)) return null;
  const open = reveal.valueFor(path, shown) !== null;
  const busy = reveal.busy(path);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => (open ? reveal.hide(path) : reveal.show(path, shown))}
      className="flex items-center gap-1 text-xs font-medium text-brand hover:underline disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : open ? (
        <EyeOff className="h-3.5 w-3.5" />
      ) : (
        <Eye className="h-3.5 w-3.5" />
      )}
      {tr(open ? UI.hide : UI.showValue, locale)}
    </button>
  );
}

/** The revealed value (with Copy), or the error, under the field. Nothing otherwise. */
export function RevealedValue({
  reveal,
  path,
  shown,
  locale,
}: {
  reveal: SensitiveReveal;
  path: RevealPath;
  shown: string;
  locale: IntakeLocale;
}) {
  const [copied, setCopied] = useState(false);
  const value = reveal.valueFor(path, shown);
  if (value === null) {
    return reveal.failed(path) ? (
      <p className="mt-1 text-xs text-red-600">{tr(UI.showValueFailed, locale)}</p>
    ) : null;
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(value ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked: the value is on screen */
    }
  }
  return (
    <div className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-md border border-brand/30 bg-brand/5 px-2.5 py-1">
      <span className="min-w-0 break-all font-mono text-sm">{value || tr(UI.empty, locale)}</span>
      {value && (
        <button
          type="button"
          onClick={copy}
          title={tr(UI.copy, locale)}
          aria-label={tr(UI.copy, locale)}
          className="shrink-0 text-muted-foreground transition hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}
