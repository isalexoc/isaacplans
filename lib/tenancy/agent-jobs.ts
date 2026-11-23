/**
 * The agent platform's background jobs, queued on QStash (the house rule: never a polling cron):
 *  - alerts to an agent, by email, with no client details (app/api/queue/agent-notify): the first
 *    client save once the application has an email or phone, completion, a secure-link submit;
 *  - the purge of an agent's application's sensitive values 30 days after completion
 *    (app/api/queue/agent-purge), which hops in steps under QStash's free-plan delay cap.
 * Only ever for an agent's applications: the callers check the owner, and the job routes check
 * again. With QStash off they are skipped (no inline fallback, like the AI Setter's), logged once.
 *
 * The purge has a backstop: the existing daily reconcile (app/api/cron/queue-reconcile, the one
 * cron the house rule allows) erases, inline, whatever an agent's application still holds 30+ days
 * after completion (`reconcileAgentPurges`): a job never queued (QStash off on the deployment that
 * completed it, a failed publish), a chain that died after its retries, an application completed
 * before the job existed, or a number typed again after a purge. Retention, like the AI Setter's
 * purge in the same run; no alert is ever sent from there.
 *
 * The product domain answers no queue route (next.config.mjs), so its jobs are delivered to Isaac's
 * site: on the product project set `QSTASH_TARGET_BASE_URL` to Isaac's site URL (or leave it unset,
 * and they go to `NEXT_PUBLIC_SITE_URL`, else https://www.isaacplans.com). A target on the product
 * domain is refused (the job would answer 404 forever).
 *
 * Server-only. Never throws into a save or a completion.
 */

import "server-only";
import { getIntakeConfig } from "@/lib/intake-configs";
import { planSensitivePurge } from "@/lib/intake-core/purge";
import {
  claimSessionDataFlag,
  listAgentSessionsHoldingSensitive,
  patchIntakeData,
  releaseSessionDataFlag,
  type IntakeSessionRow,
} from "@/lib/intake-core/server";
import type { IntakeData, IntakeLobConfig } from "@/lib/intake-core/types";
import { publishJob } from "@/lib/qstash/client";
import { isQStashPublishConfigured, resolveTargetBaseUrl } from "@/lib/qstash/config";
import {
  AGENT_ALERTS_KEY,
  AGENT_PURGE_AFTER_DAYS,
  agentPurgeDueAt,
  alertEventKey,
  alertStartedDue,
  purgeHopDelaySeconds,
  SENSITIVE_PURGED_KEY,
  type AgentAlertJob,
  type AgentPurgeJob,
  type CallerRole,
} from "./agent-data";
import { logSensitiveAccess } from "./audit";
import { AGENT_LOBS } from "./gates";
import { mainSiteUrl, productPublicOrigin } from "./site-urls";
import { isProductSurface } from "./surface";

export const AGENT_NOTIFY_PATH = "/api/queue/agent-notify";
export const AGENT_PURGE_PATH = "/api/queue/agent-purge";

