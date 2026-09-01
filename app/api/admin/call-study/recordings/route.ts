import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { cloudinaryAudioUrl } from "@/lib/call-study/cloudinary";
import { getCallStudyConfig, isCallStudyConfigured } from "@/lib/call-study/config";
import { startTranscription } from "@/lib/call-study/scribe";
import {
  createRecording,
  listRecordings,
  markTranscribing,
  setStatus,
  toSummary,
} from "@/lib/call-study/store";

/**
 * Register an uploaded recording and start transcribing it, and list what has been uploaded.
 *
 * The audio itself never passes through here — the browser has already sent it straight to
 * Cloudinary — so this handler only ever moves a public id and some metadata.
 */

export const runtime = "nodejs";

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

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;
    const userId = guard.userId!;

    if (!isCallStudyConfigured()) {
      return NextResponse.json(
        { success: false, error: "ELEVENLABS_API_KEY is not configured." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const publicId = str(body?.publicId);
    if (!publicId) {
      return NextResponse.json({ success: false, error: "No uploaded file." }, { status: 400 });
    }

    const durationSeconds = num(body?.durationSeconds);
    const config = getCallStudyConfig();
    if (durationSeconds && durationSeconds > config.maxDurationSeconds) {
      const hours = (config.maxDurationSeconds / 3600).toFixed(1);
      return NextResponse.json(
        { success: false, error: `That recording is longer than the ${hours}h limit.` },
        { status: 400 }
      );
    }

    const audioUrl = cloudinaryAudioUrl(publicId);
    if (!audioUrl) {
      return NextResponse.json(
        { success: false, error: "Cloudinary is not configured." },
        { status: 500 }
      );
    }

    const sourceFilename = str(body?.filename);
    const recording = await createRecording({
      ownerUserId: userId,
      title: str(body?.title) ?? sourceFilename ?? "Untitled call",
      sourceFilename,
      cloudinaryPublicId: publicId,
      audioUrl,
      durationSeconds,
      sizeBytes: num(body?.sizeBytes),
      languageCode: str(body?.languageCode),
    });

    const started = await startTranscription({
      sourceUrl: audioUrl,
      // Two is right for a phone call and measurably improves separation; the client can override
      // for a three-way. Zero/absent means let the model decide.
      numSpeakers: num(body?.numSpeakers) ?? 2,
      languageCode: str(body?.languageCode) ?? undefined,
      // Always async. A one-hour call will not answer inside a single request, and the webhook
      // path costs nothing extra on a short one.
      webhook: true,
      config,
    });

    if (!started.ok) {
      // The row is kept, carrying the reason, so the agent sees what went wrong and can retry
      // rather than wondering where their upload went.
      await setStatus(recording.id, "failed", started.error);
      return NextResponse.json({ success: false, error: started.error }, { status: 502 });
    }

    await markTranscribing(recording.id, started.data.requestId);

    return NextResponse.json({
      success: true,
      recording: toSummary({ ...recording, status: "transcribing" }),
    });
  } catch (error) {
    console.error("[call-study/recordings] POST", error);
    return NextResponse.json({ success: false, error: "Failed to start transcription" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    const rows = await listRecordings(guard.userId!);
    return NextResponse.json({ success: true, recordings: rows.map(toSummary) });
  } catch (error) {
    console.error("[call-study/recordings] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}
