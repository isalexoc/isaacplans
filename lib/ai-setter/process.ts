/**
 * Server wiring for the AI Setter: real adapters, the webhook poke, the QStash job runner and
 * the daily reconcile. Every Claude turn and every send runs from /api/queue/ai-setter — never
 * inline in a webhook (a turn can take minutes; the webhook only acknowledges).
 */

import "server-only";

import { publishJob } from "@/lib/qstash/client";
import { isQStashPublishConfigured, isQStashReceiveConfigured } from "@/lib/qstash/config";
import { localCalendarDateKey } from "@/lib/timezone";

import { AI_SETTER_QUEUE_PATH, TURN_BUDGET_MS, getAiSetterConfig, missingAiSetterConfig, type AiSetterConfig } from "./config";
import { createAiSetterGhlPort } from "./ghl";
import { createLlmPort } from "./llm";
import { createAiSetterLogger } from "./log";
import { createAiSetterNotifier } from "./notify";
import { runSend, runVerifySend } from "./send";
import { aiSetterCalls } from "./calls";
import { aiSetterLicense } from "./license";
import { aiSetterSettings } from "./settings";
import {
  aiSetterStore,
  expireDrafts,
  findApprovedToSend,
  countContactEventsSince,
  findReconcilableTurns,
  findStuckSending,
  incrementDailySends,
  purgeOldMessageText,
} from "./store";
import { runTurn } from "./turn";
import type { AiSetterLogger, AiSetterPorts, QueuePort, TurnReason } from "./types";

const AGENT_TZ = "America/New_York";
/** QStash free plan caps delays at 7 days; stay under it and re-arm when the time comes. */
const MAX_DELAY_SECONDS = 6 * 86_400;
const PURGE_AFTER_MS = 90 * 86_400_000;
const WEBHOOK_HOURLY_LIMIT = 30;
/** A message still `sending` after this long lost its worker. */
const STUCK_SENDING_MS = 10 * 60_000;

export function aiSetterLog(): AiSetterLogger {
  return createAiSetterLogger(getAiSetterConfig().debug);
}

export function qstashReady(): { publish: boolean; receive: boolean } {
  return { publish: isQStashPublishConfigured(), receive: isQStashReceiveConfigured() };
}

export function missingConfig(config: AiSetterConfig = getAiSetterConfig()): string[] {
  return missingAiSetterConfig(config, qstashReady());
}

type QueueJob =
  | { kind: "turn"; contactId: string; runId: string; retry?: number; reason?: TurnReason }
  | { kind: "send"; messageId: string }
  | { kind: "verify_send"; messageId: string }
  | { kind: "call_now_timeout"; contactId: string; requestedAt: string };

function clampDelay(seconds: number): number {
  return Math.max(0, Math.min(MAX_DELAY_SECONDS, Math.round(seconds)));
}

export function createQueuePort(requestOrigin?: string): QueuePort {
  const publish = async (body: QueueJob, delaySeconds: number) => {
    const id = await publishJob({
      path: AI_SETTER_QUEUE_PATH,
      body: body as unknown as Record<string, unknown>,
      delaySeconds: clampDelay(delaySeconds),
      retries: 3,
      requestOrigin,
    });
    return Boolean(id);
  };
  return {
    publishTurn: (contactId, runId, delaySeconds, opts) =>
      publish({ kind: "turn", contactId, runId, retry: opts?.retry ?? 0, reason: opts?.reason ?? "inbound" }, delaySeconds),
    publishSend: (messageId, notBefore) =>
      publish({ kind: "send", messageId }, notBefore ? (notBefore.getTime() - Date.now()) / 1000 : 0),
    publishVerifySend: (messageId, delaySeconds) => publish({ kind: "verify_send", messageId }, delaySeconds),
    publishCallNowTimeout: (contactId, requestedAtIso, delaySeconds) =>
      publish({ kind: "call_now_timeout", contactId, requestedAt: requestedAtIso }, delaySeconds),
  };
}

/**
 * Real ports, or null with the names of what's missing. `requireQueue: false` is for the CLI,
 * which replaces the queue with a recorder (so local runs don't need QStash env).
 */
