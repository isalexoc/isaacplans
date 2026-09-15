import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";

import { getTelegramLeadsConfig } from "@/lib/telegram/config";
import { pushLeadToCrm } from "@/lib/telegram/crm";
import { createTelegramLogger } from "@/lib/telegram/log";
import { parseEmpiregrowthLead, type ParsedTelegramLead } from "@/lib/telegram/parse";
import { getTelegramLead, markTelegramLead } from "@/lib/telegram/store";
import { validateParsedLead } from "@/lib/telegram/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Admin actions on one reviewed lead.
 *
 *   action "reparse"  — re-run the parser over the stored raw message, no CRM write. This is the
 *                       "we fixed the parser, show me what it gets now" lever.
 *   action "submit"   — push the reviewed fields to the CRM via the SAME path the automatic
 *                       pipeline uses, so tagging and cadence behave identically.
 *   action "dismiss"  — this was never a lead (chatter, a duplicate, a test).
 */

const EDITABLE = [
  "firstName",
  "lastName",
  "phoneE164",
  "email",
  "stateRaw",
  "goal",
  "monthlySavings",
  "bestCallTime",
  "adName",
  "enteredAtRaw",
  "localCallNote",
] as const;

function sanitize(input: unknown): ParsedTelegramLead {
  const src = (input ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of EDITABLE) {
    const v = src[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out as ParsedTelegramLead;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    leadKey?: string;
    action?: string;
    fields?: unknown;
    reason?: string;
  } | null;

  if (!body?.leadKey || !body.action) {
    return NextResponse.json(
      { success: false, error: "leadKey and action are required" },
      { status: 400 }
    );
  }

  const config = getTelegramLeadsConfig();
  const log = createTelegramLogger(config.debug);

  try {
    const row = await getTelegramLead(body.leadKey, log);
    if (!row) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    // ── reparse ───────────────────────────────────────────────────────────────
    if (body.action === "reparse") {
      const rawText = row.jobState?.rawText ?? "";
      if (!rawText.trim()) {
        return NextResponse.json({ success: false, error: "No stored message to re-parse" }, { status: 409 });
      }
      const { parsed, diagnostics } = parseEmpiregrowthLead(rawText);
      const validation = validateParsedLead(parsed, diagnostics);
      return NextResponse.json({ success: true, parsed, diagnostics, validation });
    }

    // ── dismiss ───────────────────────────────────────────────────────────────
    if (body.action === "dismiss") {
      await markTelegramLead(
        {
          leadKey: body.leadKey,
          status: "dismissed",
          needsReview: false,
          reviewReason: body.reason?.trim() || "dismissed_by_admin",
          reviewedAt: new Date(),
          reviewedByUserId: userId,
        },
        log
      );
      return NextResponse.json({ success: true, status: "dismissed" });
    }

    // ── submit ────────────────────────────────────────────────────────────────
    if (body.action !== "submit") {
      return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    const parsed = sanitize(body.fields);
    parsed.parseSource = "manual";
    const validation = validateParsedLead(parsed);

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: "A valid US phone number is required", validation },
        { status: 400 }
      );
    }

    const result = await pushLeadToCrm(
      parsed,
      {
        chatId: row.chatId,
        messageId: row.messageId,
        receivedAt: row.createdAt ?? undefined,
        rawText: row.jobState?.rawText,
      },
      config,
      log
    );

    if (!result.ok) {
      await markTelegramLead(
        {
          leadKey: body.leadKey,
          status: "needs_review",
          needsReview: true,
          reviewReason: "crm_failed",
          errorMessage: result.reason ?? "crm_failed",
        },
        log
      );
      return NextResponse.json(
        { success: false, error: result.reason ?? "Could not write to the CRM" },
        { status: 502 }
      );
    }

    await markTelegramLead(
      {
        leadKey: body.leadKey,
        status: "completed",
        needsReview: false,
        reviewReason: null,
        contactId: result.contactId ?? null,
        locationId: config.locationId,
        matchedBy: result.matchedBy ?? null,
        phone: parsed.phoneE164 ?? null,
        email: parsed.email ?? null,
        firstName: parsed.firstName ?? null,
        lastName: parsed.lastName ?? null,
        stateCode: parsed.stateCode ?? null,
        parseSource: "manual",
        tagsAdded: result.tagsAdded,
        cadenceStarted: result.cadenceStarted,
        errorMessage: null,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
        jobState: { ...(row.jobState ?? {}), step: "tag" },
      },
      log
    );

    return NextResponse.json({
      success: true,
      contactId: result.contactId,
      matchedBy: result.matchedBy,
      tagsAdded: result.tagsAdded,
      cadenceStarted: result.cadenceStarted,
      dryRun: result.dryRun ?? false,
    });
  } catch (error) {
    console.error("[admin/telegram-leads/submit]", error);
    return NextResponse.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
