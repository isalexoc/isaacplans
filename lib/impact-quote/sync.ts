/**
 * Hands a quote from the agent's intake tab to the presentation tab the client is watching.
 *
 * Both tabs are the same browser and origin, so no server round trip is needed: a
 * BroadcastChannel updates an open presentation at once, and localStorage keeps the latest quote
 * for a presentation opened (or reloaded) afterwards. Per intake token, so two clients never mix.
 * Client-only.
 */

import type { ImpactQuote, ImpactTierKey } from "./plans";

/** A plan picked on a quote screen, on its way to the intake form's "Your plan". */
export type PlanChoice = { tier: ImpactTierKey; monthly: number | null };

const planKey = (scope: string) => `impact-plan:${scope}`;

/**
 * Remember (and broadcast) the plan picked on a quote screen. `scope` is the intake token for the
 * CrankWheel deck — the agent's open form applies it at once — or "guide" for the self-serve page,
 * whose visitor has no intake yet: the form they start next reads it on load.
 */
export function publishPlanChoice(scope: string, choice: PlanChoice): void {
  try {
    localStorage.setItem(planKey(scope), JSON.stringify(choice));
  } catch {
    /* storage blocked */
  }
  try {
    const channel = new BroadcastChannel(planKey(scope));
    channel.postMessage(choice);
    channel.close();
  } catch {
    /* no BroadcastChannel */
  }
}

export function readPlanChoice(scope: string): PlanChoice | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(planKey(scope)) ?? "null") as PlanChoice | null;
    return parsed && typeof parsed.tier === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function subscribePlanChoice(scope: string, onChoice: (choice: PlanChoice) => void): () => void {
  try {
    const channel = new BroadcastChannel(planKey(scope));
    channel.onmessage = (event) => {
      const choice = event.data as PlanChoice | null;
      if (choice && typeof choice.tier === "string") onChoice(choice);
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}

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