let warnedOff = false;
let warnedTarget = false;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function siteKey(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Where this deployment's agent jobs are delivered, or null when it can't queue them. */
function jobTarget(): { requestOrigin: string } | null {
  if (!isQStashPublishConfigured()) {
    if (!warnedOff) {
      warnedOff = true;
      console.warn("[agent-jobs] QStash is off: agents' alerts are skipped and no 30-day purge is scheduled.");
    }
    return null;
  }
  const requestOrigin = mainSiteUrl();
  if (isProductSurface()) {
    const target = resolveTargetBaseUrl(requestOrigin);
    const product = productPublicOrigin();
    if (target && product && siteKey(target) === siteKey(product)) {
      if (!warnedTarget) {
        warnedTarget = true;
        console.error(
          "[agent-jobs] QSTASH_TARGET_BASE_URL points at the product domain, which answers no queue route: " +
            "set it to Isaac's site URL on the product project. Agent jobs are skipped until then."
        );
      }
      return null;
    }
  }
  return { requestOrigin };
}

/** Queue one alert to the agent. False when it wasn't queued. */
export async function publishAgentAlert(job: AgentAlertJob): Promise<boolean> {
  const target = jobTarget();
  if (!target) return false;
  const id = await publishJob({ path: AGENT_NOTIFY_PATH, body: job, retries: 3, requestOrigin: target.requestOrigin });
  return Boolean(id);
}

/**
 * After a save on an agent's application: the first one by the client once the application holds
 * an email or phone tells the agent, once (`agentAlerts.started`, claimed in one statement; given
 * back if the alert couldn't be queued, so a later save tries again).
 */
export async function alertAgentOnFirstClientSave(
  session: { id: string; lob: string },
  role: CallerRole,
  decrypted: IntakeData
): Promise<void> {
  try {
    if (!alertStartedDue({ role, data: decrypted })) return;
    if (!jobTarget()) return;
    const claimed = await claimSessionDataFlag(session.id, AGENT_ALERTS_KEY, "started", new Date().toISOString());
    if (!claimed) return;
    const queued = await publishAgentAlert({
      kind: "started",
      lob: session.lob,
      sessionId: session.id,
      event: alertEventKey("started"),
    });
    if (!queued) await releaseSessionDataFlag(session.id, AGENT_ALERTS_KEY, "started");
  } catch (error) {
    console.warn("[agent-jobs] the started alert failed:", message(error));
  }
}

/** Queue (or, from the purge job, re-queue) the 30-day purge. False when it wasn't queued. */
export async function scheduleAgentPurge(job: AgentPurgeJob, nowSeconds = Date.now() / 1000): Promise<boolean> {
  const target = jobTarget();
  if (!target) return false;
  const id = await publishJob({
    path: AGENT_PURGE_PATH,
    body: job,
    delaySeconds: purgeHopDelaySeconds(job.dueAt, nowSeconds) ?? 0,
    retries: 3,
    requestOrigin: target.requestOrigin,
  });
  return Boolean(id);
}

/**
 * After an agent's application is completed: the alert when the client completed it (the agent
 * finishing it themself is not news), and in every case the purge 30 days later.
 */
export async function afterAgentCompletion(
  session: { id: string; lob: string; completedAt: Date | null },
  by: CallerRole
): Promise<void> {
  const completedAt = session.completedAt ?? new Date();
  if (by === "client") {
    try {
      await publishAgentAlert({
        kind: "completed",
        lob: session.lob,
        sessionId: session.id,
        event: alertEventKey("completed", completedAt.getTime()),
      });
    } catch (error) {
      console.warn("[agent-jobs] the completed alert failed:", message(error));
    }
  }
  try {
    const scheduled = await scheduleAgentPurge({ lob: session.lob, sessionId: session.id, dueAt: agentPurgeDueAt(completedAt) });
    if (!scheduled) {
      console.error(
        `[agent-jobs] the 30-day purge of session ${session.id} was not scheduled; the agent's "Entered in Impact" ` +
          "still erases it, and the daily reconcile does once it is due."
      );
    }
  } catch (error) {
    console.error("[agent-jobs] scheduling the 30-day purge failed:", message(error));
  }
}

/**
 * Erase what an agent's application still holds of its sensitive values (lib/intake-core/purge.ts),
 * in ONE statement with the `sensitivePurgedAt` stamp, then a "purge" row by the system (field names
 * only). The caller has established that the owner is an agent and the purge is due.
 * "nothing_left": nothing to erase (already purged; nothing written). "moved": the link was reset
 * between the read and the write (nothing written; read it afresh and try again).
 */
export async function eraseAgentApplicationSensitive(
  config: IntakeLobConfig,
  session: IntakeSessionRow
): Promise<"purged" | "nothing_left" | "moved"> {
  const { patch, fields } = planSensitivePurge(config.sections, (session.data ?? {}) as IntakeData);
  if (Object.keys(patch).length === 0) return "nothing_left";
  const updated = await patchIntakeData(session.token, { ...patch, [SENSITIVE_PURGED_KEY]: new Date().toISOString() });
  if (!updated) return "moved";
  await logSensitiveAccess({
    action: "purge",
    actorUserId: null,
    actorRole: "system",
    ownerUserId: session.ownerUserId,
    sessionId: session.id,
    fields,
  });
  return "purged";
}

/** Applications one daily run erases per line (bounded; the next day's run takes the rest). */
const PURGE_SWEEP_LIMIT = 50;

/**
 * The 30-day purge's backstop, from the daily reconcile: every agent's application completed more
 * than 30 days ago that still holds a sensitive value is erased now, inline (one statement and one
 * "purge" row each), whatever happened to its QStash job. Never Isaac's applications (the query
 * requires an `agents` owner that isn't listed as his); nothing before migration 0046. A reopened
 * application counts from its latest completion, like the job.
 */
export async function reconcileAgentPurges(now = new Date()): Promise<{ found: number; purged: number }> {
  const completedBefore = new Date(now.getTime() - AGENT_PURGE_AFTER_DAYS * 86_400_000);
  let found = 0;
  let purged = 0;
  for (const lob of AGENT_LOBS) {
    const config = getIntakeConfig(lob);
    if (!config) continue;
    const due = await listAgentSessionsHoldingSensitive(config, completedBefore, PURGE_SWEEP_LIMIT);
    found += due.length;
    for (const session of due) {
      try {
        if ((await eraseAgentApplicationSensitive(config, session)) === "purged") purged++;
      } catch (error) {
        console.error(`[agent-jobs] the daily purge of session ${session.id} failed:`, message(error));
      }
    }
  }
  return { found, purged };
}
