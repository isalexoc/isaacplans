/**
 * Hands a quote from the agent's intake tab to the presentation tab the client is watching.
 *
 * Both tabs are the same browser and origin, so no server round trip is needed: a
 * BroadcastChannel updates an open presentation at once, and localStorage keeps the latest quote
 * for a presentation opened (or reloaded) afterwards. Per intake token, so two clients never mix.
 * Client-only (storage is touched only when a function runs, so the offline test can import it).
 */

import { isQuoteBlock, TIERS, type ImpactQuote, type ImpactTierKey, type QuoteBlock } from "./plans";

/**
 * A plan picked on a quote screen, on its way to the intake form's "Your plan".
 *  - `tier` null: no standard plan was picked (a quote with none of the four); its `quote` can
 *    still travel.
 *  - `at`: when it was picked (ISO). A "guide" choice without one is stale.
 *  - `auto`: sent by the deck without a tap, for a quote it was already showing: it fills a blank
 *    plan only, and never replaces one picked on the form.
 *  - `quote`: the answers behind it. Only ever in the broadcast; localStorage stays plan-only, so no
 *    birth date sits there (the public /impact page runs ad trackers).
 *  - `quoteId`: all localStorage keeps of that quote, its random id (no answers), so another tap on
 *    the same quote keeps `appliedTo`.
 *  - `appliedTo`: the intake a "guide" choice already went into (`markPlanChoiceApplied`).
 */
export type PlanChoice = {
  tier: ImpactTierKey | null;
  monthly: number | null;
  at?: string;
  auto?: boolean;
  quote?: QuoteBlock;
  quoteId?: string;
  appliedTo?: string;
};

/** The self-serve page's scope: its visitor has no intake yet. */
export const GUIDE_SCOPE = "guide";

/**
 * A "guide" choice older than this is not the visit that led to "Apply now" (another day, or
 * someone else on a shared device): it never applies.
 */
export const GUIDE_CHOICE_TTL_MS = 12 * 60 * 60 * 1000;

const planKey = (scope: string) => `impact-plan:${scope}`;
const blockKey = (scope: string) => `impact-quote-block:${scope}`;
const TIER_KEYS: string[] = TIERS.map((t) => t.key);

/** A choice another page stored or sent, checked field by field; null when it isn't one. */
function asPlanChoice(value: unknown): PlanChoice | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.tier !== null && !(typeof v.tier === "string" && TIER_KEYS.includes(v.tier))) return null;
  const choice: PlanChoice = {
    tier: (v.tier as ImpactTierKey | null) ?? null,
    monthly: typeof v.monthly === "number" && Number.isFinite(v.monthly) ? v.monthly : null,
  };
  if (typeof v.at === "string") choice.at = v.at;
  if (v.auto === true) choice.auto = true;
  if (isQuoteBlock(v.quote)) choice.quote = v.quote;
  if (typeof v.quoteId === "string" && v.quoteId) choice.quoteId = v.quoteId;
  if (typeof v.appliedTo === "string" && v.appliedTo) choice.appliedTo = v.appliedTo;
  return choice;
}

/** What localStorage keeps: the plan and its quote's id, never the answers behind it. */
function planOnly({ tier, monthly, at, auto, quote, quoteId, appliedTo }: PlanChoice): PlanChoice {
  const id = quote?.id ?? quoteId;
  return {
    tier,
    monthly,
    ...(at ? { at } : {}),
    ...(auto ? { auto } : {}),
    ...(id ? { quoteId: id } : {}),
    ...(appliedTo ? { appliedTo } : {}),
  };
}

/** The choice stored for `scope`, as stored (fresh or not). */
function storedChoice(scope: string): PlanChoice | null {
  try {
    return asPlanChoice(JSON.parse(localStorage.getItem(planKey(scope)) ?? "null"));
  } catch {
    return null;
  }
}

