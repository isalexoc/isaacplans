"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, MessageSquare, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deliveryMessage,
  deliveryPhoneDigits,
  smsDeliveryHref,
  whatsappDeliveryHref,
  type DeliveryKind,
  type DeliveryLocale,
} from "@/lib/tenancy/delivery";

const WORDS = {
  en: { copy: "Copy link", copied: "Copied", whatsapp: "WhatsApp", sms: "Text", share: "Share" },
  es: { copy: "Copiar enlace", copied: "Copiado", whatsapp: "WhatsApp", sms: "SMS", share: "Compartir" },
} as const;

/**
 * How an agent hands a client a link, with no CRM: Copy, WhatsApp and SMS from the agent's own phone
 * (the message typed in, in the client's language, naming the agent: lib/tenancy/delivery.ts), and
 * the phone's share sheet where the browser has one. WhatsApp and SMS go to the client's number, so
 * they show only when there is a usable one; `anyRecipient` (the agent's guide, which isn't any one
 * client's) opens them without a number for the agent to pick a contact. Nothing is sent from here.
 */
export default function DeliveryButtons({
  kind,
  url,
  uiLocale,
  messageLocale,
  agentName,
  clientFirstName,
  phone,
  anyRecipient = false,
  showCopy = true,
}: {
  kind: DeliveryKind;
  url: string;
  /** The buttons' own words (the page's language). */
  uiLocale: DeliveryLocale;
  /** The message's language (the client's: the application's own). */
  messageLocale: DeliveryLocale;
  agentName: string;
  clientFirstName?: string | null;
  phone?: string | null;
  anyRecipient?: boolean;
  /** Off where a Copy button for the same link is already on screen. */
  showCopy?: boolean;
}) {
  const w = WORDS[uiLocale];
  const [copied, setCopied] = useState(false);
  // Known only in the browser; checked after mount so the server's HTML and the first render agree.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const text = deliveryMessage(kind, messageLocale, { agentName, clientFirstName, url });
  const digits = deliveryPhoneDigits(phone);
  const direct = digits !== null || anyRecipient;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: WhatsApp, SMS and Share still carry the link */
    }
  }

  async function share() {
    try {
      await navigator.share({ text });
    } catch {
      /* dismissed, or the target refused it */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showCopy && (
        <Button type="button" size="sm" variant="ghost" onClick={copy}>
          {copied ? <Check className="mr-1 h-4 w-4 text-green-600" /> : <Copy className="mr-1 h-4 w-4" />}
          {copied ? w.copied : w.copy}
        </Button>
      )}
      {direct && (
        <Button asChild size="sm" variant="ghost" className="text-green-700 hover:text-green-800 dark:text-green-500">
          <a href={whatsappDeliveryHref(digits, text)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1 h-4 w-4" />
            {w.whatsapp}
          </a>
        </Button>
      )}
      {direct && (
        <Button asChild size="sm" variant="ghost">
          <a href={smsDeliveryHref(digits, text)}>
            <MessageSquare className="mr-1 h-4 w-4" />
            {w.sms}
          </a>
        </Button>
      )}
      {canShare && (
        <Button type="button" size="sm" variant="ghost" onClick={share}>
          <Share2 className="mr-1 h-4 w-4" />
          {w.share}
        </Button>
      )}
    </div>
  );
}
