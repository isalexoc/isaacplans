/**
 * DB-backed runner: claim the run, search (or reuse a saved result), write the field, finish.
 * Called by the QStash consumer, by the webhook's inline fallback, and by the daily reconcile.
 */

import { publishJob } from "@/lib/qstash/client";
import { isQStashPublishConfigured, isQStashReceiveConfigured } from "@/lib/qstash/config";
import { getAgentLocalTimezone, localCalendarDateKey } from "@/lib/timezone";

import {
  PHONE_FINDER_MAX_ATTEMPTS,
  PHONE_FINDER_QUEUE_PATH,
  getPhoneFinderConfig,
  missingPhoneFinderConfig,
} from "./config";
import { createEnformionClient } from "./enformion";
import { formatResultsText } from "./format";
import { createGhlPort } from "./ghl";
import { getPhoneFinderFieldId } from "./ghl-field-ids";
import { createPhoneFinderLogger, type PhoneFinderLogger } from "./log";
import { runPhoneFinderSearch } from "./pipeline";
import {
  addPhoneFinderDailyCost,
  claimPhoneFinderRun,
  findReconcilablePhoneFinderRuns,
  finishPhoneFinderRun,
  markPhoneFinderDailySlot,
  releasePhoneFinderRun,
  reservePhoneFinderDailySlot,
  savePhoneFinderResult,
} from "./store";
import { createTrestleClient } from "./trestle";

/** Stay well inside the routes' maxDuration (300 s). */
const RUN_BUDGET_MS = 240_000;

export type PhoneFinderProcessResult = {
  kind: "completed" | "skipped" | "failed" | "retry" | "disabled" | "not_configured" | "not_claimable";
  outcome?: string;
  reason?: string;
};

export async function processPhoneFinderRun(
  contactId: string,
  runId: string,
  log: PhoneFinderLogger = createPhoneFinderLogger(getPhoneFinderConfig().debug)
): Promise<PhoneFinderProcessResult> {
  const config = getPhoneFinderConfig();
  // Checked before the claim, so the row stays pending for when it is switched on / configured.
  if (!config.enabled) return { kind: "disabled" };
  const resultsFieldId = getPhoneFinderFieldId("results");
  const missing = missingPhoneFinderConfig(config, resultsFieldId);
  if (missing.length > 0) {
    log.error("Not configured; run left pending", { contactId, missing });
    return { kind: "not_configured", reason: missing.join(", ") };
  }

  const row = await claimPhoneFinderRun(contactId, runId);
  if (!row) return { kind: "not_claimable" };
  const attempt = row.attemptCount;
  const tz = getAgentLocalTimezone();
  const ghl = createGhlPort({ token: config.piToken! });
  let costMills = row.costMills;
  let slotDay = row.dailySlotDay;

  const finish = async (data: Parameters<typeof finishPhoneFinderRun>[3]) => {
    await finishPhoneFinderRun(contactId, runId, attempt, data);
    if (slotDay && data.costMills > 0) await addPhoneFinderDailyCost(slotDay, data.costMills);
  };

  if (attempt > PHONE_FINDER_MAX_ATTEMPTS) {
    const text = formatResultsText(
      {
        outcome: "failed",
        detail: "a temporary problem kept happening",
        numbers: [],
        primaryVerdict: "none",
        primaryLitigator: false,
        identityScore: null,
        minIdentityScore: config.minIdentityScore,
        uncheckedCount: 0,
      },
      new Date(),
      tz
    );
    // A saved search result still gets one last chance to land; otherwise say it failed.
    const written = await ghl.writeTextField(contactId, resultsFieldId, row.resultText ?? text);
    if (written.ok && row.resultText !== null && row.outcome && row.outcome !== "failed") {
      if (row.resultTags?.length) await ghl.addTags(contactId, row.resultTags);
      await finish({ status: "completed", outcome: row.outcome, costMills });
      return { kind: "completed", outcome: row.outcome };
    }
    await finish({ status: "failed", outcome: "failed", costMills, errorMessage: `max_attempts: ${row.errorMessage ?? ""}` });
    log.warn("Gave up after max attempts", { contactId, runId, lastError: row.errorMessage });
    return { kind: "failed", reason: "max_attempts" };
  }

  let text = row.resultText;
  let tags = row.resultTags ?? [];
  let outcome = row.outcome ?? "found";

  // No saved result yet: run the search (the paid part).
  if (text === null) {
    const now = () => new Date();
    const result = await runPhoneFinderSearch({
      contactId,
      runId,
      config,
      ghl,
      trestle: createTrestleClient({ apiKey: config.trestleApiKey! }),
      enformion: createEnformionClient({ apName: config.enformionApName!, apPassword: config.enformionApPassword! }),
      reserveDailySlot: async () => {
        if (slotDay) return true; // reserved by an earlier attempt of this run
        const day = localCalendarDateKey(new Date(), tz);
        if (!(await reservePhoneFinderDailySlot(day, config.dailyLimit))) return false;
        slotDay = day;
        await markPhoneFinderDailySlot(contactId, runId, attempt, day);
        return true;
      },
      previous: { inputHash: row.lastInputHash, searchedAt: row.lastSearchedAt },
      now,
      deadlineAt: Date.now() + RUN_BUDGET_MS,
      timeZone: tz,
      log,
    });
    costMills += result.costMills;

    if (result.kind === "retry") {
      await releasePhoneFinderRun(contactId, runId, attempt, { errorMessage: result.reason, costMills });
      log.warn("Transient failure; will retry", { contactId, runId, attempt, reason: result.reason });
      return { kind: "retry", reason: result.reason };
    }
    if (result.kind === "skip") {
      await finish({ status: "skipped", outcome: result.reason, costMills, summary: result.summary });
      log.info("Skipped", { contactId, runId, reason: result.reason });
      return { kind: "skipped", outcome: result.reason };
    }

    const saved = await savePhoneFinderResult(contactId, runId, attempt, {
      resultText: result.text,
      resultTags: result.tags,
      outcome: result.outcome,
      summary: result.summary,
      costMills,
      ...(result.searched ? { lastInputHash: result.inputHash, lastSearchedAt: new Date() } : {}),
    });
    if (!saved) {
      log.warn("Lost the claim before saving; another worker owns this run", { contactId, runId, attempt });
      return { kind: "not_claimable", reason: "lost_claim" };
    }
    text = result.text;
    tags = result.tags;
    outcome = result.outcome;
  }

  // The CRM write (free to retry: the result is saved on the row).
  const written = await ghl.writeTextField(contactId, resultsFieldId, text);
  if (!written.ok) {
    if (written.retryable) {
      await releasePhoneFinderRun(contactId, runId, attempt, { errorMessage: `ghl_write_${written.status}`, costMills });
      log.warn("CRM write failed; will retry", { contactId, runId, status: written.status });
      return { kind: "retry", reason: `ghl_write_${written.status}` };
    }
    await finish({ status: "failed", outcome, costMills, errorMessage: `ghl_write_rejected_${written.status}` });
    log.error("CRM rejected the field write", { contactId, runId, status: written.status });
    return { kind: "failed", reason: `ghl_write_rejected_${written.status}` };
  }
  if (tags.length > 0 && !(await ghl.addTags(contactId, tags))) {
    log.warn("Adding tags failed (non-fatal)", { contactId, tags });
  }

  const status = outcome === "failed" ? "failed" : "completed";
  await finish({ status, outcome, costMills });
  log.info("Done", { contactId, runId, outcome, costMills, attempt });
  return { kind: status, outcome };
}

