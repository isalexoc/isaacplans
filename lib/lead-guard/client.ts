"use client";

import { useEffect } from "react";

import {
  LEAD_FRESH_FIELD,
  LEAD_HONEYPOT_FIELD,
  LEAD_PHONE_ACK_FIELD,
  LEAD_PHONE_RECHECK_KEY,
  LEAD_TOKEN_BODY_ATTR,
  LEAD_TOKEN_FIELD,
  LEAD_TOKEN_PATH,
} from "./constants";

/**
 * Browser half of Lead Guard.
 *
 * The form token comes with the page (<body data-lgt>, rendered by the root layout), so a real
 * browser always has one, with no network call, timestamped at page render. Only a tab older than
 * 6 hours fetches a fresh token at submit (marked "fresh", so its age is not mistaken for an
 * instant bot). On submit the token rides along:
 *   - server-action forms: `useActionState(withLeadGuardAction(serverAction), …)` (module level)
 *   - fetch funnels: `{ ...body, leadGuard: await getLeadGuardPayload() }`
 * Wrapping the server action in a client function also removes React's no-JavaScript form post,
 * which is exactly how the spam bot submitted the contact form.
 *
 * Never blocks a submit: no token just means the server holds that lead for a human look.
 */

const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4_000;

type Token = { t: string | null; fresh: boolean };
let fetched: { t: string; at: number } | null = null;

function tokenIssuedAt(t: string): number | null {
  try {
    const payload = t.split(".")[0];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const iat = (JSON.parse(json) as { iat?: unknown }).iat;
    return typeof iat === "number" ? iat : null;
  } catch {
    return null;
  }
}

async function fetchToken(): Promise<string | null> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    // Pinned to this page's deployment when Vercel skew protection is on.
    const dpl = process.env.NEXT_DEPLOYMENT_ID;
    const res = await fetch(LEAD_TOKEN_PATH, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: dpl ? { "x-deployment-id": dpl } : undefined,
      signal: ctrl?.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { t?: unknown };
    return typeof data.t === "string" && data.t ? data.t : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getLeadToken(): Promise<Token> {
  if (typeof document === "undefined") return { t: null, fresh: false };
  const now = Date.now();
  if (fetched && now - fetched.at < REFRESH_AFTER_MS) return { t: fetched.t, fresh: true };
  const fromPage = document.body?.dataset?.[LEAD_TOKEN_BODY_ATTR] ?? null;
  const iat = fromPage ? tokenIssuedAt(fromPage) : null;
  if (fromPage && iat !== null && now - iat < REFRESH_AFTER_MS) return { t: fromPage, fresh: false };
  const t = await fetchToken();
  if (t) {
    fetched = { t, at: now };
    return { t, fresh: true };
  }
  // An old page token still beats none (the server holds a stale one for review).
  return { t: fromPage, fresh: false };
}

/**
 * On a form's mount: when a long-open tab comes back into view and its page token has aged past
 * 6 hours, fetch a fresh one in the background, so the submit itself never waits for it.
 */
export function useLeadGuardPrefetch(): void {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const fromPage = document.body?.dataset?.[LEAD_TOKEN_BODY_ATTR] ?? null;
      const iat = fromPage ? tokenIssuedAt(fromPage) : null;
      const now = Date.now();
      const pageOld = !iat || now - iat >= REFRESH_AFTER_MS;
      const fetchedOld = !fetched || now - fetched.at >= REFRESH_AFTER_MS;
      if (pageOld && fetchedOld) void getLeadToken();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}

/** For fetch callers: `leadGuard: await getLeadGuardPayload()`. */
export async function getLeadGuardPayload(): Promise<{ t: string | null; f?: 1; hp?: string }> {
  const { t, fresh } = await getLeadToken();
  const hpInput = typeof document !== "undefined"
    ? (document.querySelector(`input[name="${LEAD_HONEYPOT_FIELD}"]`) as HTMLInputElement | null)
    : null;
  return { t, ...(fresh ? { f: 1 as const } : {}), ...(hpInput ? { hp: hpInput.value } : {}) };
}

type ActionStateLike = { status?: unknown; errors?: Record<string, string> } | null | undefined;

/**
 * Wrap a lead server action for useActionState. Create it once at module level:
 *   const guardedSubmit = withLeadGuardAction(submitContactForm);
 * - adds the form token;
 * - a click replayed after success (queued before hydration) returns the success state again;
 * - the visitor re-sending the same phone after "please double-check" is passed on (held, not lost);
 * - a thrown action (network drop, deploy) returns the form's ERROR state instead of crashing the page.
 */
export function withLeadGuardAction<S>(
  action: (prevState: S, formData: FormData) => Promise<S>
): (prevState: S, formData: FormData) => Promise<S> {
  return async (prevState, formData) => {
    const prev = prevState as ActionStateLike;
    if (prev?.status === "SUCCESS") return prevState;
    try {
      const { t, fresh } = await getLeadToken();
      if (t) formData.set(LEAD_TOKEN_FIELD, t);
      if (fresh) formData.set(LEAD_FRESH_FIELD, "1");
      const asked = prev?.errors?.[LEAD_PHONE_RECHECK_KEY];
      const digits = String(formData.get("phone") ?? "").replace(/\D/g, "").slice(-10);
      if (asked && digits && asked === digits) formData.set(LEAD_PHONE_ACK_FIELD, "1");
      return await action(prevState, formData);
    } catch {
      const es = String(formData.get("locale") ?? "").startsWith("es");
      const values: Record<string, string> = {};
      for (const k of ["firstName", "lastName", "email", "phone", "message"]) values[k] = String(formData.get(k) ?? "");
      return {
        status: "ERROR",
        error: es
          ? "No pudimos enviar el formulario. Intente otra vez o llámenos."
          : "We couldn't send the form. Please try again or call us.",
        values,
      } as unknown as S;
    }
  };
}
