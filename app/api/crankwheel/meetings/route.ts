import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { getIntakeByToken, resolveCrmContactLocale } from "@/lib/iul-intake/server";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import {
  buildCrankwheelHookUrl,
  getCrankwheelConfig,
  isCrankwheelConfigured,
} from "@/lib/crankwheel/config";
import {
  createNoauthLink,
  createScheduledMeeting,
  uidFromUrl,
  withViewerLocale,
} from "@/lib/crankwheel/client";
import {
  createMeeting,
  getActiveMeetingForContact,
  getActiveMeetingForSession,
  listRecentMeetings,
  newHookSecret,
  supersedeActiveNowLinks,
  toMeetingView,
} from "@/lib/crankwheel/meetings";
import type { CrankwheelMeetingKind } from "@/lib/crankwheel/types";

/**
 * Mint a CrankWheel meeting link, and list the ones minted recently.
 *
 * Admin-only. The link can be anchored to an IUL intake session (`intakeToken`) or to a bare CRM
 * contact (`crmContactId`) — the second is what the standalone launcher uses, and is the whole
 * reason this is not a route under `/api/iul-intake`.
 */

const KINDS: CrankwheelMeetingKind[] = ["now", "scheduled"];

function isKind(v: unknown): v is CrankwheelMeetingKind {
  return typeof v === "string" && (KINDS as string[]).includes(v);
}

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await getIsAdmin())) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { userId };
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;
    const userId = guard.userId!;

    if (!isCrankwheelConfigured()) {
      return NextResponse.json(
        { success: false, error: "CrankWheel is not configured." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (!isKind(body?.kind)) {
      return NextResponse.json({ success: false, error: "Unknown meeting kind." }, { status: 400 });
    }
    const kind: CrankwheelMeetingKind = body.kind;

    // Who the meeting is with. An intake token is the richer anchor — it carries the CRM contact
    // and the session — so it wins when both are supplied.
    let sessionId: string | null = null;
    let crmContactId = str(body?.crmContactId);
    let contactName = str(body?.contactName);
    let contactEmail = str(body?.contactEmail);
    let contactPhone = str(body?.contactPhone);
    let locale: "en" | "es" = body?.locale === "es" ? "es" : "en";

    const intakeToken = str(body?.intakeToken);
    if (intakeToken) {
      const row = await getIntakeByToken(intakeToken);
      if (!row) {
        return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      }
      if (row.ownerUserId !== userId) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      sessionId = row.id;
      crmContactId = row.crmContactId ?? crmContactId;
      contactName = row.contactName ?? contactName;
      contactEmail = row.contactEmail ?? contactEmail;
      contactPhone = row.contactPhone ?? contactPhone;
      locale = row.locale === "es" ? "es" : "en";
    }

    // The contact's own language beats whatever the session was created with — see
    // `resolveCrmContactLocale`. Best-effort: a CRM miss just leaves the fallback in place.
    if (crmContactId) {
      const creds = agentCrmGetBaseCredentials();
      if (creds) locale = await resolveCrmContactLocale(crmContactId, locale, creds.token);
    }

    const config = getCrankwheelConfig();
    const hookSecret = newHookSecret();

    let rawUrl: string | null = null;
    let uid: string | null = null;
    let expiresAt: Date | null = null;

    if (kind === "now") {
      // Hooks are what make the "client joined" badge work. They are optional: without a public
      // https origin (local dev) the link still works, it just reports nothing back.
      const created = await createNoauthLink({
        createHook: buildCrankwheelHookUrl(hookSecret, "created") ?? undefined,
        viewerHook: buildCrankwheelHookUrl(hookSecret, "viewer") ?? undefined,
        config,
      });
      if (!created?.url) {
        return NextResponse.json(
          { success: false, error: "CrankWheel did not return a link." },
          { status: 502 }
        );
      }
      rawUrl = created.url;
      uid = uidFromUrl(created.url);
      expiresAt = new Date(Date.now() + config.noauthWindowSeconds * 1000);
    } else {
      const scheduled = await createScheduledMeeting({
        name: contactName || contactEmail || "Isaac Plans meeting",
        config,
      });
      if (!scheduled?.url) {
        return NextResponse.json(
          { success: false, error: "CrankWheel did not return a link." },
          { status: 502 }
        );
      }
      rawUrl = scheduled.url;
      uid = scheduled.uid || uidFromUrl(scheduled.url);
    }

    const meeting = await createMeeting({
      kind,
      sessionId,
      crmContactId,
      ownerUserId: userId,
      contactName,
      contactEmail,
      contactPhone,
      locale,
      // Always rewritten: this account's links come back as hl=es by default, so an English client
      // would otherwise get a Spanish join page.
      url: withViewerLocale(rawUrl, locale),
      uid,
      hookSecret,
      expiresAt,
    });

    // CrankWheel has already invalidated every older noauth link (truncate_older_links). Mirror
    // that here so no other panel keeps advertising a link that quietly stopped working.
    if (kind === "now") await supersedeActiveNowLinks(meeting.id);

    return NextResponse.json({ success: true, meeting: toMeetingView(meeting) });
  } catch (error) {
    console.error("[crankwheel/meetings] POST", error);
    return NextResponse.json({ success: false, error: "Failed to create meeting" }, { status: 500 });
  }
}

/**
 * GET — either the live meeting for one target, or the launcher's recent list.
 *
 * The single-target form is what lets a panel survive a page reload: without it, an agent who
 * refreshes mid-call loses the link they just sent and mints a second one, which (because instant
 * links truncate each other) would silently break the one already on the client's phone.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;
    const userId = guard.userId!;

    const params = request.nextUrl.searchParams;
    const intakeToken = params.get("intakeToken");
    const crmContactId = params.get("crmContactId");

    if (intakeToken) {
      const session = await getIntakeByToken(intakeToken);
      if (!session || session.ownerUserId !== userId) {
        // Same answer for "no such session" and "not yours" — an agent has nothing to learn from
        // the difference, and an attacker would.
        return NextResponse.json({ success: true, meeting: null });
      }
      const row = await getActiveMeetingForSession(session.id);
      return NextResponse.json({ success: true, meeting: row ? toMeetingView(row) : null });
    }

    if (crmContactId) {
      const row = await getActiveMeetingForContact(crmContactId);
      const mine = row && row.ownerUserId === userId ? row : null;
      return NextResponse.json({ success: true, meeting: mine ? toMeetingView(mine) : null });
    }

    const rows = await listRecentMeetings(userId);
    return NextResponse.json({ success: true, meetings: rows.map(toMeetingView) });
  } catch (error) {
    console.error("[crankwheel/meetings] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}