export function buildPorts(
  opts: { requestOrigin?: string; budgetMs?: number; requireQueue?: boolean } = {}
): { ports: AiSetterPorts | null; missing: string[] } {
  const config = getAiSetterConfig();
  const missing = missingConfig(config).filter((m) => opts.requireQueue !== false || !m.startsWith("QSTASH_"));
  if (missing.length > 0) return { ports: null, missing };
  const log = createAiSetterLogger(config.debug);
  const ghl = createAiSetterGhlPort({ token: config.ghlToken!, locationId: config.locationId! });
  return {
    missing,
    ports: {
      ghl,
      llm: createLlmPort({ apiKey: config.anthropicApiKey!, model: config.model, effort: config.effort, maxTokens: config.maxTokens, log }),
      store: aiSetterStore,
      settings: aiSetterSettings,
      // Shadow mode never touches the CRM: no alert-tag fallback (it fires a GHL workflow).
      notify: createAiSetterNotifier({ log, ghl, allowTagFallback: !config.dryRun }),
      calls: aiSetterCalls,
      license: aiSetterLicense,
      queue: createQueuePort(opts.requestOrigin),
      now: () => new Date(),
      deadlineAt: Date.now() + (opts.budgetMs ?? TURN_BUDGET_MS),
      log,
      config,
    },
  };
}

/**
 * A GHL workflow poked us about a contact ("inbound" or "user_replied"). Trust nothing but the
 * id: arm one turn per contact (a burst while a turn is armed is a no-op) and let QStash run it
 * after the debounce. The turn re-reads everything from GHL.
 */
export async function handleWebhookPoke(
  contactId: string,
  event: "inbound" | "user_replied",
  requestOrigin: string
): Promise<{ queued: boolean; reason: string }> {
  const config = getAiSetterConfig();
  const log = createAiSetterLogger(config.debug);
  const missing = missingConfig(config);
  if (missing.length > 0) {
    log.error("Not configured; poke ignored", { contactId, missing });
    return { queued: false, reason: "not_configured" };
  }
  const now = new Date();
  // Flood guard: more than 30 pokes for one contact in an hour are dropped (and logged).
  const lastHour = await countContactEventsSince(contactId, "webhook", new Date(now.getTime() - 3_600_000));
  if (lastHour >= WEBHOOK_HOURLY_LIMIT) {
    log.warn("Webhook flood for one contact; poke dropped", { contactId });
    return { queued: false, reason: "rate_limited" };
  }
  await aiSetterStore.recordEvent(contactId, "webhook", { event });
  const { armed, runId } = await aiSetterStore.armTurn(contactId, now);
  if (!armed || !runId) return { queued: false, reason: "in_flight" };
  const queue = createQueuePort(requestOrigin);
  const delay = event === "user_replied" ? 5 : config.debounceSeconds;
  const ok = await queue.publishTurn(contactId, runId, delay, { reason: "inbound" });
  if (!ok) log.error("Could not publish the turn; the daily reconcile will retry", { contactId, runId });
  return { queued: ok, reason: ok ? "armed" : "publish_failed" };
}

function parseJob(body: unknown): QueueJob | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === "string" && (b[k] as string).length <= 80 ? (b[k] as string) : null);
  switch (b.kind) {
    case "turn": {
      const contactId = s("contactId");
      const runId = s("runId");
      if (!contactId || !runId) return null;
      const reason = b.reason === "call_now_timeout" || b.reason === "call_now_declined" ? b.reason : "inbound";
      const retry = typeof b.retry === "number" && b.retry >= 0 && b.retry < 10 ? b.retry : 0;
      return { kind: "turn", contactId, runId, retry, reason };
    }
    case "send":
    case "verify_send": {
      const messageId = s("messageId");
      return messageId ? { kind: b.kind, messageId } : null;
    }
    case "call_now_timeout": {
      const contactId = s("contactId");
      const requestedAt = s("requestedAt");
      return contactId && requestedAt ? { kind: "call_now_timeout", contactId, requestedAt } : null;
    }
    default:
      return null;
  }
}

