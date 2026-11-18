"use client";

/** The action row of an inbox card: approve (or save the edit and approve), reject, regenerate… */

import { Check, ExternalLink, Hand, RefreshCw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageStatus } from "@/lib/ai-setter/types";
import type { InboxItem } from "./api-types";
import { ACTION_BUTTON_CLASS, BusyIcon } from "./ui-bits";
import type { RunAction } from "./use-ai-setter-api";

/** The textarea as the card sees it: trimmed text, whether it differs, whether it may be saved. */
export type EditState = { text: string; edited: boolean; valid: boolean };

/** What each inbox status allows (mirrors the transitions lib/ai-setter/actions.ts accepts). */
export function capabilitiesOf(status: MessageStatus): { approve: boolean; reject: boolean; regenerate: boolean } {
  return {
    approve: status === "draft",
    reject: status === "draft" || status === "shadow",
    // Never for send_unknown / failed: the message may have reached the lead.
    regenerate: status === "draft" || status === "shadow" || status === "stale" || status === "blocked",
  };
}

type InboxActionsProps = {
  item: InboxItem;
  edit: EditState;
  expired: boolean;
  busyKey: string | null;
  run: RunAction;
  onUndo: () => void;
  onRegenerated: () => void;
};

export function InboxActions({ item, edit, expired, busyKey, run, onUndo, onRegenerated }: InboxActionsProps) {
  const { messageId, contactId } = item;
  const can = capabilitiesOf(item.status);
  const disabled = busyKey !== null;
  const keyOf = (action: string) => `${action}:${messageId}`;
  const takeOverKey = `take_over:${contactId}`;

  const approve = () => void run(keyOf("approve"), { action: "approve", messageId }, "Aprobado: se envía en breve");
  const saveAndApprove = () =>
    void run(keyOf("edit_approve"), { action: "edit_approve", messageId, text: edit.text }, "Editado y aprobado: se envía en breve");
  const reject = () => void run(keyOf("reject"), { action: "reject", messageId }, "Rechazado");
  const takeOver = () => void run(takeOverKey, { action: "take_over", contactId }, "Es tuyo: la IA ya no le escribe");
  const regenerate = async () => {
    const ok = await run(keyOf("regenerate"), { action: "regenerate", messageId }, "Regenerando: el borrador nuevo llega en unos segundos");
    if (ok) onRegenerated();
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {can.approve && !edit.edited && (
        <Button type="button" className={ACTION_BUTTON_CLASS} disabled={disabled || expired || !item.body?.trim()} onClick={approve}>
          <BusyIcon busy={busyKey === keyOf("approve")} icon={<Check />} /> Aprobar
        </Button>
      )}
      {can.approve && edit.edited && (
        <>
          <Button type="button" className={ACTION_BUTTON_CLASS} disabled={disabled || expired || !edit.valid} onClick={saveAndApprove}>
            <BusyIcon busy={busyKey === keyOf("edit_approve")} icon={<Check />} /> Guardar y aprobar
          </Button>
          <Button type="button" variant="ghost" className={ACTION_BUTTON_CLASS} disabled={disabled} onClick={onUndo}>
            <Undo2 /> Deshacer cambios
          </Button>
        </>
      )}
      {can.reject && (
        <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} disabled={disabled} onClick={reject}>
          <BusyIcon busy={busyKey === keyOf("reject")} icon={<X />} /> Rechazar
        </Button>
      )}
      {can.regenerate && (
        <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} disabled={disabled} onClick={() => void regenerate()}>
          <BusyIcon busy={busyKey === keyOf("regenerate")} icon={<RefreshCw />} /> Regenerar
        </Button>
      )}
      <Button type="button" variant="outline" className={ACTION_BUTTON_CLASS} disabled={disabled} onClick={takeOver}>
        <BusyIcon busy={busyKey === takeOverKey} icon={<Hand />} /> Lo tomo yo
      </Button>
      {item.crmUrl && (
        <Button asChild variant="ghost" className={ACTION_BUTTON_CLASS}>
          <a href={item.crmUrl} target="_blank" rel="noreferrer">
            <ExternalLink /> Abrir en CRM
          </a>
        </Button>
      )}
    </div>
  );
}
