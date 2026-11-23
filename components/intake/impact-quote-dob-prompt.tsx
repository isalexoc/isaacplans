"use client";

import { useId } from "react";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DobOwner } from "@/lib/impact-quote/prefill";
import { formatIsoLong } from "@/lib/intake-core/month-start";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

const answerCls =
  "h-auto min-h-[3rem] whitespace-normal border-brand/40 bg-white py-2.5 text-base leading-tight hover:border-brand hover:bg-brand/10 hover:text-brand sm:min-h-[2.75rem] sm:text-sm dark:bg-gray-950";

/**
 * The one-tap question above the applicant's date of birth on the Health Coverage form. A quote for
 * two or more people used the oldest one's birth date, and the form doesn't know whose it is: "Yes"
 * fills the applicant's, "No" puts it in "Who else to cover" (lib/impact-quote/prefill.ts).
 *
 * Worded for the client on their own form and on the shared presentation screen (Isaac asks aloud
 * and taps), and for the agent in his own tab. The wrapper is a polite live region that stays
 * mounted, so the "we added that date" line after a "No" is read out. The buttons go away with the
 * question, so an answer first moves focus to the date below: the next thing to check or fill.
 */
export default function ImpactQuoteDobPrompt({
  oldestDob,
  added,
  locale,
  agent,
  onAnswer,
  focusDob,
  className = "",
}: {
  /** The quote's date (YYYY-MM-DD) while the question is open, else null. */
  oldestDob: string | null;
  /** A "No" just put the date in "Who else to cover". */
  added: boolean;
  locale: IntakeLocale;
  /** The agent's own tab: "Is it the applicant's?" instead of "Is this your date of birth?". */
  agent: boolean;
  onAnswer: (owner: DobOwner) => void;
  /** Moves focus to the applicant's date (its first select). */
  focusDob?: () => void;
  /** Spacing for the box; nothing takes room while there's nothing to say. */
  className?: string;
}) {
  const questionId = useId();
  const question = oldestDob
    ? tr(agent ? UI.quoteDobQuestionAgent : UI.quoteDobQuestion, locale).replace(
        "{date}",
        formatIsoLong(oldestDob, locale)
      )
    : "";
  const answer = (owner: DobOwner) => {
    focusDob?.();
    onAnswer(owner);
  };

  return (
    <div aria-live="polite">
      {oldestDob ? (
        <div
          role="group"
          aria-labelledby={questionId}
          className={`rounded-xl border border-brand/30 bg-brand/5 p-3 dark:border-brand/40 dark:bg-brand/10 ${className}`}
        >
          <p id={questionId} className="flex items-start gap-2.5 text-sm font-medium text-foreground">
            <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <span>{question}</span>
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className={answerCls} onClick={() => answer("applicant")}>
              {tr(agent ? UI.quoteDobYesAgent : UI.quoteDobYes, locale)}
            </Button>
            <Button type="button" variant="outline" className={answerCls} onClick={() => answer("other")}>
              {tr(agent ? UI.quoteDobNoAgent : UI.quoteDobNo, locale)}
            </Button>
          </div>
        </div>
      ) : added ? (
        <p
          className={`flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/50 dark:text-green-100 ${className}`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {tr(UI.quoteDobAdded, locale)}
        </p>
      ) : null}
    </div>
  );
}
