import "server-only";

import { headers } from "next/headers";
import { after } from "next/server";

import { decideLeadGuard, looksLikeJunkName, type LeadGuardDecision, type LeadGuardReason } from "./assess";
import { dailyCap, STRICT_RATE, STRICT_SURFACES, surfaceMode, type LeadGuardMode } from "./config";
import {
  LEAD_FRESH_FIELD,
  LEAD_GUARD_BODY_KEY,
  LEAD_HONEYPOT_FIELD,
  LEAD_PHONE_ACK_FIELD,
  LEAD_PHONE_RECHECK_KEY,
  LEAD_TOKEN_FIELD,
  type LeadGuardSurface,
} from "./constants";
import { hmac } from "./keys";
import { isValidLeadPhone } from "./phone";
import { makeGuardPseudoId, makeQuarantineId, newGuardRecordId, parseGuardPseudoId } from "./pseudo-id";
import { isForeignOrigin, visitorFromHeaders, type VisitorContext } from "./request-context";
import { WEB_VERIFIED_TAG } from "./tags";
import { verifyLeadToken, type LeadTokenCheck } from "./token";

/**
 * Lead Guard entry points (see LEAD_GUARD_SETUP.md):
 *   submitGuardedActionLead — inside the 10 lead server actions (the visitor's request lands there);
 *                             runs create-contact in-process
 *   gateCreateContact       — /api/create-contact (the browser funnels)
 *   gateFrontDoor           — /api/lead-magnets/download and /api/partners/lead
 *   interceptGuardPseudoId  — the step-2 routes (stand-in contact ids of held/blocked leads)
 * Decisions are in assess.ts. The database (store.ts), Telegram (notify.ts), the CRM fallback and
 * create-contact itself are imported lazily: a blocked bot never loads or wakes any of them.
 */

const loadStore = () => import("./store");
const loadNotify = () => import("./notify");
const loadFallback = () => import("./fallback");
const loadCore = () => import("@/lib/create-contact/core");

/** Every lead blob /api/create-contact understands. */
export const LEAD_BLOB_KEYS = [
  "iulLeadGenData",
  "shortTermMedicalData",
  "contactPageData",
  "acaData",
  "dentalVisionData",
  "hospitalIndemnityData",
  "finalExpenseData",
  "getCoveredFastData",
  "lifeInsuranceData",
  "healthAlternativeData",
  "agentCrmData",
  "legalShieldData",
] as const;
/** Only our server actions build these; no browser code ever sends them. */
const SERVER_ONLY_BLOBS = new Set<string>(["contactPageData", "agentCrmData", "getCoveredFastData"]);
/** Referral attribution feeds partner commissions: only lib/referral-partners may set it. */
const REFERRAL_FIELDS = ["referralPartnerSlug", "referralPartnerName", "referralPartnerContact"] as const;

/** DB reads on the submit path never wait longer than this; a slow Neon fails open. */
const RATE_READ_BUDGET_MS = 800;
/** A cold Neon wake-up can take seconds; past this the lead goes to the CRM fallback instead. */
const HOLD_WRITE_BUDGET_MS = 4_000;
/** Non-strict surfaces only query Neon for the daily cap once this instance has seen a burst. */
const LOCAL_BURST_FOR_DB_CHECK = 3;

type ContactFields = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  language?: unknown;
  smsConsent?: unknown;
  marketingConsent?: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function withBudget<T>(p: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([p, new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms))]);
}

/** HMAC of the phone digits: rate limits count people (a resubmit is one person), never phones. */
function subjectOf(phone: unknown): string | null {
  const digits = str(phone).replace(/\D/g, "").slice(-10);
  if (digits.length < 7) return null;
  const mac = hmac("subject", digits);
  return mac ? mac.subarray(0, 12).toString("base64url") : null;
}

