/**
 * Processes one stored Telegram lead: claim → parse → validate → CRM → mark.
 *
 * Mirrors `lib/leads-the-way/process.ts`, with the key behavioural difference that nothing here is
 * ever terminal-by-accident. The email pipeline marks an unparseable lead `skipped`, which is
 * permanently unclaimable, never reconciled, and invisible to the whole app — a purchased lead
 * quietly evaporates. Here that case becomes `needs_review`, which is listed, alerted and fixable.
 */

import { publishJob } from "@/lib/qstash/client";
import {
  getTelegramLeadsConfig,
  isTelegramLeadsConfigured,
  type TelegramLeadsConfig,
} from "@/lib/telegram/config";
import { pushLeadToCrm } from "@/lib/telegram/crm";
import { extractTelegramLeadWithOpenAI, mergeParsedLeads } from "@/lib/telegram/extract-openai";
import { createTelegramLogger, type TelegramLogger } from "@/lib/telegram/log";
import { notifyTelegramLeadEvent } from "@/lib/telegram/notify";
import { parseEmpiregrowthLead, type ParsedTelegramLead } from "@/lib/telegram/parse";
import {
  claimTelegramLead,
  findClaimableTelegramLeads,
  markTelegramLead,
  telegramRetryBackoffMs,
  MAX_TELEGRAM_ATTEMPTS,
} from "@/lib/telegram/store";
import { validateParsedLead } from "@/lib/telegram/validate";

export const TELEGRAM_LEADS_QUEUE_PATH = "/api/queue/telegram-lead";

export type TelegramProcessResult = {
  /** Did we attempt real work on a claimed job? */
  processed: boolean;
  ok: boolean;
  reason?: string;
  contactId?: string;
};

/** Reasons a retry can never fix — the queue route returns 2xx so QStash stops. */
export const TELEGRAM_PERMANENT_REASONS = new Set([
  "not_claimable",
  "no_raw_text",
  "needs_review",
  "not_configured_terminal",
  "max_attempts",
]);

function snapshot(parsed: ParsedTelegramLead): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/**
 * Parse with the deterministic parser, falling back to OpenAI only when it finds no usable phone or
 * no name. The model's output goes through the same validation gate, so it can never talk a bad
 * number into the CRM.
 */
export async function parseAndValidate(
  rawText: string,
  config: TelegramLeadsConfig,
  log: TelegramLogger
): Promise<{
  parsed: ParsedTelegramLead;
  validation: ReturnType<typeof validateParsedLead>;
  aiRaw?: string;
  unmatchedLines: string[];
}> {
  const { parsed, diagnostics } = parseEmpiregrowthLead(rawText);
  let merged = parsed;
  let aiRaw: string | undefined;

  const needsAi = !parsed.phoneE164 || (!parsed.firstName && !parsed.lastName);
  if (needsAi && config.aiFallback && config.openaiApiKey) {
    log.info("Deterministic parse incomplete; trying OpenAI fallback");
    const ai = await extractTelegramLeadWithOpenAI(rawText, config);
    if (ai) {
      merged = mergeParsedLeads(parsed, ai.parsed);
      aiRaw = ai.raw;
      if (ai.dropped.length > 0) diagnostics.warnings.push(`ai_dropped:${ai.dropped.join("|")}`);
    }
  }

  const validation = validateParsedLead(merged, diagnostics);
  return { parsed: merged, validation, aiRaw, unmatchedLines: diagnostics.unmatchedLines };
}

