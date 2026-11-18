"use client";

/** One lead in the Leads tab: where the conversation stands, and pause / resume / take over. */

import type { ReactNode } from "react";
import { ExternalLink, Hand, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LeadStatus } from "@/lib/ai-setter/types";
import type { LeadItem } from "./api-types";
import { formatDateTime, formatRelative, isFuture } from "./format";
import { LEAD_STATUS_META, languageLabel, pauseReasonLabel } from "./labels";
import { ACTION_BUTTON_CLASS, BusyIcon, Notice, Pill } from "./ui-bits";
import type { RunAction } from "./use-ai-setter-api";

const PAUSABLE: ReadonlySet<LeadStatus> = new Set(["active", "booked", "handoff"]);
const RESUMABLE: ReadonlySet<LeadStatus> = new Set(["paused", "handoff", "stopped"]);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function LeadFacts({ lead, nowMs }: { lead: LeadItem; nowMs: number }) {
  const reason = pauseReasonLabel(lead.pauseReason);
  return (
    <dl className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
      <Row label="Último mensaje del lead">{formatRelative(lead.lastInboundAt, nowMs)}</Row>
      <Row label="Último de la IA">{formatRelative(lead.lastAiOutboundAt, nowMs)}</Row>
      {lead.appointmentAt && <Row label="Cita">{formatDateTime(lead.appointmentAt)}</Row>}
      {lead.offeredLabels.length > 0 && <Row label="Horas ofrecidas">{lead.offeredLabels.join(" · ")}</Row>}
      {reason && <Row label="Motivo">{reason}</Row>}
      {isFuture(lead.pausedUntil, nowMs) && <Row label="En pausa hasta">{formatDateTime(lead.pausedUntil)}</Row>}
    </dl>
  );
}

function LeadNotices({ lead }: { lead: LeadItem }) {
  return (
    <>
      {lead.optOutPending && (
        <Notice tone="amber" className="mt-3">
          Baja ambigua: todo está congelado hasta que el lead aclare o decidas tú.
        </Notice>
      )}
      {lead.callNowState === "waiting" && (
        <Notice tone="blue" className="mt-3">
          Quiere hablar ya: esperando tu respuesta en Telegram.
        </Notice>
      )}
    </>
  );
}

export function LeadCard({ lead, nowMs, busyKey, run }: { lead: LeadItem; nowMs: number; busyKey: string | null; run: RunAction }) {
  const status = LEAD_STATUS_META[lead.status];
  const { contactId } = lead;
  const disabled = busyKey !== null;
  const tookOver = lead.status === "paused" && lead.pausedUntil === null;
  const canTakeOver = lead.status !== "opted_out" && !tookOver;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{lead.firstName ?? "Sin nombre"}</p>
          <p className="text-xs text-muted-foreground">
            {[lead.productLabelEs ?? "Sin producto", lead.stateCode ?? "Estado ?", languageLabel(lead.language, lead.register)].join(" · ")}
          </p>
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
      <LeadFacts lead={lead} nowMs={nowMs} />
      <LeadNotices lead={lead} />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {PAUSABLE.has(lead.status) && (
          <Button
            type="button"
            variant="outline"
            className={ACTION_BUTTON_CLASS}
            disabled={disabled}
            onClick={() => void run(`pause_lead:${contactId}`, { action: "pause_lead", contactId }, "Lead en pausa")}
          >
            <BusyIcon busy={busyKey === `pause_lead:${contactId}`} icon={<Pause />} /> Pausar
          </Button>
        )}
        {RESUMABLE.has(lead.status) && (
          <Button
            type="button"
            className={ACTION_BUTTON_CLASS}
            disabled={disabled}
            onClick={() => void run(`resume:${contactId}`, { action: "resume", contactId }, "La IA vuelve a responderle")}
          >
            <BusyIcon busy={busyKey === `resume:${contactId}`} icon={<Play />} /> Reanudar
          </Button>
        )}
        {canTakeOver && (
          <Button
            type="button"
            variant="outline"
            className={ACTION_BUTTON_CLASS}
            disabled={disabled}
            onClick={() => void run(`take_over:${contactId}`, { action: "take_over", contactId }, "Es tuyo: la IA ya no le escribe")}
          >
            <BusyIcon busy={busyKey === `take_over:${contactId}`} icon={<Hand />} /> Lo tomo yo
          </Button>
        )}
        {lead.crmUrl && (
          <Button asChild variant="ghost" className={ACTION_BUTTON_CLASS}>
            <a href={lead.crmUrl} target="_blank" rel="noreferrer">
              <ExternalLink /> CRM
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}
