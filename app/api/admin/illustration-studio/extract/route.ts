import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLeaveBehindAgentProfile } from "@/lib/leave-behind-agent-profile-server";
import { detectCarrier } from "@/lib/illustration-studio/carriers";
import { buildDefaultPresentation, seedPresentedBy } from "@/lib/illustration-studio/defaults";
import { extractIllustration } from "@/lib/illustration-studio/extract";
import { createIllustrationSummary, getLatestPresentedBy } from "@/lib/illustration-studio/store";
import { extractRequestSchema, firstIssue } from "@/lib/illustration-studio/validate";
import type { IllustrationExtraction, PresentedBy } from "@/lib/illustration-studio/types";
import { getAgentLocalTimezone, localCalendarDateKey } from "@/lib/timezone";

// One structured-output call over up to ~60k tokens of illustration text: 8–25 s on gpt-4o for the
// sample illustrations, with headroom for slow API days.
export const runtime = "nodejs";
export const maxDuration = 300;

const LOG = "[admin/illustration-studio/extract]";

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

/** The block the agent printed last time, else their profile name plus the illustration's address. */
async function resolvePresentedBy(userId: string, extraction: IllustrationExtraction): Promise<PresentedBy> {
  const latest = await getLatestPresentedBy(userId);
  if (latest) return latest;
  let profileName: string | null = null;
  try {
    const profile = await getLeaveBehindAgentProfile(userId);
    profileName = profile ? `${profile.firstName} ${profile.lastName}`.trim() || null : null;
  } catch (error) {
    console.warn(`${LOG} agent profile unavailable:`, error);
  }
  return seedPresentedBy(extraction, profileName);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = extractRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }
    const { fileName, pages } = parsed.data;

    const started = Date.now();
    const result = await extractIllustration(pages);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
    const { extraction } = result;
    // Never log page text: illustrations carry the client's name, age and state.
    console.info(LOG, {
      pages: extraction.meta.pageCount,
      promptTokens: extraction.meta.promptTokens,
      ledgerRows: extraction.ledger.length,
      warnings: extraction.warnings.length,
      ms: Date.now() - started,
    });

    const presentation = buildDefaultPresentation(extraction, {
      carrierKey: detectCarrier(pages.join("\n")),
      today: localCalendarDateKey(new Date(), getAgentLocalTimezone()),
      presentedBy: await resolvePresentedBy(userId, extraction),
    });
    const summary = await createIllustrationSummary({ userId, sourceFileName: fileName, extraction, presentation });

    return NextResponse.json({ success: true, id: summary.id });
  } catch (error) {
    console.error(`${LOG} POST`, error);
    return NextResponse.json({ success: false, error: "Couldn't read this illustration." }, { status: 500 });
  }
}
