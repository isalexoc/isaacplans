/**
 * Offline checks for the CrankWheel meeting integration.
 *
 * Covers the pure logic whose failure modes are quiet rather than loud: a note landing on the
 * wrong contact, a link opening in the wrong language, or a uid that cannot be parsed back out of
 * a URL so a link can never be revoked.
 *
 * No network, no database, no API keys. Run with: pnpm test:crankwheel
 */

import { matchUsageSession } from "../lib/crankwheel/matching";
import { formatMeetingNote } from "../lib/crankwheel/note";
import { uidFromUrl, withViewerLocale } from "../lib/crankwheel/url";
import type { CrankwheelUsageSession } from "../lib/crankwheel/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const PRESENTER = "isaac@isaacplans.com";

function session(overrides: Partial<CrankwheelUsageSession> & { start_date: string }): CrankwheelUsageSession {
  return {
    email: PRESENTER,
    session_id: 1,
    duration: 600,
    end_date: overrides.start_date,
    session_ended: true,
    viewer_info: { viewer_count: 1, max_viewer_count: 1 },
    ...overrides,
  };
}

console.log("\nURL helpers");
{
  const url = "https://meeting.is/999706646?hl=es&c=3-Aqer24hRs=";
  check("uid survives a trailing '='", uidFromUrl(url) === "3-Aqer24hRs=", String(uidFromUrl(url)));
  check("uid of a plain link", uidFromUrl("https://meeting.is/cw?hl=en&c=2TY9DUKyFes") === "2TY9DUKyFes");
  check("garbage in, null out", uidFromUrl("not a url") === null);
  check("missing c= is null", uidFromUrl("https://meeting.is/cw?hl=en") === null);

  // The account default is Spanish, so an English client depends entirely on this rewrite.
  check("es → en rewrite", withViewerLocale(url, "en").includes("hl=en"));
  check("rewrite preserves the uid", uidFromUrl(withViewerLocale(url, "en")) === "3-Aqer24hRs=");
  check("unknown locale falls back to en", withViewerLocale(url, "pt").includes("hl=en"));
  check("es stays es", withViewerLocale(url, "es").includes("hl=es"));
}

console.log("\nSession matching");
{
  const anchor = new Date("2026-08-30T20:00:00Z");

  const exact = session({ start_date: "2026-08-30T20:00:30.000000Z", session_id: 11 });
  const other = session({ start_date: "2026-08-30T20:01:00.000000Z", session_id: 12, email: "someone@else.com" });
  const far = session({ start_date: "2026-08-30T21:30:00.000000Z", session_id: 13 });

  check(
    "picks the session that starts alongside the hook",
    matchUsageSession([far, exact], { presenterEmail: PRESENTER, anchor, instant: true })?.session_id === 11
  );
  check(
    "ignores another presenter's session",
    matchUsageSession([other], { presenterEmail: PRESENTER, anchor, instant: true }) === null
  );
  check(
    "presenter match is case-insensitive",
    matchUsageSession([session({ start_date: "2026-08-30T20:00:10.000000Z", email: "ISAAC@ISAACPLANS.COM" })], {
      presenterEmail: PRESENTER,
      anchor,
      instant: true,
    }) !== null
  );
  check(
    "instant: nothing in the window means no match",
    matchUsageSession([far], { presenterEmail: PRESENTER, anchor, instant: true }) === null
  );

  // A scheduled meeting happens after the link went out, and can be well after it.
  check(
    "scheduled: accepts a session long after the anchor",
    matchUsageSession([far], { presenterEmail: PRESENTER, anchor, instant: false })?.session_id === 13
  );
  check(
    "scheduled: rejects a session well before the anchor",
    matchUsageSession([session({ start_date: "2026-08-30T18:00:00.000000Z" })], {
      presenterEmail: PRESENTER,
      anchor,
      instant: false,
    }) === null
  );
  check(
    "instant: a session slightly BEFORE the hook still matches",
    matchUsageSession([session({ start_date: "2026-08-30T19:58:00.000000Z", session_id: 14 })], {
      presenterEmail: PRESENTER,
      anchor,
      instant: true,
    })?.session_id === 14
  );
  check(
    "closest wins when two are in range",
    matchUsageSession(
      [
        session({ start_date: "2026-08-30T20:10:00.000000Z", session_id: 21 }),
        session({ start_date: "2026-08-30T20:01:00.000000Z", session_id: 22 }),
      ],
      { presenterEmail: PRESENTER, anchor, instant: true }
    )?.session_id === 22
  );
  check(
    "a still-running session is not matched",
    matchUsageSession([session({ start_date: "2026-08-30T20:00:10.000000Z", session_ended: false })], {
      presenterEmail: PRESENTER,
      anchor,
      instant: true,
    }) === null
  );
  check("empty input is null", matchUsageSession([], { presenterEmail: PRESENTER, anchor, instant: true }) === null);
}

console.log("\nNote formatting");
{
  const joined = formatMeetingNote({
    kind: "now",
    durationSeconds: 555,
    clientJoined: true,
    viewerLocations: ["Stafford, United States*"],
    startedAt: new Date("2026-08-30T20:09:44Z"),
    locale: "en",
  });
  check("reports the duration in minutes", joined.includes("9 minutes"), joined);
  check("strips CrankWheel's trailing asterisk", joined.includes("Stafford, United States") && !joined.includes("*"));
  check("no Markdown — GHL cannot render it", !joined.includes("**") && !joined.includes("##"));

  const missed = formatMeetingNote({
    kind: "now",
    durationSeconds: 120,
    clientJoined: false,
    startedAt: new Date("2026-08-30T20:09:44Z"),
    locale: "en",
  });
  check("says plainly when nobody turned up", missed.toLowerCase().includes("did not join"), missed);
  check("a no-show note carries no duration", !missed.includes("Duration"));

  const spanish = formatMeetingNote({
    kind: "scheduled",
    durationSeconds: 60,
    clientJoined: true,
    startedAt: new Date("2026-08-30T20:09:44Z"),
    locale: "es",
  });
  // Asserted on the VALUES, not the labels: labels go through `toBoldSans`, which replaces ASCII
  // with bold-sans codepoints, so a plain-text `includes("Duración")` could never match one.
  check(
    "Spanish note is in Spanish",
    spanish.includes("Enlace agendado") && spanish.includes("se conectó"),
    spanish
  );
  check("singular minute reads correctly", spanish.includes("1 minuto"), spanish);

  const brief = formatMeetingNote({
    kind: "now",
    durationSeconds: 20,
    clientJoined: true,
    startedAt: null,
    locale: "en",
  });
  check("sub-minute duration in seconds", brief.includes("20 seconds"), brief);
  check("no date row when the start time is unknown", !brief.includes("When:"));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
