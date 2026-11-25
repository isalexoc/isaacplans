"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deliveryMessage,
  deliveryPhoneDigits,
  whatsappDeliveryHref,
  type DeliveryKind,
  type DeliveryLocale,
} from "@/lib/intake-core/link-delivery";

const WORDS = {
  en: { copy: "Copy link", copied: "Copied", whatsapp: "WhatsApp", share: "Share" },
  es: { copy: "Copiar enlace", copied: "Copiado", whatsapp: "WhatsApp", share: "Compartir" },
} as const;

/**
 * How an agent with no CRM hands a client a link: Copy, WhatsApp from the agent's own phone (the
 * message typed in, naming the agent: lib/intake-core/link-delivery.ts), and the phone's share
 * sheet where the browser has one. WhatsApp opens to the client's number when there is a usable
 * one, otherwise without a recipient so the agent picks the chat. Nothing is sent from here.
 */
export default function DeliveryButtons({
  kind,
  url,
  locale,
  agentName,
  product,
  clientName,
  phone,
  showCopy = true,
  size = "sm",
}: {
  kind: DeliveryKind;
  url: string;
  locale: DeliveryLocale;
  agentName: string;
  product: string;
  /** The client's full name; the message greets them by their first name. */
  clientName?: string | null;
  phone?: string | null;
  /** Off where a Copy button for the same link is already on screen. */
  showCopy?: boolean;
  size?: "sm" | "default";
}) {
  const w = WORDS[locale];
  const [copied, setCopied] = useState(false);
  // Known only in the browser; checked after mount so the server's HTML and the first render agree.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const firstName = (clientName ?? "").trim().split(/\s+/)[0] ?? "";
  const text = deliveryMessage(kind, locale, { agentName, product, clientFirstName: firstName, url });
  const digits = deliveryPhoneDigits(phone);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  async function share() {
    try {
      await navigator.share({ text });
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showCopy && (
        <Button type="button" size={size} variant="ghost" onClick={copy}>
          {copied ? <Check className="mr-1 h-4 w-4 text-green-600" /> : <Copy className="mr-1 h-4 w-4" />}
          {copied ? w.copied : w.copy}
        </Button>
      )}
      <Button asChild size={size} variant="ghost" className="text-green-700 hover:text-green-800 dark:text-green-400">
        <a href={whatsappDeliveryHref(digits, text)} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="mr-1 h-4 w-4" />
          {w.whatsapp}
        </a>
      </Button>
      {canShare && (
        <Button type="button" size={size} variant="ghost" onClick={share}>
          <Share2 className="mr-1 h-4 w-4" />
          {w.share}
        </Button>
      )}
    </div>
  );
}
