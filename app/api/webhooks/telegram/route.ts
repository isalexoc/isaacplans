import { NextResponse, after, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

import { publishJob } from "@/lib/qstash/client";
import { sendTelegramMessage } from "@/lib/telegram/api";
import {
  getTelegramLeadsConfig,
  isAllowlistedChat,
} from "@/lib/telegram/config";
import { createTelegramLogger } from "@/lib/telegram/log";
import { notifyTelegramLeadEvent, rememberAdminChatId } from "@/lib/telegram/notify";
import {
  TELEGRAM_LEADS_QUEUE_PATH,
  processTelegramLeadJobById,
} from "@/lib/telegram/process";
import { contentHashOf, deriveTelegramLeadKey } from "@/lib/telegram/parse";
import { setBusinessConnection } from "@/lib/telegram/settings";
import { enqueueTelegramLead, getTelegramLead } from "@/lib/telegram/store";
import { normalizeUpdate } from "@/lib/telegram/update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Persist + ACK only; the QStash consumer does the CRM work. */
export const maxDuration = 60;

/**
 * Inbound Telegram webhook for the Empiregrowth IUL lead feed.
 *
 * The provider forwards each lead from their channel as a private DM to Isaac's personal account.
 * A plain bot cannot read those, so a CONNECTED BUSINESS BOT (Telegram Business → Chatbots) is
 * attached to his account and scoped to that one chat; the DMs arrive here as `business_message`.
 *
 * Two rules shape this handler, both learned from the email pipeline's failure modes:
 *
 *  1. PERSIST BEFORE GATING. The only check ahead of the database write is the secret. Telegram has
 *     no history API and discards undelivered updates after 24h, so returning 200 without storing —
 *     which `app/api/webhooks/leads-the-way/route.ts` does whenever its flag is off or the sender
 *     fails the allowlist — loses a purchased lead permanently.
 *  2. NEVER STORE CONTENT FROM A CHAT WE WEREN'T POINTED AT. This bot can see personal DMs. A chat
 *     that is not on the allowlist gets its ids recorded and its content deliberately discarded.
 */

function verifySecret(req: NextRequest, secret: string): boolean {
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const config = getTelegramLeadsConfig();
  const log = createTelegramLogger(config.debug);

  // Never accept an unsigned webhook — without this the open internet can fill the table.
  if (!config.webhookSecret) {
    log.error("TELEGRAM_WEBHOOK_SECRET is not set; refusing inbound updates");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (!verifySecret(req, config.webhookSecret)) {
    log.warn("Inbound update rejected: bad secret token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    // A 4xx/5xx here would make Telegram retry an unparseable update for 24h; it can never
    // become valid, so acknowledge it and move on.
    log.error("Inbound update was not JSON", { preview: rawBody.slice(0, 200) });
    return NextResponse.json({ ok: true, ignored: "invalid_json" });
  }

  const update = normalizeUpdate(json);

  // ── The bot was connected / disconnected from Isaac's account ──────────────────────
  if (update.kind === "business_connection") {
    log.info("Business connection update", {
      connectionId: update.connectionId,
      isEnabled: update.isEnabled,
    });
    if (update.connectionId) {
      await setBusinessConnection({
        id: update.connectionId,
        userChatId: update.userChatId,
        isEnabled: update.isEnabled,
      });
    }
    // `user_chat_id` is Isaac's own chat — this is how alerts find him with no setup step.
    if (update.userChatId) await rememberAdminChatId(update.userChatId);
    if (!update.isEnabled) {
      await notifyTelegramLeadEvent({ kind: "connection_lost" }, config, log);
    }
    return NextResponse.json({ ok: true, kind: "business_connection" });
  }

  // ── An ordinary DM to the bot: only ever the /start bootstrap, never a lead ────────
  if (update.kind === "message") {
    if (update.chatId) {
      await rememberAdminChatId(update.chatId);
      await sendTelegramMessage(
        update.chatId,
        `Connected. This chat will receive Empiregrowth lead alerts.\n\nChat id: ${update.chatId}`,
        config
      );
    }
    return NextResponse.json({ ok: true, kind: "message" });
  }

  if (update.kind === "other") {
    return NextResponse.json({ ok: true, ignored: "unhandled_update" });
  }

  // ── business_message / edited_business_message ────────────────────────────────────
  const allowlisted = isAllowlistedChat(config, update.chatId);

  if (!allowlisted) {
    // Ids only. We deliberately do not store what an un-allowlisted chat said — this bot can
    // see personal conversations.
    log.warn("Message from a chat that is not allowlisted; content not stored", {
      chatId: update.chatId,
      chatType: update.chatType,
    });
    if (update.chatId) {
      await notifyTelegramLeadEvent({ kind: "unknown_chat", chatId: update.chatId }, config, log);
    }
    return NextResponse.json({ ok: true, ignored: "chat_not_allowed" });
  }

  if (!update.chatId || !update.messageId) {
    return NextResponse.json({ ok: true, ignored: "no_message_id" });
  }

  const leadKey = deriveTelegramLeadKey(update.chatId, update.messageId);

  // An edit to a message we already synced must not silently rewrite a contact that has entered
  // a cadence — surface it instead.
  if (update.kind === "edited_business_message") {
    const existing = await getTelegramLead(leadKey, log);
    if (existing?.status === "completed") {
      const editKey = `${leadKey}_e${update.updateId}`;
      await enqueueTelegramLead(
        {
          leadKey: editKey,
          chatId: update.chatId,
          messageId: update.messageId,
          updateId: update.updateId,
          messageAt: update.messageDate,
          status: "needs_review",
          needsReview: true,
          reviewReason: "edited_after_completion",
          jobState: {
            rawText: update.text,
            rawUpdate: config.storeRawPayload ? json : undefined,
          },
        },
        log
      );
      await notifyTelegramLeadEvent(
        { kind: "needs_review", leadKey: editKey, reason: "edited_after_completion", preview: update.text.slice(0, 300) },
        config,
        log
      );
      return NextResponse.json({ ok: true, leadKey: editKey, edited: true });
    }
  }

  const hasText = Boolean(update.text.trim());

  // ── PERSIST. Everything above this line is either the secret check or routing. ─────
  const enq = await enqueueTelegramLead(
    {
      leadKey,
      chatId: update.chatId,
      messageId: update.messageId,
      updateId: update.updateId,
      messageAt: update.messageDate,
      // A photo/sticker/voice lead can't be parsed here, but it is still a purchased lead.
      status: hasText ? "pending" : "needs_review",
      needsReview: !hasText,
      reviewReason: hasText ? null : "no_text",
      jobState: {
        step: "parse",
        rawText: update.text,
        rawUpdate: config.storeRawPayload ? json : undefined,
        ...(hasText ? {} : { lastError: "message carried no text" }),
      },
    },
    log
  );

  log.info("Inbound lead accepted", {
    leadKey,
    queued: enq.queued,
    reason: enq.reason,
    hasText,
    contentHash: hasText ? contentHashOf(update.text) : null,
  });

  if (!hasText) {
    await notifyTelegramLeadEvent(
      { kind: "needs_review", leadKey, reason: "no_text" },
      config,
      log
    );
    return NextResponse.json({ ok: true, leadKey, queued: false, needsReview: true });
  }

  // The flag gates the CRM write, not the capture. A backlog captured while disabled is drained
  // by the daily reconcile once it is switched on.
  if (enq.queued && config.enabled) {
    const origin = req.nextUrl.origin;
    after(async () => {
      const published = await publishJob({
        path: TELEGRAM_LEADS_QUEUE_PATH,
        body: { leadKey },
        requestOrigin: origin,
        retries: 3,
      });
      if (!published) await processTelegramLeadJobById(leadKey, log);
    });
  }

  return NextResponse.json({ ok: true, leadKey, queued: enq.queued });
}

/** Health / build marker — handy for confirming a deploy picked up the env. */
export async function GET() {
  const config = getTelegramLeadsConfig();
  return NextResponse.json({
    ok: true,
    route: "telegram-leads-inbound",
    enabled: config.enabled,
    dryRun: config.dryRun,
    hasWebhookSecret: Boolean(config.webhookSecret),
    hasBotToken: Boolean(config.botToken),
    allowlistCount: config.allowedChatIds.length,
    aiFallback: config.aiFallback,
    tags: config.baseTags,
  });
}
