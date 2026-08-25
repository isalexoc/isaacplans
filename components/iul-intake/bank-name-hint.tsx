"use client";

import { useEffect, useRef, useState } from "react";
import { Landmark, Loader2 } from "lucide-react";

export type BankInfo = { bankName: string; city: string; state: string };

/**
 * Names the bank once nine digits are in, so whoever typed them can confirm it is theirs.
 *
 * Silence is a deliberate state, not a gap. The Fed directory behind this covers roughly 7,700
 * institutions, so a legitimate routing number can genuinely be missing — telling somebody their
 * real bank "was not found" would undermine exactly the confidence this is here to build. Not
 * found, provider down, still typing: all render nothing.
 *
 * A generic bank glyph rather than the real logo. Clearbit's free logo API — the one every guide
 * points at — is gone; its host no longer resolves. What is left needs an API key plus a
 * bank-name-to-domain guess, and on a page collecting a Social Security number, calling out to a
 * third-party logo CDN would tell that CDN which bank this visitor uses. Not worth it.
 */
export default function BankNameHint({
  routingNumber,
  /** Endpoint that answers `{ bank }` for `?routing=`. Differs for the client and agent pages. */
  endpoint,
  label,
}: {
  routingNumber: string;
  endpoint: string;
  /** Localized lead-in, e.g. "Bank on file:" — the caller owns the wording. */
  label: string;
}) {
  const [bank, setBank] = useState<BankInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = (routingNumber ?? "").replace(/\D/g, "");
  const ready = digits.length === 9;
  /** Guards against a slow response for an old number landing after a newer one. */
  const requestedRef = useRef("");

  useEffect(() => {
    if (!ready) {
      setBank(null);
      return;
    }
    let active = true;
    requestedRef.current = digits;
    setBusy(true);
    (async () => {
      try {
        const res = await fetch(`${endpoint}?routing=${digits}`, { credentials: "same-origin" });
        const json = await res.json().catch(() => ({}));
        if (!active || requestedRef.current !== digits) return;
        setBank(json?.bank ?? null);
      } catch {
        if (active) setBank(null);
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [digits, ready, endpoint]);

  if (!ready) return null;

  if (busy && !bank) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </p>
    );
  }

  if (!bank) return null;

  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10">
        <Landmark className="h-4 w-4 text-brand" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {bank.bankName}
        </span>
        {(bank.city || bank.state) && (
          <span className="block text-xs text-muted-foreground">
            {[bank.city, bank.state].filter(Boolean).join(", ")}
          </span>
        )}
      </span>
    </div>
  );
}
