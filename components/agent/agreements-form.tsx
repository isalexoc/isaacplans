"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { AgentAreaLocale } from "@/lib/tenancy/agent-area-routes";

type Ref = { doc: string; version: string; sha256: string };

const WORDS = {
  en: {
    check: "I have read and accept the Terms of Service and the Data Processing Agreement above.",
    accept: "Accept and continue",
    changed: "These documents just changed. Reload the page to read the new version.",
    error: "Couldn't save your acceptance. Try again.",
  },
  es: {
    check: "He leído y acepto los Términos de servicio y el Acuerdo de tratamiento de datos de arriba.",
    accept: "Aceptar y continuar",
    changed: "Estos documentos acaban de cambiar. Recargue la página para leer la nueva versión.",
    error: "No se pudo guardar su aceptación. Intente de nuevo.",
  },
} as const;

/**
 * The click-through: a checkbox, then the button that records the acceptance of exactly the
 * versions on screen (`refs`, with the hash of each text). The server refuses anything else.
 */
export default function AgreementsForm({
  locale,
  refs,
  nextHref,
}: {
  locale: AgentAreaLocale;
  refs: Ref[];
  /** Where the agent goes once accepted. */
  nextHref: string;
}) {
  const w = WORDS[locale];
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/agreements", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: refs }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; code?: string };
      if (res.ok && json.success) {
        window.location.assign(nextHref);
        return;
      }
      setError(json.code === "changed" ? w.changed : w.error);
    } catch {
      setError(w.error);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-[#e6e9ef] bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 h-4 w-4 flex-none accent-[#0b2a4a]"
        />
        <span>{w.check}</span>
      </label>
      <button
        type="button"
        disabled={!checked || busy}
        onClick={accept}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0b2a4a] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {w.accept}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
