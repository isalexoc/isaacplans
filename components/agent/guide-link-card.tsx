"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import type { AgentAreaLocale } from "@/lib/tenancy/agent-area-routes";

const WORDS = {
  en: {
    title: "Your guide",
    body: "The page you share with clients: your presentation, their quote and Apply, under your own name.",
    copy: "Copy",
    copied: "Copied",
    open: "Open",
    missing: "Your guide's address isn't set up yet. The platform will let you know when it is.",
  },
  es: {
    title: "Su guía",
    body: "La página que comparte con sus clientes: su presentación, su cotización y el botón para aplicar, con su propio nombre.",
    copy: "Copiar",
    copied: "Copiado",
    open: "Abrir",
    missing: "La dirección de su guía aún no está configurada. La plataforma le avisará cuando lo esté.",
  },
} as const;

/** The agent's public guide (PRODUCT_PUBLIC_URL/{l}/{slug}) with a copy button. */
export default function GuideLinkCard({
  locale,
  url,
  note,
}: {
  locale: AgentAreaLocale;
  /** Null without a product domain configured. */
  url: string | null;
  /** A line under the link (e.g. the pilot's state). */
  note?: string | null;
}) {
  const w = WORDS[locale];
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link is on screen to copy by hand */
    }
  }

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Globe className="h-5 w-5" /> {w.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
      {url ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 text-sm">{url}</code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? w.copied : w.copy}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-md border px-4 text-sm font-semibold hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              {w.open}
            </a>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{w.missing}</p>
      )}
      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
