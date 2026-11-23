/**
 * What a client component needs to reach the agent on WhatsApp: the first name for the typed
 * message, the number, and the pronoun for the one English sentence that needs one.
 *
 * Browser-safe and free of imports on purpose: the guide's client components (impact-guide.tsx,
 * guide-quote.tsx), which ship to the product domain, import this file, never lib/tenancy/profile.ts
 * (its builders read env and the platform's site address).
 */

import type { AgentPronoun } from "@/components/impact-presentation/copy";

export type AgentContact = {
  firstName: string;
  /** "15406813507", for wa.me links; null hides the WhatsApp buttons. */
  whatsappDigits: string | null;
  pronoun: AgentPronoun | null;
};

/** The wa.me link, with a message typed in when given; null without a number. */
export function whatsappHref(digits: string | null, text?: string): string | null {
  if (!digits || !/^\d{8,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