/**
 * Remember (and broadcast) the plan picked on a quote screen. `scope` is the intake token for the
 * CrankWheel deck — the agent's open form applies it at once — or "guide" for the self-serve page,
 * whose visitor has no intake yet: the form they start next reads it on load. The quote behind it
 * rides in the broadcast only; the screen keeps it for its own tab with `stashQuoteBlock`. A pick
 * on a quote already spent on an intake (`appliedTo`) stays spent: only a new quote frees it.
 */
export function publishPlanChoice(scope: string, choice: PlanChoice): void {
  const previous = storedChoice(scope);
  const sameQuote = Boolean(choice.quote && previous?.quoteId === choice.quote.id);
  const plan = planOnly({ ...choice, appliedTo: sameQuote ? previous?.appliedTo : undefined });
  try {
    localStorage.setItem(planKey(scope), JSON.stringify(plan));
  } catch {
    /* storage blocked */
  }
  try {
    const channel = new BroadcastChannel(planKey(scope));
    const message: PlanChoice = { ...plan, ...(choice.quote ? { quote: choice.quote } : {}) };
    delete message.appliedTo;
    channel.postMessage(message);
    channel.close();
  } catch {
    /* no BroadcastChannel */
  }
}

/** Whether a stored choice may still apply: fresh enough, and not spent on another intake. Pure. */
export function planChoiceUsable(
  choice: PlanChoice,
  scope: string,
  { maxAgeMs, token, now = Date.now() }: { maxAgeMs?: number; token?: string; now?: number } = {}
): boolean {
  const ttl = maxAgeMs ?? (scope === GUIDE_SCOPE ? GUIDE_CHOICE_TTL_MS : undefined);
  if (ttl !== undefined) {
    const at = choice.at ? Date.parse(choice.at) : NaN;
    if (!Number.isFinite(at) || now - at > ttl) return false;
  }
  return !(token && choice.appliedTo && choice.appliedTo !== token);
}

/**
 * The latest choice stored for `scope`, plan only. The "guide" scope only gives one picked less
 * than 12 hours ago (`maxAgeMs` overrides that), and with `token`, only one not already applied to
 * a different intake.
 */
export function readPlanChoice(
  scope: string,
  options: { maxAgeMs?: number; token?: string } = {}
): PlanChoice | null {
  const choice = storedChoice(scope);
  return choice && planChoiceUsable(choice, scope, options) ? choice : null;
}

/** The form used this choice: from now on it is spent for any other intake (a shared device). */
export function markPlanChoiceApplied(scope: string, token: string): void {
  const choice = storedChoice(scope);
  if (!choice) return;
  try {
    localStorage.setItem(planKey(scope), JSON.stringify(planOnly({ ...choice, appliedTo: token })));
  } catch {
    /* storage blocked: the 12-hour limit still applies */
  }
}

/** Calls `onChoice` for every choice published; one with no plan counts only when a quote rides along. */
export function subscribePlanChoice(scope: string, onChoice: (choice: PlanChoice) => void): () => void {
  try {
    const channel = new BroadcastChannel(planKey(scope));
    channel.onmessage = (event) => {
      const choice = asPlanChoice(event.data);
      if (choice && (choice.tier || choice.quote)) onChoice(choice);
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}

/*
 * The quote behind a pick, for THIS tab only (sessionStorage). The deck's "Confirm my details" and
 * /impact's "Apply now" both open the application in the same tab, so it is there when the form
 * loads, and it never outlives the tab.
 */

export function stashQuoteBlock(scope: string, block: QuoteBlock): void {
  try {
    sessionStorage.setItem(blockKey(scope), JSON.stringify(block));
  } catch {
    /* storage blocked: the form then gets the plan only */
  }
}

export function readQuoteBlock(scope: string): QuoteBlock | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(blockKey(scope)) ?? "null");
    return isQuoteBlock(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearQuoteBlock(scope: string): void {
  try {
    sessionStorage.removeItem(blockKey(scope));
  } catch {
    /* nothing to clear */
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
