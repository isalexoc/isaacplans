"use client";

/**
 * The last SMS / WhatsApp messages with a lead, read from the CRM only when Isaac opens it, as
 * chat bubbles labeled by who wrote them (Lead / IA / Isaac / Automático).
 */

import { Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThreadMessageItem, ThreadResponse } from "./api-types";
import { formatDateTime } from "./format";
import { AUTHOR_LABELS } from "./labels";
import { EmptyRow, ErrorRow, LoadingRow } from "./ui-bits";
import { useApiView } from "./use-ai-setter-api";

const BUBBLE_CLASSES: Record<ThreadMessageItem["by"], string> = {
  lead: "mr-auto border bg-background",
  ai: "ml-auto bg-blue-600 text-white dark:bg-blue-700",
  isaac: "ml-auto bg-green-600 text-white dark:bg-green-700",
  automation: "ml-auto bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
};

function Bubble({ message }: { message: ThreadMessageItem }) {
  const meta = `${AUTHOR_LABELS[message.by]} · ${message.channel} · ${formatDateTime(message.at)}`;
  if (message.channel === "Call") {
    return (
      <li className="flex items-center justify-center gap-1.5 text-xs italic text-muted-foreground">
        <Phone className="h-3 w-3" /> {message.direction === "inbound" ? "Llamada entrante" : "Llamada saliente"} ·{" "}
        {formatDateTime(message.at)}
      </li>
    );
  }
  return (
    <li className={cn("w-fit max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm", BUBBLE_CLASSES[message.by])}>
      <p className="whitespace-pre-wrap break-words">{message.body || "(sin texto)"}</p>
      <p className="mt-1 text-[11px] opacity-75">{meta}</p>
    </li>
  );
}

export function ThreadView({ contactId }: { contactId: string }) {
  const thread = useApiView<ThreadResponse>(`view=thread&contactId=${encodeURIComponent(contactId)}`);

  if (!thread.data) {
    return thread.error ? (
      <ErrorRow error={thread.error} onRetry={() => void thread.reload()} />
    ) : (
      <LoadingRow text="Leyendo la conversación en el CRM…" />
    );
  }
  const messages = thread.data.messages;
  return (
    <div className="space-y-2">
      {messages.length === 0 ? (
        <EmptyRow>Sin mensajes recientes por SMS o WhatsApp (o el CRM no respondió).</EmptyRow>
      ) : (
        <ol className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3" aria-label="Conversación">
          {messages.map((message, index) => (
            <Bubble key={`${message.at}-${index}`} message={message} />
          ))}
        </ol>
      )}
      <Button type="button" size="sm" variant="ghost" onClick={() => void thread.reload()} disabled={thread.loading}>
        <RefreshCw className={cn(thread.loading && "animate-spin")} /> Actualizar conversación
      </Button>
    </div>
  );
}