/** QStash consumer. Retries are scheduled by the code itself, so this answers 200 except for bad input. */
export async function processQueueJob(body: unknown, requestOrigin: string): Promise<{ status: number; result: unknown }> {
  const job = parseJob(body);
  if (!job) return { status: 400, result: { error: "invalid job" } };
  const { ports, missing } = buildPorts({ requestOrigin });
  if (!ports) return { status: 200, result: { skipped: "not_configured", missing } };
  if (!ports.config.enabled) return { status: 200, result: { skipped: "disabled" } };

  try {
    switch (job.kind) {
      case "turn": {
        const result = await runTurn(job.contactId, job.runId, ports, { reason: job.reason ?? "inbound", retry: job.retry ?? 0 });
        if (result.rearm) {
          await ports.queue.publishTurn(job.contactId, result.rearm.runId, result.rearm.delaySeconds, {
            retry: result.rearm.retry,
            reason: result.rearm.reason,
          });
        }
        ports.log.info("Turn", { contactId: job.contactId, kind: result.kind, reason: result.reason });
        return { status: 200, result };
      }
      case "send": {
        const result = await runSend(job.messageId, ports);
        if (result.kind === "sent") await incrementDailySends(localCalendarDateKey(new Date(), AGENT_TZ));
        ports.log.info("Send", { messageId: job.messageId, kind: result.kind, reason: result.reason });
        return { status: 200, result };
      }
      case "verify_send": {
        const result = await runVerifySend(job.messageId, ports);
        return { status: 200, result };
      }
      case "call_now_timeout": {
        const result = await runCallNowTimeout(job.contactId, job.requestedAt, ports);
        return { status: 200, result };
      }
    }
  } catch (err) {
    // Unexpected: let QStash retry (each step is idempotent: claims, fencing, two-phase sends).
    ports.log.error("Job threw", { kind: job.kind, error: err instanceof Error ? err.name : "unknown" });
    return { status: 500, result: { retry: true } };
  }
}

/** Isaac didn't tap a button within the timeout: run a turn that offers two times instead. */
export async function runCallNowTimeout(
  contactId: string,
  requestedAtIso: string,
  ports: AiSetterPorts
): Promise<{ kind: string }> {
  const lead = await ports.store.getLead(contactId);
  if (!lead || lead.callNowState !== "waiting" || lead.callNowRequestedAt?.toISOString() !== requestedAtIso) {
    return { kind: "noop" };
  }
  // Frozen, opted out, paused or with Isaac: no follow-up offer (and the wait is over).
  if (lead.optOutPending || (lead.status !== "active" && lead.status !== "booked")) {
    await ports.store.updateLeadUnfenced(contactId, { callNowState: null });
    return { kind: "not_managed" };
  }
  await ports.store.updateLeadUnfenced(contactId, { callNowState: "timeout" });
  // With a turn in flight the store flags a re-arm; that next turn reads callNowState itself.
  const armed = await ports.store.armTurn(contactId, ports.now());
  if (armed.armed && armed.runId) await ports.queue.publishTurn(contactId, armed.runId, 0, { reason: "call_now_timeout" });
  return { kind: armed.armed ? "offer_times" : "turn_in_flight" };
}

/** Daily safety net (from /api/cron/queue-reconcile). Only re-publishes; never runs a turn or a send inline. */
export async function reconcileAiSetter(
  requestOrigin: string
): Promise<{ expired: number; purged: number; turns: number; sends: number; stuck: number }> {
  const config = getAiSetterConfig();
  const now = new Date();
  // Retention runs even with the setter off (rows the CLI or an earlier period wrote).
  const expired = await expireDrafts(now);
  const purged = await purgeOldMessageText(new Date(now.getTime() - PURGE_AFTER_MS));
  if (!config.enabled || missingConfig(config).length > 0) return { expired, purged, turns: 0, sends: 0, stuck: 0 };

  const queue = createQueuePort(requestOrigin);
  let turns = 0;
  for (const lead of await findReconcilableTurns(20, now)) {
    const armed = await aiSetterStore.armTurn(lead.contactId, now);
    if (armed.armed && armed.runId && (await queue.publishTurn(lead.contactId, armed.runId, 0))) turns++;
  }
  let sends = 0;
  for (const msg of await findApprovedToSend(25, now)) {
    if (await queue.publishSend(msg.id, msg.notBefore)) sends++;
  }
  // A worker that died around the POST left `sending`: check the thread, never resend blindly.
  let stuck = 0;
  for (const msg of await findStuckSending(new Date(now.getTime() - STUCK_SENDING_MS), 25)) {
    const moved = await aiSetterStore.transitionMessage(msg.id, ["sending"], "send_unknown", { error: "stuck_sending" });
    if (moved && (await queue.publishVerifySend(msg.id, 0))) stuck++;
  }
  return { expired, purged, turns, sends, stuck };
}
