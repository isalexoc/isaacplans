"use client";

import { AlertTriangle, Scale } from "lucide-react";
import { impactStateName } from "@/lib/impact-disclosures/availability";
import { impactNoticeFor, type NoticeLink } from "@/lib/impact-disclosures/notices";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

/**
 * Impact's own notice for the application's home state, word for word (lib/impact-disclosures/
 * notices.ts), near the submit step of an AGENT's application; and, where Impact isn't available
 * (Rhode Island, Washington), the message that it can't be submitted. Isaac's forms show neither.
 *
 * The intake form loads this module with next/dynamic, only when it renders one of these (an
 * agent's application), so the notices' text never ships with Isaac's intakes.
 */

/** A paragraph with the words a link covers turned into that link. */
function Paragraph({ text, links }: { text: string; links: readonly NoticeLink[] }) {
  const link = links.find((l) => l.label && text.includes(l.label));
  if (!link) return <p>{text}</p>;
  const at = text.indexOf(link.label);
  return (
    <p>
      {text.slice(0, at)}
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">
        {link.label}
      </a>
      {text.slice(at + link.label.length)}
    </p>
  );
}

export function ImpactStateNotice({ state, locale, className = "" }: { state: unknown; locale: IntakeLocale; className?: string }) {
  const notice = impactNoticeFor(state, locale);
  if (!notice) return null;
  const links = notice.text.links ?? [];
  return (
    <section
      aria-label={tr(UI.stateNoticeTitle, locale)}
      className={`rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-300 ${className}`}
    >
      <p className="mb-1 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        <Scale className="h-3.5 w-3.5" /> {tr(UI.stateNoticeTitle, locale)}
      </p>
      <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100" lang={notice.language}>
        {notice.text.title}
      </p>
      <div className="space-y-2" lang={notice.language}>
        {notice.text.paragraphs.map((text, i) => (
          <Paragraph key={i} text={text} links={links} />
        ))}
      </div>
      {notice.language !== locale && <p className="mt-2 italic text-muted-foreground">{tr(UI.stateNoticeEnglishOnly, locale)}</p>}
    </section>
  );
}

export function ImpactStateBlocked({ state, locale, className = "" }: { state: unknown; locale: IntakeLocale; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{tr(UI.stateUnavailable, locale).replace("{state}", impactStateName(state))}</p>
    </div>
  );
}
