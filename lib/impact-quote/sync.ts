/**
 * Hands a quote from the agent's intake tab to the presentation tab the client is watching.
 *
 * Both tabs are the same browser and origin, so no server round trip is needed: a
 * BroadcastChannel updates an open presentation at once, and localStorage keeps the latest quote
 * for a presentation opened (or reloaded) afterwards. Per intake token, so two clients never mix.
 * Client-only.
 */

import type { ImpactQuote } from "./plans";

const key = (token: string) => `impact-quote:${token}`;

export function publishQuote(token: string, quote: ImpactQuote | null): void {
  try {
    if (quote) localStorage.setItem(key(token), JSON.stringify(quote));
    else localStorage.removeItem(key(token));
  } catch {
    /* storage blocked: the open tab still gets the broadcast */
  }
  try {
    const channel = new BroadcastChannel(key(token));
    channel.postMessage(quote);
    channel.close();
  } catch {
    /* no BroadcastChannel (very old browser): a reload of the presentation picks it up */
  }
}

export function readStoredQuote(token: string): ImpactQuote | null {
  try {
    const raw = localStorage.getItem(key(token));
    const parsed = raw ? (JSON.parse(raw) as ImpactQuote) : null;
    return parsed && Array.isArray(parsed.plans) ? parsed : null;
  } catch {
    return null;
  }
}

/** Calls `onQuote` whenever the agent publishes; returns the unsubscribe. */
export function subscribeQuote(token: string, onQuote: (quote: ImpactQuote | null) => void): () => void {
  try {
    const channel = new BroadcastChannel(key(token));
    channel.onmessage = (event) => onQuote((event.data as ImpactQuote | null) ?? null);
    return () => channel.close();
  } catch {
    return () => {};
  }
}
