"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ExternalLink } from "lucide-react";

type Props = {
  /** Absolute URL the partner shares with their clients. */
  url: string;
  accentColor: string;
  /** Which language this link opens in, e.g. "Español". */
  label?: string;
};

function CopyRow({ url, accentColor, label }: Props) {
  const t = useTranslations("partnerDashboard");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context, permissions). The URL is visible and
      // selectable right next to the button, so failing quietly is better than an alert.
    }
  }

  return (
    <div>
      {label && (
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {url}
        </code>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ backgroundColor: accentColor }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("copied") : t("copyLink")}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" />
            {t("openLink")}
          </a>
        </div>
      </div>
    </div>
  );
}

export default CopyRow;

/**
 * Both language versions of a partner's referral link.
 *
 * A partner's clients are not all Spanish-first — the same office sends people who would rather
 * read in English — so handing them one URL forces a guess. Showing both, each copyable, lets
 * them pick per client instead.
 */
export function PartnerShareLinks({
  slug,
  siteUrl,
  accentColor,
  spanishLabel,
  englishLabel,
}: {
  slug: string;
  siteUrl: string;
  accentColor: string;
  spanishLabel: string;
  englishLabel: string;
}) {
  return (
    <div className="space-y-4">
      <CopyRow
        url={`${siteUrl}/es/socios/${slug}`}
        accentColor={accentColor}
        label={spanishLabel}
      />
      <CopyRow
        url={`${siteUrl}/en/partners/${slug}`}
        accentColor={accentColor}
        label={englishLabel}
      />
    </div>
  );
}
