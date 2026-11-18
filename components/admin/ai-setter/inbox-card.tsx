"use client";

/**
 * One inbox item: who it is for, what the AI wants to send (editable while it is a draft), the
 * reviewer's warnings, the conversation on demand, and what Isaac can do about it.
 */

import { useState } from "react";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { InboxItem } from "./api-types";
import { InboxActions, capabilitiesOf, type EditState } from "./inbox-actions";
import { formatDateTime, formatRelative, formatTimeLeft, isFuture, isPast } from "./format";
import { MESSAGE_STATUS_META, guardFlagLabel, languageLabel, problemLabel } from "./labels";
import { MAX_EDIT_CHARS, SegmentCounter } from "./segment-counter";
import { ThreadView } from "./thread-view";
import { Notice, Pill } from "./ui-bits";
import type { RunAction } from "./use-ai-setter-api";

type InboxCardProps = {
  item: InboxItem;
  nowMs: number;
  busyKey: string | null;
  run: RunAction;
  highlighted: boolean;
  onRegenerated: () => void;
};

/** DOM id of a card, for `?m=<messageId>` scrolling. Message ids are [A-Za-z0-9_-]. */
export function cardDomId(messageId: string): string {
  return `ai-setter-msg-${messageId}`;
}

/** Tall enough to read the whole draft on a phone (~40 characters a line), 3 to 10 rows. */
function rowsFor(text: string): number {
  const lines = text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 40)), 0);
  return Math.min(10, Math.max(3, lines));
}

function metaLine(item: InboxItem): string {
  return [
    item.productLabelEs ?? "Sin producto",
    item.stateCode ?? "Estado ?",
    item.channel,
    languageLabel(item.language, item.register),
  ].join(" · ");
}

function timingLine(item: InboxItem, nowMs: number): string {
  const parts = [`Creado ${formatRelative(item.createdAt, nowMs)}`];
  if (item.status === "draft" && item.expiresAt) {
    const left = formatTimeLeft(item.expiresAt, nowMs);
    parts.push(left ? `vence en ${left}` : "venció");
  }
  if (isFuture(item.notBefore, nowMs)) parts.push(`sale desde ${formatDateTime(item.notBefore)} (horario del lead)`);
  return parts.join(" · ");
}

function CardTitleRow({ item }: { item: InboxItem }) {
  const status = MESSAGE_STATUS_META[item.status];
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold">{item.firstName ?? "Sin nombre"}</p>
        <p className="text-xs text-muted-foreground">{metaLine(item)}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        {item.usedFallback && <Pill tone="amber">Modelo de respaldo</Pill>}
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>
    </div>
  );
}

function GuardFlags({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <Notice tone="amber" className="p-2 text-xs">
      <p className="mb-1 flex items-center gap-1 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" /> Avisos del revisor
      </p>
      <ul className="flex flex-wrap gap-1">
        {flags.map((flag) => (
          <li key={flag} title={flag} className="break-words rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-900/40">
            {guardFlagLabel(flag)}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

function ProblemNotice({ item }: { item: InboxItem }) {
  if (item.status === "send_unknown") {
    return (
      <Notice tone="red">
        No se sabe si salió. Revisa la conversación en el CRM antes de escribirle: no se reenvía solo.
        {item.problem && <span className="mt-1 block text-xs opacity-80">Código: {item.problem}</span>}
      </Notice>
    );
  }
  const label = problemLabel(item.problem);
  if (!label) return null;
  return <Notice tone={item.status === "stale" ? "amber" : "red"}>{label}</Notice>;
}

function BodyField({
  item,
  text,
  editable,
  onChange,
}: {
  item: InboxItem;
  text: string;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  if (item.body === null) {
    return <p className="text-sm italic text-muted-foreground">(texto borrado por la retención de 90 días)</p>;
  }
  return (
    <div className="space-y-1">
      {editable ? (
        <Textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={rowsFor(text)}
          aria-label={`Mensaje para ${item.firstName ?? "el lead"}`}
          className="text-base sm:text-sm"
        />
      ) : (
        <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm">{item.body}</p>
      )}
      <SegmentCounter channel={item.channel} text={editable ? text : item.body} />
    </div>
  );
}

export function InboxCard({ item, nowMs, busyKey, run, highlighted, onRegenerated }: InboxCardProps) {
  const original = item.body ?? "";
  const [text, setText] = useState(original);
  const [showThread, setShowThread] = useState(false);
  const editable = capabilitiesOf(item.status).approve && item.body !== null;
  const trimmed = text.trim();
  const edit: EditState = {
    text: trimmed,
    edited: editable && trimmed !== original.trim(),
    valid: trimmed.length > 0 && text.length <= MAX_EDIT_CHARS,
  };
  const expired = item.status === "draft" && isPast(item.expiresAt, nowMs);

  return (
    <Card
      id={cardDomId(item.messageId)}
      className={cn("scroll-mt-24", highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
    >
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardTitleRow item={item} />
        <p className="text-xs text-muted-foreground">
          {item.kind === "template" ? `Plantilla ${item.templateId ?? "?"}` : "Texto libre de la IA"}
          {item.intent ? ` · intención: ${item.intent}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">{timingLine(item, nowMs)}</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <ProblemNotice item={item} />
        <BodyField item={item} text={text} editable={editable} onChange={setText} />
        <GuardFlags flags={item.guardFlags} />
        {expired && <Notice tone="amber">Este borrador venció. Regenéralo para responder con el contexto de ahora.</Notice>}
        <Button type="button" variant="ghost" size="sm" className="px-0" onClick={() => setShowThread((v) => !v)}>
          <MessageSquare /> {showThread ? "Ocultar conversación" : "Ver conversación"}
        </Button>
        {showThread && <ThreadView contactId={item.contactId} />}
        <InboxActions
          item={item}
          edit={edit}
          expired={expired}
          busyKey={busyKey}
          run={run}
          onUndo={() => setText(original)}
          onRegenerated={onRegenerated}
        />
      </CardContent>
    </Card>
  );
}
