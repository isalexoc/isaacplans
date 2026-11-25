"use client";

import { CheckCircle2, ExternalLink, EyeOff, Presentation } from "lucide-react";
import { Link } from "@/i18n/navigation";
import MeetingPanel from "@/components/crankwheel/meeting-panel";
import ImpactQuotePanel from "@/components/intake/impact-quote-panel";
import DeliveryButtons from "@/components/intake/delivery-buttons";
import { OUTLINE_BTN } from "@/components/intake-ui";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCrankwheelMeeting } from "@/hooks/use-crankwheel-meeting";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";
import type { IntakeSession, PresentationToggle } from "@/lib/intake-core/types";

/**
 * The agent's controls for a presented sale, above the intake form's steps: the CrankWheel screen
 * share, and the button that opens the sales deck in a new tab (the tab the agent then shares).
 *
 * Built for Impact and generalized in place for any line with `config.presentation` (Legal Shield):
 * without it, everything below takes Impact's values exactly as before (deck path, `lang=client`,
 * the quote panel, "send by text").
 *
 * The meeting is anchored to the CRM contact, the way `/admin/meet` does it, not to the session:
 * `crankwheel_meetings.session_id` points at IUL sessions, and the contact is what the
 * post-meeting note is written to anyway.
 *
 * `lang=client` asks the Impact deck's page to open in the client's language (their CRM `spanish`
 * tag), whatever language the agent's form happens to be in.
 *
 * `agentToggles` are switches only the agent sees: this tab is never the one being shared, so a
 * switch here (e.g. "IDShield included") changes the deck without the client seeing a control.
 */
export default function ImpactPresentationBar({
  lob,
  token,
  session,
  data,
  locale,
  onSetField,
}: {
  lob: string;
  token: string;
  session: IntakeSession;
  /** The live answers: the quote and the toggles read them. */
  data: Record<string, unknown>;
  locale: IntakeLocale;
  /** Sets one answer through the form, so its autosave persists it (and tells the deck's tab). */
  onSetField: (key: string, value: unknown) => void;
}) {
  const config = requireIntakeConfig(lob);
  const presentation = config.presentation;
  const meetings = presentation?.meetings ?? true;
  const whatsapp = config.linkDelivery?.kind === "whatsapp" ? config.linkDelivery : null;

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
  const joined = meetings && Boolean(live?.viewerJoinedAt) && live?.status === "active";
  const es = locale === "es";

  const title = presentation ? (es ? presentation.titleEs : presentation.titleEn) : tr(UI.presentationTitle, locale);
  const body = presentation
    ? es
      ? joined
        ? presentation.joinedEs
        : presentation.bodyEs
      : joined
        ? presentation.joinedEn
        : presentation.bodyEn
    : tr(joined ? UI.presentationJoined : UI.presentationBody, locale);
  const open = presentation ? (es ? presentation.openEs : presentation.openEn) : tr(UI.presentationOpen, locale);
  const href = presentation
    ? { pathname: presentation.pathname as never, params: { token }, ...(presentation.query ? { query: presentation.query } : {}) }
    : { pathname: "/health-alternative/intake/[token]/presentation" as const, params: { token }, query: { lang: "client" } };

  return (
    <>
      {meetings && (
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
          renderDelivery={
            whatsapp
              ? (url) => (
                  <DeliveryButtons
                    kind="meeting"
                    url={url}
                    locale={locale}
                    agentName={whatsapp.agentName}
                    product={whatsapp.product[locale]}
                    clientName={session.contactName}
                    phone={session.contactPhone}
                    showCopy={false}
                  />
                )
              : undefined
          }
        />
      )}

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
            {title}
          </p>
          <p
            className={`mt-1 text-sm ${
              joined ? "font-medium text-green-800 dark:text-green-300" : "text-muted-foreground"
            }`}
          >
            {body}
          </p>
        </div>
        <Link
          href={href}
          target="_blank"
          rel="noopener"
          className={
            joined
              ? "flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-accent px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/30 transition hover:opacity-95"
              : // cn, not a template string: OUTLINE_BTN's w-full outranks w-auto in Tailwind's CSS
                // order, which stretched the button across the card and squeezed the title.
                cn(OUTLINE_BTN, "w-auto shrink-0 whitespace-nowrap px-4 py-2.5 text-sm")
          }
        >
          <ExternalLink className="h-4 w-4" />
          {open}
        </Link>
      </div>

      {presentation?.agentToggles?.map((toggle) => (
        <AgentToggle
          key={toggle.fieldKey}
          toggle={toggle}
          locale={locale}
          value={typeof data[toggle.fieldKey] === "string" ? (data[toggle.fieldKey] as string) : ""}
          onChange={(v) => onSetField(toggle.fieldKey, v)}
        />
      ))}

      {config.impactPresentation && (
        <ImpactQuotePanel lob={lob} token={token} data={data} locale={locale} clientLocale={session.locale} />
      )}
    </>
  );
}

/** One switch the client never sees (this tab isn't shared). An empty answer counts as "on". */
function AgentToggle({
  toggle,
  locale,
  value,
  onChange,
}: {
  toggle: PresentationToggle;
  locale: IntakeLocale;
  value: string;
  onChange: (value: string) => void;
}) {
  const on = value !== toggle.offValue;
  const id = `agent-toggle-${toggle.fieldKey}`;
  const hint = locale === "es" ? toggle.hintEs : toggle.hintEn;
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border-2 border-dashed border-gray-300 p-3 dark:border-gray-700">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
          <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          {locale === "es" ? toggle.labelEs : toggle.labelEn}
        </span>
        {hint && <span className="mt-1 block text-sm text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={on} onCheckedChange={(checked) => onChange(checked ? toggle.onValue : toggle.offValue)} />
    </div>
  );
}
