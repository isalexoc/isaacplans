import { NextRequest, NextResponse } from "next/server";
import { canOperateLine, canOperateSession, getStaffAccess, type StaffAccess } from "@/lib/auth/access";
import { getIntakeByToken, resolveCrmContactLocale } from "@/lib/iul-intake/server";
import { getIntakeConfig } from "@/lib/intake-configs";
import { getIntakeByToken as getEngineIntakeByToken } from "@/lib/intake-core/server";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import {
  buildCrankwheelHookUrl,
  crankwheelConfigForUser,
  isCrankwheelConfigured,
  sameAccountPresenters,
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
 * The admin can anchor a link to an IUL intake session (`intakeToken`), a bare CRM contact
 * (`crmContactId`, the standalone launcher) or an intake-engine session (`engineLob` +
 * `engineToken`). A scoped agent (Legal Shield's `legal_shield` role) only the last, and only on a
 * session they may operate: the contact, name and phone come from that session, never the body.
 *
 * Each agent mints on their OWN CrankWheel account (`crankwheelConfigForUser`). An agent without
 * one gets `no_presenter`, never Isaac's account.
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

type Staff = StaffAccess & { userId: string };

/** Any staff role; what each may anchor to is decided per request below. */
async function requireStaff(): Promise<{ access: Staff; error?: undefined } | { error: NextResponse }> {
  const access = await getStaffAccess();
  if (!access.userId) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!access.role) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { access: access as Staff };
}

const forbidden = () => NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
const notFound = () => NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

/**
 * The intake-engine session a link is for, when the caller may operate it. Null for "no such line,
 * no such session, or not yours" alike.
 */
async function operableEngineSession(access: Staff, lob: string | null, token: string | null) {
  if (!lob || !token) return null;
  const config = getIntakeConfig(lob);
  if (!config || !canOperateLine(access, lob)) return null;
  const row = await getEngineIntakeByToken(config, token);
  if (!row || !canOperateSession(access, config, row)) return null;
  return { config, row };
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requireStaff();
    if (guard.error) return guard.error;
    const access = guard.access;
    const userId = access.userId;

    const body = await request.json().catch(() => ({}));
    const engineLob = str(body?.engineLob);
    const engineToken = str(body?.engineToken);
    // A scoped agent may only start a meeting from one of their own engine sessions: never an IUL
    // token or a bare CRM contact (those would let them meet with any of Isaac's contacts).
    if (!access.isAdmin && !engineToken) return forbidden();

    // Their own account, or Isaac's for the admin; never Isaac's for anyone else.
    const config = crankwheelConfigForUser(access);
    if (!config) {
      return NextResponse.json(
        { success: false, code: "no_presenter", error: "CrankWheel is not set up for this account." },
        { status: 400 }
      );
    }
    if (!isCrankwheelConfigured(config)) {
      return NextResponse.json(
        { success: false, error: "CrankWheel is not configured." },
        { status: 400 }
      );
    }

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

    let fixedLocale: "en" | "es" | null = null;
    let engineLine = false;
    const intakeToken = str(body?.intakeToken);
    if (engineToken) {
      const engine = await operableEngineSession(access, engineLob, engineToken);
      if (!engine) return notFound();
      engineLine = true;
      // Everything about who the meeting is with comes from the session, nothing from the body.
      sessionId = engine.row.id;
      crmContactId = engine.row.crmContactId;
      contactName = engine.row.contactName;
      contactEmail = engine.row.contactEmail;
      contactPhone = engine.row.contactPhone;
      fixedLocale = engine.config.fixedLocale ?? null;
      locale = (fixedLocale ?? engine.row.locale) === "es" ? "es" : "en";
    } else if (intakeToken) {
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
    // `resolveCrmContactLocale`. Best-effort: a CRM miss just leaves the fallback in place. A
    // one-language line (Legal Shield: Spanish) keeps its language.
    if (crmContactId && !fixedLocale) {
      const creds = agentCrmGetBaseCredentials();
      if (creds) locale = await resolveCrmContactLocale(crmContactId, locale, creds.token);
    }

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
      // An agent's own line never names Isaac Plans (the name can show on the join page).
      const fallbackName = engineLine ? (locale === "es" ? "Reunión" : "Meeting") : "Isaac Plans meeting";
      const scheduled = await createScheduledMeeting({
        name: contactName || contactEmail || fallbackName,
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
      presenterEmail: config.storedPresenter,
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

    // CrankWheel has already invalidated every older noauth link on this account
    // (truncate_older_links). Mirror that here, for this account only, so no other panel keeps
    // advertising a link that quietly stopped working.
    if (kind === "now") await supersedeActiveNowLinks(meeting.id, sameAccountPresenters(config));

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
    const guard = await requireStaff();
    if (guard.error) return guard.error;
    const access = guard.access;
    const userId = access.userId;

    const params = request.nextUrl.searchParams;
    const intakeToken = params.get("intakeToken");
    const crmContactId = params.get("crmContactId");
    const engineToken = params.get("engineToken");

    if (engineToken) {
      const engine = await operableEngineSession(access, params.get("engineLob"), engineToken);
      // Same quiet answer for "no such session" and "not yours", as below.
      if (!engine) return NextResponse.json({ success: true, meeting: null });
      const row = await getActiveMeetingForSession(engine.row.id);
      const mine = row && row.ownerUserId === userId ? row : null;
      return NextResponse.json({ success: true, meeting: mine ? toMeetingView(mine) : null });
    }

    // The IUL intake, a bare contact and the launcher's list are Isaac's tools only.
    if (!access.isAdmin) return forbidden();

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