function uaFamily(ua: string | undefined): string {
  if (!ua) return "none";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "fb_inapp";
  if (/Instagram/i.test(ua)) return "ig_inapp";
  if (/bot|crawl|spider|curl|wget|python|node-fetch|axios|go-http|java\/|undici/i.test(ua)) return "tool";
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua)) return /Mobile/.test(ua) ? "chrome_mobile" : "chrome";
  if (/Safari\//.test(ua)) return /Mobile/.test(ua) ? "safari_mobile" : "safari";
  if (/Firefox\//.test(ua)) return "firefox";
  return "other";
}

/** One structured line per decision. No PII: no names, emails, phones or IPs. */
function logDecision(
  surface: LeadGuardSurface,
  mode: LeadGuardMode,
  decision: LeadGuardDecision,
  extra: { token: LeadTokenCheck; visitor?: VisitorContext; h?: { get(n: string): string | null }; via: string }
) {
  console.log(
    "[lead-guard]",
    JSON.stringify({
      surface,
      mode,
      verdict: decision.verdict,
      reasons: decision.reasons,
      via: extra.via,
      token: extra.token.state,
      ageMs: "ageMs" in extra.token ? extra.token.ageMs : null,
      ua: uaFamily(extra.visitor?.ua),
      origin: extra.visitor?.origin ? "yes" : "no",
      ja4: extra.h?.get("x-vercel-ja4-digest") ?? null,
      country: extra.h?.get("x-vercel-ip-country") ?? null,
    })
  );
}

// ─── Rate limits ───────────────────────────────────────────────────────────────────────────────

/** Per-instance recent allows per surface (a cheap pre-check so real leads never wait on Neon). */
const localAllows = new Map<LeadGuardSurface, number[]>();

function noteLocalAllow(surface: LeadGuardSurface) {
  const now = Date.now();
  const list = (localAllows.get(surface) ?? []).filter((t) => now - t < 60 * 60_000);
  list.push(now);
  localAllows.set(surface, list);
}

/**
 * Strict forms: always checked (they have no real volume, so nobody waits). Other forms: only once
 * this instance saw a burst, so the 1-a-day real lead never waits on a cold database. Fails open.
 */
async function rateTripped(surface: LeadGuardSurface): Promise<"strict_rate" | "daily_cap" | null> {
  const strict = STRICT_SURFACES.has(surface);
  if (!strict) {
    const recent = (localAllows.get(surface) ?? []).filter((t) => Date.now() - t < 60 * 60_000).length;
    if (recent < LOCAL_BURST_FOR_DB_CHECK) return null;
  }
  try {
    const { countAllowedSince } = await loadStore();
    const now = Date.now();
    const check = strict
      ? Promise.all([
          countAllowedSince([...STRICT_SURFACES], new Date(now - 60 * 60_000)),
          countAllowedSince([...STRICT_SURFACES], new Date(now - 24 * 60 * 60_000)),
        ]).then(([hour, day]) => (hour >= STRICT_RATE.perHour || day >= STRICT_RATE.perDay ? "strict_rate" : null))
      : countAllowedSince([surface], new Date(now - 24 * 60 * 60_000)).then((day) => (day >= dailyCap() ? "daily_cap" : null));
    const out = await withBudget(check, RATE_READ_BUDGET_MS);
    if (out === "timeout") {
      console.warn("[lead-guard] rate check timed out (fail open)", { surface });
      return null;
    }
    return out as "strict_rate" | "daily_cap" | null;
  } catch (err) {
    console.warn("[lead-guard] rate check failed (fail open):", err instanceof Error ? err.message : String(err));
    return null;
  }
}

function recordEventLater(
  surface: LeadGuardSurface,
  verdict: "allow" | "hold" | "block",
  reasons: string[],
  shadow: boolean,
  subject: string | null
) {
  after(async () => {
    const { recordLeadGuardEvent } = await loadStore();
    await recordLeadGuardEvent(surface, verdict, reasons, shadow, subject);
  });
}

// ─── Holding a lead ────────────────────────────────────────────────────────────────────────────

/**
 * Store a hold (encrypted) and alert Isaac; returns the stand-in contact id for the response.
 * If the hold can't be stored in time, the lead goes to the CRM as a bare `web_review` contact
 * before we answer, and the stand-in id points at that contact (a late-committing hold row is then
 * marked superseded, so the lead never exists twice). Returns null when neither the database nor
 * the CRM took the lead: the caller must answer with the form's normal error so the person retries.
 */
async function holdLead(args: {
  surface: LeadGuardSurface;
  leadType: string | null;
  route: string;
  body: Record<string, unknown>;
  visitor: VisitorContext;
  reasons: LeadGuardReason[];
  contact: ContactFields;
}): Promise<string | null> {
  const id = newGuardRecordId();
  const subject = subjectOf(args.contact.phone);
  try {
    const { holdPreview, insertLeadHold, recordLeadGuardEvent } = await loadStore();
    const preview = holdPreview(args.contact);
    const insert = insertLeadHold({
      id,
      surface: args.surface,
      leadType: args.leadType,
      route: args.route,
      reasons: args.reasons,
      payload: { body: args.body, ctx: { ip: args.visitor.ip, ua: args.visitor.ua } },
      preview,
    }).then(() => true);
    const stored = await withBudget(insert, HOLD_WRITE_BUDGET_MS);
    if (stored === "timeout") {
      // The insert keeps running; if it commits after we quarantined, retire that row.
      after(async () => {
        try {
          if (await insert) {
            const { supersedeLeadHold } = await loadStore();
            await supersedeLeadHold(id);
          }
        } catch {
          /* it never committed */
        }
      });
    }
    if (stored === true) {
      after(async () => {
        await recordLeadGuardEvent(args.surface, "hold", args.reasons, false, subject);
        const { notifyLeadHeld } = await loadNotify();
        await notifyLeadHeld({ holdId: id, surface: args.surface, reasons: args.reasons, preview });
      });
      return makeGuardPseudoId("hold", id) ?? "";
    }
    console.error("[lead-guard] hold insert timed out; quarantining in the CRM");
  } catch (err) {
    console.error("[lead-guard] hold insert failed; quarantining in the CRM:", err instanceof Error ? err.message : String(err));
  }

  const { quarantineLeadInCrm } = await loadFallback();
  const ghlId = await quarantineLeadInCrm({
    surface: args.surface,
    reasons: args.reasons,
    firstName: str(args.contact.firstName) || "Website",
    lastName: str(args.contact.lastName) || "Lead",
    email: str(args.contact.email) || null,
    phone: str(args.contact.phone) || null,
    language: str(args.contact.language) || null,
    smsConsent: args.contact.smsConsent,
    marketingConsent: args.contact.marketingConsent,
  });
  after(async () => {
    const { notifyQuarantined } = await loadNotify();
    await notifyQuarantined({ surface: args.surface, reasons: args.reasons, inCrm: Boolean(ghlId) });
  });
  return ghlId ? makeQuarantineId(ghlId) : null;
}

// ─── Server actions ────────────────────────────────────────────────────────────────────────────

export type GuardedActionInput = {
  formData: FormData;
  surface: LeadGuardSurface;
  locale: "en" | "es";
  /** The lead blob key in `body` (contactPageData, acaData, …). */
  leadType: string;
  /** Normalized values the action already validated. `phone` is E.164. */
  contact: { firstName: string; lastName: string; email?: string; phone: string; language: string };
  consents?: { smsConsent?: boolean; marketingConsent?: boolean };
  /** Exactly the JSON create-contact receives. */
  body: Record<string, unknown>;
};

export type GuardedActionResult =
  | { kind: "phone_recheck"; message: string; errors: Record<string, string> }
  | { kind: "accepted"; isNewContact: boolean }
  | { kind: "error"; message: string };

const PHONE_RECHECK_MESSAGE = {
  en: "Please double-check this phone number. If it is correct, send the form again.",
  es: "Por favor revise este número de teléfono. Si está correcto, envíe el formulario otra vez.",
} as const;

async function runCreateContact(
  body: Record<string, unknown>,
  visitor: VisitorContext,
  locale: "en" | "es"
): Promise<GuardedActionResult> {
  try {
    const { createContactCore } = await loadCore();
    const result = await createContactCore(body, {
      visitor: { ip: visitor.ip, ua: visitor.ua },
      extraTags: [WEB_VERIFIED_TAG],
    });
    if (result.status >= 400) {
      const error = typeof result.body.error === "string" ? result.body.error : "";
      return { kind: "error", message: error || (locale === "es" ? "Error al procesar." : "Error processing.") };
    }
    return { kind: "accepted", isNewContact: !result.body.isExisting };
  } catch (err) {
    console.error("[lead-guard] create-contact failed:", err instanceof Error ? err.message : String(err));
    return { kind: "error", message: locale === "es" ? "Error al procesar." : "Error processing." };
  }
}

export async function submitGuardedActionLead(input: GuardedActionInput): Promise<GuardedActionResult> {
  const h = await headers();
  const visitor = visitorFromHeaders(h);
  const mode = surfaceMode(input.surface);

  if (mode === "off") return runCreateContact(input.body, visitor, input.locale);

  const token = verifyLeadToken(input.formData.get(LEAD_TOKEN_FIELD));
  const hpRaw = input.formData.get(LEAD_HONEYPOT_FIELD);
  const phoneValid = isValidLeadPhone(input.contact.phone);
  const phoneAcknowledged = phoneValid === false && input.formData.get(LEAD_PHONE_ACK_FIELD) === "1";

  let decision = decideLeadGuard({
    jsSubmit: visitor.hasNextActionHeader,
    token,
    freshToken: input.formData.get(LEAD_FRESH_FIELD) === "1",
    honeypot: hpRaw === null ? "absent" : String(hpRaw).trim() ? "filled" : "empty",
    originMissing: false,
    originForeign: isForeignOrigin(visitor),
    phoneValid,
    phoneAcknowledged,
    nameJunk: looksLikeJunkName(input.contact.firstName, input.contact.lastName),
    blobIssue: null,
    rateTripped: null,
  });

  // A first invalid number gets the normal inline error (typos are common); the same number sent
  // again goes through as a hold. Bots that would be blocked anyway get no hint.
  if (mode === "enforce" && decision.verdict !== "block" && phoneValid === false && !phoneAcknowledged) {
    logDecision(input.surface, mode, { verdict: "hold", reasons: ["phone_invalid"] }, { token, visitor, h, via: "action:phone_recheck" });
    return {
      kind: "phone_recheck",
      message: PHONE_RECHECK_MESSAGE[input.locale],
      errors: {
        phone: PHONE_RECHECK_MESSAGE[input.locale],
        // Last 10 digits: the form posts the national format, the action normalized to E.164.
        [LEAD_PHONE_RECHECK_KEY]: input.contact.phone.replace(/\D/g, "").slice(-10),
      },
    };
  }

  if (decision.verdict === "allow") {
    const tripped = await rateTripped(input.surface);
    if (tripped) decision = { verdict: "hold", reasons: [tripped] };
  }
  logDecision(input.surface, mode, decision, { token, visitor, h, via: "action" });
  const subject = subjectOf(input.contact.phone);

  if (mode === "shadow" || decision.verdict === "allow") {
    const result = await runCreateContact(input.body, visitor, input.locale);
    if (result.kind === "accepted") {
      noteLocalAllow(input.surface);
      recordEventLater(input.surface, mode === "shadow" ? decision.verdict : "allow", decision.reasons, mode === "shadow" && decision.verdict !== "allow", subject);
    }
    return result;
  }

  if (decision.verdict === "block") return { kind: "accepted", isNewContact: true };

  const heldAs = await holdLead({
    surface: input.surface,
    leadType: input.leadType,
    route: "/api/create-contact",
    body: input.body,
    visitor,
    reasons: decision.reasons,
    contact: { ...input.contact, ...input.consents },
  });
  if (!heldAs) {
    return {
      kind: "error",
      message: input.locale === "es" ? "No pudimos enviar el formulario. Intente otra vez." : "We couldn't send the form. Please try again.",
    };
  }
  return { kind: "accepted", isNewContact: true };
}

// ─── /api/create-contact (browser funnels) ─────────────────────────────────────────────────────

function browserSurface(body: Record<string, unknown>): LeadGuardSurface {
  const src = (k: string) => (isPlainObject(body[k]) ? str((body[k] as Record<string, unknown>).source) : "");
  if (isPlainObject(body.legalShieldData)) return "legal_shield";
  if (LEAD_BLOB_KEYS.some((k) => src(k) === "consumer_guides")) return "guide_download";
  if (isPlainObject(body.iulLeadGenData)) {
    const s = src("iulLeadGenData");
    if (s === "iul_guia_ads") return "iul_guia";
    if (s === "iul_get_covered_ads") return "iul_funnel";
    return "iul_lead_gen";
  }
  if (isPlainObject(body.finalExpenseData)) return "final_expense_funnel";
  if (isPlainObject(body.acaData)) return "aca_funnel";
  if (isPlainObject(body.lifeInsuranceData)) return "life_insurance_funnel";
  if (isPlainObject(body.healthAlternativeData)) return "health_alternative_funnel";
  return "web_other";
}

function blobOf(body: Record<string, unknown>): Record<string, unknown> | null {
  for (const k of LEAD_BLOB_KEYS) {
    const b = body[k];
    if (isPlainObject(b)) return b;
  }
  return null;
}

/** Guard-only keys never reach create-contact; referral attribution never comes from a browser. */
function cleanBrowserBody(body: Record<string, unknown>): { clean: Record<string, unknown>; leadGuard: Record<string, unknown> | null } {
  const { [LEAD_GUARD_BODY_KEY]: leadGuard, _guard: _legacy, ...clean } = body;
  for (const k of LEAD_BLOB_KEYS) {
    const b = clean[k];
    if (isPlainObject(b) && REFERRAL_FIELDS.some((f) => f in b)) {
      const copy = { ...b };
      for (const f of REFERRAL_FIELDS) delete copy[f];
      clean[k] = copy;
    }
  }
  return { clean, leadGuard: isPlainObject(leadGuard) ? leadGuard : null };
}

function browserSignals(
  visitor: VisitorContext,
  leadGuard: Record<string, unknown> | null,
  contact: ContactFields,
  blobIssue: "multi_blob" | "no_blob" | "server_only_blob" | null
) {
  const token = verifyLeadToken(leadGuard?.t);
  const hp = leadGuard?.hp;
  return {
    token,
    signals: {
      jsSubmit: null,
      token,
      freshToken: leadGuard?.f === 1 || leadGuard?.f === "1",
      honeypot: hp === undefined || hp === null ? ("absent" as const) : str(hp).trim() ? ("filled" as const) : ("empty" as const),
      originMissing: !visitor.origin,
      originForeign: isForeignOrigin(visitor),
      phoneValid: isValidLeadPhone(str(contact.phone)),
      phoneAcknowledged: false,
      nameJunk: looksLikeJunkName(str(contact.firstName), str(contact.lastName)),
      blobIssue,
      rateTripped: null,
    },
  };
}

export type CreateContactGate =
  | {
      kind: "proceed";
      body: Record<string, unknown>;
      visitor: { ip?: string; ua?: string };
      extraTags: string[];
    }
  | { kind: "fake_success"; contactId: string }
  /** Neither the hold store nor the CRM took a held lead: answer an error so the person retries. */
  | { kind: "unavailable" };

export async function gateCreateContact(
  request: { headers: { get(name: string): string | null } },
  body: Record<string, unknown>
): Promise<CreateContactGate> {
  const { clean, leadGuard } = cleanBrowserBody(body);
  const surface = browserSurface(clean);
  const mode = surfaceMode(surface);
  const visitor = visitorFromHeaders(request.headers);
  const proceed: CreateContactGate = {
    kind: "proceed",
    body: clean,
    visitor: { ip: visitor.ip, ua: visitor.ua },
    extraTags: [WEB_VERIFIED_TAG],
  };
  if (mode === "off") return proceed;

  const blobs = LEAD_BLOB_KEYS.filter((k) => isPlainObject(clean[k]));
  const blobIssue =
    blobs.length === 0 ? "no_blob" : blobs.length > 1 ? "multi_blob" : SERVER_ONLY_BLOBS.has(blobs[0]) ? "server_only_blob" : null;
  const blob = blobOf(clean);
  const contact: ContactFields = {
    firstName: clean.firstName,
    lastName: clean.lastName,
    email: clean.email,
    phone: clean.phone,
    language: blob?.language,
    smsConsent: blob?.smsConsent,
    marketingConsent: blob?.marketingConsent,
  };
  const { token, signals } = browserSignals(visitor, leadGuard, contact, blobIssue);
  let decision = decideLeadGuard(signals);
  if (decision.verdict === "allow") {
    const tripped = await rateTripped(surface);
    if (tripped) decision = { verdict: "hold", reasons: [tripped] };
  }
  logDecision(surface, mode, decision, { token, visitor, h: request.headers, via: "route" });
  const subject = subjectOf(contact.phone);

  if (mode === "shadow" || decision.verdict === "allow") {
    noteLocalAllow(surface);
    recordEventLater(surface, mode === "shadow" ? decision.verdict : "allow", decision.reasons, mode === "shadow" && decision.verdict !== "allow", subject);
    return proceed;
  }
  if (decision.verdict === "block") {
    return { kind: "fake_success", contactId: makeGuardPseudoId("block") ?? "" };
  }
  const contactId = await holdLead({
    surface,
    leadType: blobs[0] ?? null,
    route: "/api/create-contact",
    body: clean,
    visitor,
    reasons: decision.reasons,
    contact,
  });
  return contactId ? { kind: "fake_success", contactId } : { kind: "unavailable" };
}

// ─── Front-door routes (lead-magnets/download, partners/lead) ───────────────────────────────────

export type FrontDoorGate =
  | { kind: "proceed"; body: Record<string, unknown>; visitor: { ip?: string; ua?: string } }
  | { kind: "block"; body: Record<string, unknown> }
  | { kind: "hold"; body: Record<string, unknown> }
  | { kind: "unavailable"; body: Record<string, unknown> };

export async function gateFrontDoor(
  request: { headers: { get(name: string): string | null } },
  body: Record<string, unknown>,
  opts: { surface: LeadGuardSurface; route: string; contact: ContactFields }
): Promise<FrontDoorGate> {
  const { clean, leadGuard } = cleanBrowserBody(body);
  const visitor = visitorFromHeaders(request.headers);
  const mode = surfaceMode(opts.surface);
  if (mode === "off") return { kind: "proceed", body: clean, visitor: { ip: visitor.ip, ua: visitor.ua } };

  const { token, signals } = browserSignals(visitor, leadGuard, opts.contact, null);
  let decision = decideLeadGuard(signals);
  if (decision.verdict === "allow") {
    const tripped = await rateTripped(opts.surface);
    if (tripped) decision = { verdict: "hold", reasons: [tripped] };
  }
  logDecision(opts.surface, mode, decision, { token, visitor, h: request.headers, via: "front_door" });
  const subject = subjectOf(opts.contact.phone);

  if (mode === "shadow" || decision.verdict === "allow") {
    noteLocalAllow(opts.surface);
    recordEventLater(opts.surface, mode === "shadow" ? decision.verdict : "allow", decision.reasons, mode === "shadow" && decision.verdict !== "allow", subject);
    return { kind: "proceed", body: clean, visitor: { ip: visitor.ip, ua: visitor.ua } };
  }
  if (decision.verdict === "block") return { kind: "block", body: clean };
  const heldAs = await holdLead({
    surface: opts.surface,
    leadType: null,
    route: opts.route,
    body: clean,
    visitor,
    reasons: decision.reasons,
    contact: opts.contact,
  });
  return heldAs ? { kind: "hold", body: clean } : { kind: "unavailable", body: clean };
}

// ─── Step-2 routes ─────────────────────────────────────────────────────────────────────────────

export type PseudoIdIntercept = { action: "respond" } | { action: "continue"; contactId: string };

/** Step-2 fields as note lines: values, lists joined, objects as JSON (safe characters only). */
function step2NoteLines(body: Record<string, unknown>): string[] {
  const clean = (v: string) => v.replace(/[^\p{L}\p{N}@._+\-',:/ ]/gu, "").slice(0, 200);
  const show = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (["string", "number", "boolean"].includes(typeof v)) return clean(String(v));
    if (Array.isArray(v)) return clean(v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", "));
    try {
      return clean(JSON.stringify(v));
    } catch {
      return null;
    }
  };
  return Object.entries(body)
    .filter(([k]) => k !== "contactId" && k !== LEAD_GUARD_BODY_KEY)
    .slice(0, 30)
    .flatMap(([k, v]) => {
      const shown = show(v);
      return shown === null ? [] : [`${k}: ${shown}`];
    });
}

/**
 * A stand-in contact id from Lead Guard:
 *   hold, still held → the step-2 data is filed with the hold (replayed on release) → respond
 *   hold, released   → continue with the real contact id (the route does its normal work)
 *   block            → respond (ignored)
 *   quarantine       → the step-2 answers become a note on that `web_review` contact → respond
 * Null for a real contact id. "respond" means: answer with the route's normal success shape.
 */
export async function interceptGuardPseudoId(
  contactId: unknown,
  route: string,
  body: Record<string, unknown>
): Promise<PseudoIdIntercept | null> {
  const parsed = parseGuardPseudoId(contactId);
  if (!parsed) return null;
  if (parsed.kind === "block") return { action: "respond" };
  if (parsed.kind === "quarantine") {
    try {
      const [{ createContactNote }, { agentCrmGetBaseCredentials }] = await Promise.all([
        import("@/lib/agent-crm-call-summary"),
        import("@/lib/agent-crm-contacts"),
      ]);
      const creds = agentCrmGetBaseCredentials();
      if (creds) {
        await createContactNote({
          contactId: parsed.ghlContactId,
          token: creds.token,
          title: "Paso 2 del formulario (lead retenido)",
          body: [`Ruta: ${route}`, ...step2NoteLines(body)].join("\n"),
        });
      }
    } catch (err) {
      console.error("[lead-guard] step-2 note failed:", err instanceof Error ? err.message : String(err));
    }
    return { action: "respond" };
  }
  try {
    const { appendToLeadHold } = await loadStore();
    const outcome = await appendToLeadHold(parsed.id, route, body);
    if (outcome.kind === "released") return { action: "continue", contactId: outcome.contactId };
    if (outcome.kind === "ignored") console.warn("[lead-guard] step-2 data not filed", { route, why: outcome.why });
  } catch (err) {
    console.error("[lead-guard] step-2 append failed:", err instanceof Error ? err.message : String(err));
  }
  return { action: "respond" };
}