export async function processTelegramLeadJobById(
  leadKey: string,
  log: TelegramLogger = createTelegramLogger()
): Promise<TelegramProcessResult> {
  const config = getTelegramLeadsConfig();

  const claimed = await claimTelegramLead(leadKey, log);
  if (!claimed) return { processed: false, ok: true, reason: "not_claimable" };

  // Not configured yet: hand the row back as `pending` rather than burning an attempt, so the
  // daily reconcile picks it up once the env is filled in.
  if (!isTelegramLeadsConfigured(config)) {
    log.warn("Pipeline not fully configured; deferring", { leadKey });
    await markTelegramLead(
      { leadKey, status: "pending", errorMessage: "not_configured" },
      log
    );
    return { processed: false, ok: false, reason: "not_configured" };
  }

  const rawText = claimed.jobState?.rawText ?? "";
  if (!rawText.trim()) {
    await markTelegramLead(
      {
        leadKey,
        status: "needs_review",
        needsReview: true,
        reviewReason: "no_text",
        errorMessage: "no_raw_text",
      },
      log
    );
    await notifyTelegramLeadEvent(
      { kind: "needs_review", leadKey, reason: "no_text" },
      config,
      log
    );
    return { processed: true, ok: false, reason: "no_raw_text" };
  }

  const attempt = (claimed.attemptCount ?? 0) + 1;

  try {
    const { parsed, validation, aiRaw, unmatchedLines } = await parseAndValidate(
      rawText,
      config,
      log
    );

    const jobState = {
      ...(claimed.jobState ?? {}),
      step: "parse" as const,
      parsed: snapshot(parsed),
      diagnostics: { unmatchedLines, warnings: validation.warnings },
      ...(aiRaw ? { aiRaw } : {}),
    };

    // No usable phone → never write to the CRM. Surface it instead.
    if (!validation.ok) {
      await markTelegramLead(
        {
          leadKey,
          status: "needs_review",
          needsReview: true,
          reviewReason: validation.reviewReason ?? "no_phone",
          errorMessage: validation.errors.join(","),
          parseSource: parsed.parseSource ?? null,
          firstName: parsed.firstName ?? null,
          lastName: parsed.lastName ?? null,
          email: parsed.email ?? null,
          stateCode: parsed.stateCode ?? null,
          jobState,
          attemptCount: attempt,
        },
        log
      );
      await notifyTelegramLeadEvent(
        {
          kind: "needs_review",
          leadKey,
          reason: validation.reviewReason,
          preview: rawText.slice(0, 300),
        },
        config,
        log
      );
      return { processed: true, ok: false, reason: "needs_review" };
    }

    const result = await pushLeadToCrm(
      parsed,
      {
        chatId: claimed.chatId,
        messageId: claimed.messageId,
        receivedAt: claimed.createdAt ?? undefined,
        rawText,
      },
      config,
      log
    );

    if (!result.ok) {
      const exhausted = attempt >= MAX_TELEGRAM_ATTEMPTS;
      await markTelegramLead(
        {
          leadKey,
          status: exhausted ? "needs_review" : "failed",
          needsReview: exhausted,
          reviewReason: exhausted ? "crm_failed" : null,
          errorMessage: result.reason ?? "crm_failed",
          parseSource: parsed.parseSource ?? null,
          jobState: { ...jobState, lastError: result.reason },
          attemptCount: attempt,
          nextRetryAt: exhausted ? null : new Date(Date.now() + telegramRetryBackoffMs(attempt)),
        },
        log
      );
      if (exhausted) {
        await notifyTelegramLeadEvent(
          { kind: "crm_failed", leadKey, error: result.reason ?? "unknown" },
          config,
          log
        );
        return { processed: true, ok: false, reason: "max_attempts" };
      }
      return { processed: true, ok: false, reason: result.reason ?? "crm_failed" };
    }

    // Synced. It can still be imperfect — that is what `needsReview` is for.
    await markTelegramLead(
      {
        leadKey,
        status: "completed",
        needsReview: validation.needsReview,
        reviewReason: validation.needsReview ? validation.reviewReason : null,
        contactId: result.contactId ?? null,
        locationId: config.locationId,
        matchedBy: result.matchedBy ?? null,
        phone: parsed.phoneE164 ?? null,
        email: parsed.email ?? null,
        firstName: parsed.firstName ?? null,
        lastName: parsed.lastName ?? null,
        stateCode: parsed.stateCode ?? null,
        parseSource: parsed.parseSource ?? null,
        tagsAdded: result.tagsAdded,
        cadenceStarted: result.cadenceStarted,
        errorMessage: null,
        jobState: { ...jobState, step: "tag", ...(result.dryRun ? { dryRun: true } : {}) },
        attemptCount: attempt,
      },
      log
    );

    if (validation.needsReview) {
      await notifyTelegramLeadEvent(
        { kind: "needs_review", leadKey, reason: validation.reviewReason, preview: rawText.slice(0, 300) },
        config,
        log
      );
    }

    return { processed: true, ok: true, contactId: result.contactId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Lead processing threw", { leadKey, error: message });
    const exhausted = attempt >= MAX_TELEGRAM_ATTEMPTS;
    await markTelegramLead(
      {
        leadKey,
        status: exhausted ? "needs_review" : "failed",
        needsReview: exhausted,
        reviewReason: exhausted ? "crm_failed" : null,
        errorMessage: message.slice(0, 500),
        jobState: { ...(claimed.jobState ?? {}), lastError: message.slice(0, 500) },
        attemptCount: attempt,
        nextRetryAt: exhausted ? null : new Date(Date.now() + telegramRetryBackoffMs(attempt)),
      },
      log
    );
    return { processed: true, ok: false, reason: exhausted ? "max_attempts" : "exception" };
  }
}

/** Daily safety net: drain anything QStash never delivered. */
export async function reconcileTelegramLeadJobs(
  requestOrigin: string,
  log: TelegramLogger = createTelegramLogger()
): Promise<{ found: number; processed: number; republished: number }> {
  const rows = await findClaimableTelegramLeads(25, log);
  let processed = 0;
  let republished = 0;

  for (const row of rows) {
    const published = await publishJob({
      path: TELEGRAM_LEADS_QUEUE_PATH,
      body: { leadKey: row.leadKey },
      requestOrigin,
      retries: 3,
    });
    if (published) {
      republished++;
      continue;
    }
    const result = await processTelegramLeadJobById(row.leadKey, log);
    if (result.ok) processed++;
  }

  if (rows.length > 0) {
    log.info("Telegram reconcile", { found: rows.length, processed, republished });
  }
  return { found: rows.length, processed, republished };
}
