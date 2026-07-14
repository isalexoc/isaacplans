import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { getLeadsTheWayConfig, isLeadsTheWayConfigured } from "@/lib/leads-the-way/config";
import { createLeadsTheWayLogger } from "@/lib/leads-the-way/log";
import { toE164, type ParsedLead } from "@/lib/leads-the-way/parse";
import { injectBackupLead } from "@/lib/leads-the-way/backup";

export const runtime = "nodejs";
export const maxDuration = 120;

const KEYS: (keyof ParsedLead)[] = [
  "firstName", "lastName", "phone", "email", "address1", "city", "state",
  "postalCode", "dateOfBirth", "leadType", "leadId", "purchaseDate", "purchasePrice",
];

/** Keep only known ParsedLead keys with non-empty string values. */
function sanitize(raw: unknown): ParsedLead {
  const out: ParsedLead = {};
  if (typeof raw !== "object" || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const key of KEYS) {
    const v = r[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sanitize((body as Record<string, unknown> | null)?.parsed ?? body);

  if (!toE164(parsed.phone)) {
    return NextResponse.json(
      { success: false, error: "A valid 10-digit phone number is required to create the lead." },
      { status: 400 }
    );
  }

  const config = getLeadsTheWayConfig();
  if (!isLeadsTheWayConfigured(config)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "The Leads-the-Way pipeline is not enabled/configured in this environment (needs LEADS_THE_WAY_ENABLED plus the CRM credentials). Run this on production where it's live.",
      },
      { status: 409 }
    );
  }

  try {
    const log = createLeadsTheWayLogger(config.debug);
    const injected = await injectBackupLead(parsed, log);

    return NextResponse.json({
      success: true,
      leadKey: injected.leadKey,
      alreadyProcessed: injected.alreadyProcessed,
      existingStatus: injected.existingStatus ?? null,
      processed: injected.result?.processed ?? false,
      ok: injected.result?.ok ?? true,
      reason: injected.result?.reason ?? null,
      contactId: injected.result?.contactId ?? null,
    });
  } catch (error) {
    console.error("[admin/lead-backup/submit]", error);
    return NextResponse.json(
      { success: false, error: "Failed to process the lead" },
      { status: 500 }
    );
  }
}