/**
 * Hand a run to QStash; run it right here when QStash can't deliver. Publishing without the
 * signing keys would make every delivery fail verification, so that counts as "can't deliver".
 */
export async function queuePhoneFinderRun(
  contactId: string,
  runId: string,
  requestOrigin: string,
  log: PhoneFinderLogger = createPhoneFinderLogger(getPhoneFinderConfig().debug)
): Promise<"queued" | "inline"> {
  if (isQStashPublishConfigured() && isQStashReceiveConfigured()) {
    const messageId = await publishJob({
      path: PHONE_FINDER_QUEUE_PATH,
      body: { contactId, runId },
      requestOrigin,
      retries: 3,
    });
    if (messageId) return "queued";
  }
  await processPhoneFinderRun(contactId, runId, log);
  return "inline";
}

/** Daily safety net: finish runs QStash never delivered or gave up on. */
export async function reconcilePhoneFinderRuns(
  requestOrigin: string,
  log: PhoneFinderLogger = createPhoneFinderLogger(getPhoneFinderConfig().debug)
): Promise<{ found: number; processed: number; republished: number }> {
  if (!getPhoneFinderConfig().enabled) return { found: 0, processed: 0, republished: 0 };
  const rows = await findReconcilablePhoneFinderRuns(20);
  const canQueue = isQStashPublishConfigured() && isQStashReceiveConfigured();
  let processed = 0;
  let republished = 0;
  let inline = 0;

  for (const row of rows) {
    if (canQueue) {
      const messageId = await publishJob({
        path: PHONE_FINDER_QUEUE_PATH,
        body: { contactId: row.contactId, runId: row.runId },
        requestOrigin,
        retries: 3,
      });
      if (messageId) {
        republished++;
        continue;
      }
    }
    // Inline runs take up to a few minutes each; keep the shared cron bounded.
    if (inline >= 2) continue;
    inline++;
    const result = await processPhoneFinderRun(row.contactId, row.runId, log);
    if (result.kind === "completed" || result.kind === "skipped" || result.kind === "failed") processed++;
  }

  if (rows.length > 0) log.info("Reconcile", { found: rows.length, processed, republished });
  return { found: rows.length, processed, republished };
}
