import type { VideoStoryboard, SocialLocale } from "@/lib/social-media-studio/types";

// Shared client-side orchestration for the HeyGen presenter render phase. Both the studio
// wizard (VideoGenerator) and the history page (HistoryVideoGenerator) run this BEFORE the
// JSON2Video compose step when `storyboard.presenter` is on: it submits the presenter render
// and polls until the clip is ready, returning the URL + duration to feed into the compose call.

const PRESENTER_SUBMIT_URL = "/api/admin/social-media-studio/generate-presenter";
const PRESENTER_STATUS_URL = "/api/admin/social-media-studio/generate-presenter/status";

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 120; // ~10 min — HeyGen renders are slower than JSON2Video

interface PresenterResult {
  presenterVideoUrl: string;
  presenterDurationSec: number;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Request failed");
  return data.data;
}

export async function runPresenterPhase(
  storyboard: VideoStoryboard,
  locale: SocialLocale
): Promise<PresenterResult> {
  const narration = storyboard.scenes.map((s) => s.narration.trim()).filter(Boolean).join(" ");
  const submit = await postJson(PRESENTER_SUBMIT_URL, { narration, locale });
  const videoId = submit.presenterVideoId as string;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${PRESENTER_STATUS_URL}?videoId=${encodeURIComponent(videoId)}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? "Presenter render failed");
    if (data.data.status === "done" && data.data.presenterVideoUrl) {
      return {
        presenterVideoUrl:    data.data.presenterVideoUrl as string,
        presenterDurationSec: (data.data.presenterDurationSec as number) ?? storyboard.durationSeconds,
      };
    }
  }
  throw new Error("Presenter render timed out. Please try again.");
}
