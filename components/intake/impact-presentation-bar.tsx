"use client";

import { CheckCircle2, ExternalLink, Presentation } from "lucide-react";
import { Link } from "@/i18n/navigation";
import MeetingPanel from "@/components/crankwheel/meeting-panel";
import ImpactQuotePanel from "@/components/intake/impact-quote-panel";
import { OUTLINE_BTN } from "@/components/intake-ui";
import { useCrankwheelMeeting } from "@/hooks/use-crankwheel-meeting";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";
import type { IntakeSession } from "@/lib/intake-core/types";

/**
 * The agent's controls for an Impact sale, above the intake form's steps: the CrankWheel screen
 * share, and the button that opens the sales deck in a new tab (the tab the agent then shares).
 *
 * The meeting is anchored to the CRM contact, the way `/admin/meet` does it, not to the session:
 * `crankwheel_meetings.session_id` points at IUL sessions, and the contact is what the
 * post-meeting note is written to anyway.
 *
 * `lang=client` asks the deck's page to open in the client's language (their CRM `spanish` tag),
 * whatever language the agent's form happens to be in.
 */
export default function ImpactPresentationBar({
  lob,
  token,
  session,
  data,
  locale,
}: {
  lob: string;
  token: string;
  session: IntakeSession;
  /** The live answers: the quote reads the household from them. */
  data: Record<string, unknown>;
  locale: IntakeLocale;
}) {
  const meeting = useCrankwheelMeeting({
    target: {
      crmContactId: session.crmContactId ?? undefined,
      contactName: session.contactName,
      contactEmail: session.contactEmail,
      contactPhone: session.contactPhone,
      locale: session.locale,
    },
  });

  const live = meeting.meeting;
  const joined = Boolean(live?.viewerJoinedAt) && live?.status === "active";

  return (
    <>
      <MeetingPanel
        locale={locale}
        compact
        meeting={live}
        busy={meeting.busy}
        error={meeting.error}
        canSend={Boolean(session.crmContactId)}
        onCreate={meeting.create}
        onRevoke={meeting.revoke}
        onSend={meeting.send}
        onReset={meeting.reset}
      />

      <div
        className={`mb-4 flex flex-col gap-3 rounded-2xl border-2 p-3 sm:flex-row sm:items-center sm:justify-between ${
          joined
            ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
            : "border-brand/30 bg-brand/5"
        }`}
      >
        <div>
          <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
            {joined ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <Presentation className="h-4 w-4 shrink-0 text-brand" />
            )}
            {tr(UI.presentationTitle, locale)}
          </p>
          <p
            className={`mt-1 text-sm ${
              joined ? "font-medium text-green-800 dark:text-green-300" : "text-muted-foreground"
            }`}
          >
            {tr(joined ? UI.presentationJoined : UI.presentationBody, locale)}
          </p>
        </div>
        <Link
          href={{
            pathname: "/health-alternative/intake/[token]/presentation",
            params: { token },
            query: { lang: "client" },
          }}
          target="_blank"
          rel="noopener"
          className={
            joined
              ? "flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-accent px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/30 transition hover:opacity-95"
              : `${OUTLINE_BTN} w-auto shrink-0 whitespace-nowrap px-4 py-2.5 text-sm`
          }
        >
          <ExternalLink className="h-4 w-4" />
          {tr(UI.presentationOpen, locale)}
        </Link>
      </div>

      <ImpactQuotePanel lob={lob} token={token} data={data} locale={locale} clientLocale={session.locale} />
    </>
  );
}
