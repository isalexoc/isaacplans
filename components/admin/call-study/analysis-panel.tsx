"use client";

import { CheckCircle2, HelpCircle, MessageSquareWarning, Target, ThumbsUp, XCircle } from "lucide-react";
import type { CallAnalysis } from "@/lib/call-study/types";

const PHASE_LABELS: Record<string, string> = {
  opening: "Opening",
  discovery: "Discovery",
  presentation: "Presentation",
  objection: "Objections",
  close: "Close",
  wrap: "Wrap-up",
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-gray-950">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * The anatomy of one call.
 *
 * Deliberately reads as findings rather than a data dump: the objections carry both sides of the
 * exchange verbatim, because an objection and the line that answered it is already a usable script
 * fragment, and splitting them into separate lists would destroy that.
 */
export default function AnalysisPanel({ analysis }: { analysis: CallAnalysis }) {
  const hasNothing =
    !analysis.summary &&
    analysis.objections.length === 0 &&
    analysis.discoveryQuestions.length === 0 &&
    analysis.closeLanguage.length === 0;

  if (hasNothing) {
    return (
      <div className="rounded-lg border bg-white p-4 text-sm text-muted-foreground dark:bg-gray-950">
        The analysis found nothing worth recording on this call.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {analysis.summary && (
        <Section title="What happened" icon={<Target className="h-4 w-4 text-brand" />}>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
        </Section>
      )}

      {analysis.phases.length > 0 && (
        <Section title="How the call was structured" icon={<Target className="h-4 w-4 text-brand" />}>
          <div className="flex flex-wrap gap-2">
            {analysis.phases.map((p, i) => (
              <span
                key={i}
                className="rounded-full border bg-muted/40 px-3 py-1 text-xs"
                title={p.note ?? undefined}
              >
                {PHASE_LABELS[p.phase] ?? p.phase}
                <span className="ml-1 text-muted-foreground">
                  turns {p.startTurn}–{p.endTurn}
                </span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {analysis.objections.length > 0 && (
        <Section
          title={`Objections (${analysis.objections.length})`}
          icon={<MessageSquareWarning className="h-4 w-4 text-amber-600" />}
        >
          <ul className="space-y-3">
            {analysis.objections.map((o, i) => (
              <li key={i} className="rounded-md border-l-2 border-amber-400 bg-amber-50/40 p-3 dark:bg-amber-950/10">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{o.objection}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {o.objectionType}
                  </span>
                  {o.resolved === true && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {o.resolved === false && <XCircle className="h-4 w-4 text-red-500" />}
                </div>
                {o.clientQuote && (
                  <p className="mt-1.5 text-sm italic text-muted-foreground">“{o.clientQuote}”</p>
                )}
                {o.agentResponse && <p className="mt-1 text-sm">→ “{o.agentResponse}”</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {analysis.discoveryQuestions.length > 0 && (
        <Section
          title={`Discovery questions (${analysis.discoveryQuestions.length})`}
          icon={<HelpCircle className="h-4 w-4 text-blue-600" />}
        >
          <ul className="list-inside list-disc space-y-1 text-sm">
            {analysis.discoveryQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Section>
      )}

      {analysis.closeLanguage.length > 0 && (
        <Section title="How the agent asked for the business" icon={<Target className="h-4 w-4 text-green-600" />}>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {analysis.closeLanguage.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {(analysis.strengths.length > 0 || analysis.improvements.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {analysis.strengths.length > 0 && (
            <Section title="Worked well" icon={<ThumbsUp className="h-4 w-4 text-green-600" />}>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {analysis.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Section>
          )}
          {analysis.improvements.length > 0 && (
            <Section title="Would have worked better" icon={<Target className="h-4 w-4 text-amber-600" />}>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {analysis.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
