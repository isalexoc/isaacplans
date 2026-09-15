import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";

import { agentCrmContactUrl } from "@/lib/agent-crm-contacts";
import { getTelegramLeadsConfig } from "@/lib/telegram/config";
import { listTelegramLeads, type TelegramLeadStatus } from "@/lib/telegram/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Review queue data for /en/admin/telegram-leads. */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "attention";
    const config = getTelegramLeadsConfig();

    const rows = await listTelegramLeads(
      view === "all"
        ? { limit: 200 }
        : view === "completed"
          ? { status: ["completed"] as TelegramLeadStatus[], limit: 200 }
          : { needsAttention: true, limit: 200 }
    );

    return NextResponse.json({
      success: true,
      config: {
        enabled: config.enabled,
        dryRun: config.dryRun,
        allowlistCount: config.allowedChatIds.length,
        tags: config.baseTags,
      },
      leads: rows.map((r) => ({
        leadKey: r.leadKey,
        status: r.status,
        needsReview: r.needsReview,
        reviewReason: r.reviewReason,
        errorMessage: r.errorMessage,
        parseSource: r.parseSource,
        matchedBy: r.matchedBy,
        contactId: r.contactId,
        contactUrl:
          r.contactId && r.locationId ? agentCrmContactUrl(r.locationId, r.contactId) : null,
        firstName: r.firstName,
        lastName: r.lastName,
        phone: r.phone,
        email: r.email,
        stateCode: r.stateCode,
        tagsAdded: r.tagsAdded ?? [],
        cadenceStarted: r.cadenceStarted,
        attemptCount: r.attemptCount,
        rawText: r.jobState?.rawText ?? "",
        parsed: r.jobState?.parsed ?? {},
        unmatchedLines: r.jobState?.diagnostics?.unmatchedLines ?? [],
        warnings: r.jobState?.diagnostics?.warnings ?? [],
        createdAt: r.createdAt,
        messageAt: r.messageAt,
      })),
    });
  } catch (error) {
    console.error("[admin/telegram-leads]", error);
    return NextResponse.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
