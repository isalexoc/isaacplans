"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ALL_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
  type PublishFormat,
} from "@/lib/social-publishing/types";
import type { SocialPostCopy } from "@/lib/social-media-studio/types";

interface Props {
  sanityPostId: string;
  copies: SocialPostCopy[];
  squareImageUrl?: string;
  verticalImageUrl?: string;
  locale: string;
  publishedPlatforms?: string[];
  /** Pre-fills the YouTube video URL field (e.g. from an auto-generated AI Short). */
  initialYoutubeVideoUrl?: string;
}

interface ConnectionInfo {
  platform: SocialPlatform;
  status: string;
  platformAccountName: string | null;
}

type PlatformPublishState = "idle" | "publishing" | "success" | "error" | "scheduled";

/** A single publishable row: an image post, or a reel (video) for FB/IG. */
interface PublishTarget {
  key: string;            // unique row key + published-tracking key ("facebook", "facebook_reel")
  platform: SocialPlatform;
  format: PublishFormat;
  label: string;
  icon: string;
}

interface ScheduleState {
  mode: "now" | "schedule";
  scheduledFor: string; // ISO string from datetime-local input
}

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  facebook:        "🔵",
  instagram:       "📷",
  threads:         "🧵",
  google_business: "🔍",
  tiktok:          "🎵",
  youtube:         "▶️",
};

export function PublishToSocialSection({ sanityPostId, copies, squareImageUrl, verticalImageUrl, locale, publishedPlatforms = [], initialYoutubeVideoUrl }: Props) {
  const alreadyPublished = new Set(publishedPlatforms);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [platformStates, setPlatformStates] = useState<Record<string, PlatformPublishState>>({});
  const [platformErrors, setPlatformErrors] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState(initialYoutubeVideoUrl ?? "");

  // Keep the field in sync when an AI video finishes generating after mount.
  useEffect(() => {
    if (initialYoutubeVideoUrl) setVideoUrl(initialYoutubeVideoUrl);
  }, [initialYoutubeVideoUrl]);
  const [scheduleState, setScheduleState] = useState<ScheduleState>({
    mode: "now",
    scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  });

  useEffect(() => {
    fetch("/api/admin/social-publishing/connections")
      .then((r) => r.json())
      .then((data) => { if (data.success) setConnections(data.data); })
      .finally(() => setLoadingConns(false));
  }, []);

  function getCaptionForPlatform(platform: SocialPlatform): string {
    const copy = copies.find((c) => c.platform === platform && c.locale === locale)
      ?? copies.find((c) => c.platform === platform && c.locale === "en")
      ?? copies.find((c) => c.platform === platform);
    return copy?.fullPost ?? "";
  }

  function getImageForPlatform(platform: SocialPlatform): string {
    if (platform === "instagram" && verticalImageUrl) return verticalImageUrl;
    return squareImageUrl ?? verticalImageUrl ?? "";
  }

  function setPlatformState(key: string, state: PlatformPublishState) {
    setPlatformStates((prev) => ({ ...prev, [key]: state }));
  }

  /** Validate a target; returns an error string, or null when good to go. */
  function validateTarget(target: PublishTarget, caption: string, imageUrl: string): string | null {
    if (target.format === "reel") {
      if (!videoUrl) return "Generate or paste a video URL above before publishing a reel";
      return null;
    }
    if (target.platform === "youtube") {
      return videoUrl ? null : "Paste a video URL above before publishing to YouTube";
    }
    if (target.platform === "tiktok") {
      return (!videoUrl && (!caption || !imageUrl)) ? "TikTok needs a video URL above, or copy + image" : null;
    }
    return (!caption || !imageUrl) ? "Missing copy or image for this platform" : null;
  }

  async function publishNow(target: PublishTarget) {
    const caption  = getCaptionForPlatform(target.platform);
    const imageUrl = target.format === "reel" ? "" : getImageForPlatform(target.platform);
    const invalid = validateTarget(target, caption, imageUrl);
    if (invalid) {
      setPlatformErrors((prev) => ({ ...prev, [target.key]: invalid }));
      return;
    }

    setPlatformState(target.key, "publishing");
    setPlatformErrors((prev) => { const n = { ...prev }; delete n[target.key]; return n; });

    try {
      const body: Record<string, string> = { sanityPostId, platform: target.platform, format: target.format, caption, imageUrl };
      if (target.format === "reel" || target.platform === "youtube" || target.platform === "tiktok") {
        if (videoUrl) body.videoUrl = videoUrl;
      }
      const res = await fetch("/api/admin/social-publishing/publish", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server error (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.success) {
        setPlatformState(target.key, "success");
      } else {
        setPlatformState(target.key, "error");
        setPlatformErrors((prev) => ({ ...prev, [target.key]: data.error ?? "Publish failed" }));
      }
    } catch (err) {
      setPlatformState(target.key, "error");
      setPlatformErrors((prev) => ({ ...prev, [target.key]: err instanceof Error ? err.message : "Publish failed" }));
    }
  }

  async function schedulePost(target: PublishTarget) {
    const caption  = getCaptionForPlatform(target.platform);
    const imageUrl = target.format === "reel" ? "" : getImageForPlatform(target.platform);
    const invalid = validateTarget(target, caption, imageUrl);
    if (invalid) {
      setPlatformErrors((prev) => ({ ...prev, [target.key]: invalid }));
      return;
    }

    setPlatformState(target.key, "publishing");
    setPlatformErrors((prev) => { const n = { ...prev }; delete n[target.key]; return n; });

    try {
      const scheduleBody: Record<string, unknown> = {
        sanityPostId,
        sanityPostTitle: copies[0]?.hook?.slice(0, 80) ?? sanityPostId,
        platform: target.platform,
        format: target.format,
        locale,
        scheduledFor: new Date(scheduleState.scheduledFor).toISOString(),
        imageUrl,
        copySnapshot: copies.find((c) => c.platform === target.platform && c.locale === locale),
      };
      if (target.format === "reel" || target.platform === "youtube" || target.platform === "tiktok") {
        if (videoUrl) scheduleBody.videoUrl = videoUrl;
      }
      const res = await fetch("/api/admin/social-publishing/schedule", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleBody),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server error (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.success) {
        setPlatformState(target.key, "scheduled");
      } else {
        setPlatformState(target.key, "error");
        setPlatformErrors((prev) => ({ ...prev, [target.key]: data.error ?? "Schedule failed" }));
      }
    } catch (err) {
      setPlatformState(target.key, "error");
      setPlatformErrors((prev) => ({ ...prev, [target.key]: err instanceof Error ? err.message : "Schedule failed" }));
    }
  }

  async function handlePublish(target: PublishTarget) {
    if (scheduleState.mode === "now") {
      await publishNow(target);
    } else {
      await schedulePost(target);
    }
  }

  const connectedPlatforms = new Set(connections.filter((c) => c.status === "active").map((c) => c.platform));

  // One row per publishable target: every connected platform as an image/video post, plus a
  // separate Reel row for connected Facebook & Instagram (uses the video instead of the image).
  const targets: PublishTarget[] = ALL_SOCIAL_PLATFORMS
    .filter((p) => connectedPlatforms.has(p))
    .flatMap((platform) => {
      const post: PublishTarget = {
        key: platform, platform, format: "post",
        label: SOCIAL_PLATFORM_LABELS[platform], icon: PLATFORM_ICONS[platform],
      };
      if (platform === "facebook" || platform === "instagram") {
        const reel: PublishTarget = {
          key: `${platform}_reel`, platform, format: "reel",
          label: `${SOCIAL_PLATFORM_LABELS[platform]} Reel`, icon: "🎬",
        };
        return [post, reel];
      }
      return [post];
    });

  const hasReelTarget = targets.some((t) => t.format === "reel");

  if (loadingConns) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading connected platforms...
      </div>
    );
  }

  if (connectedPlatforms.size === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No social platforms connected.{" "}
        <a href="/en/admin/social-publishing/connections" className="text-blue-600 hover:underline">
          Connect platforms →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Timing toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">Post timing:</span>
        <div className="flex gap-2">
          {(["now", "schedule"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setScheduleState((p) => ({ ...p, mode }))}
              className={cn(
                "px-3 py-1 text-sm border rounded-md transition-colors",
                scheduleState.mode === mode ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
              )}
            >
              {mode === "now" ? "Publish Now" : "Schedule"}
            </button>
          ))}
        </div>
        {scheduleState.mode === "schedule" && (
          <input
            type="datetime-local"
            value={scheduleState.scheduledFor}
            onChange={(e) => setScheduleState((p) => ({ ...p, scheduledFor: e.target.value }))}
            className="border rounded-md px-2 py-1 text-sm"
            min={new Date().toISOString().slice(0, 16)}
          />
        )}
      </div>

      {/* Video URL input — shown when any video target is available (YouTube/TikTok or FB/IG Reels) */}
      {(connectedPlatforms.has("youtube") || connectedPlatforms.has("tiktok") || hasReelTarget) && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            🎬 Video URL (9:16 mp4) — used for YouTube, TikTok, and Facebook/Instagram Reels
          </label>
          <input
            type="url"
            placeholder="https://res.cloudinary.com/…/video.mp4"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm w-full"
          />
          <p className="text-xs text-muted-foreground">
            Auto-filled from the AI video above. Required for the Reel rows; TikTok posts it as a video when set.
          </p>
        </div>
      )}

      {/* Platform rows (image posts + Reel rows for FB/IG) */}
      <div className="flex flex-col gap-2">
        {targets.map((target) => {
          const state = platformStates[target.key] ?? "idle";
          const error = platformErrors[target.key];
          const conn  = connections.find((c) => c.platform === target.platform);
          const reelNeedsVideo = target.format === "reel" && !videoUrl;

          return (
            <div
              key={target.key}
              className="flex items-center justify-between gap-3 p-3 rounded-md border"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span>{target.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{target.label}</p>
                  {conn?.platformAccountName && (
                    <p className="text-xs text-muted-foreground truncate">{conn.platformAccountName}</p>
                  )}
                  {reelNeedsVideo && !error && (
                    <p className="text-xs text-muted-foreground mt-0.5">Add a video URL above to enable this reel.</p>
                  )}
                  {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
                </div>
              </div>

              <div className="shrink-0">
                {state === "success" && (
                  <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Published
                  </Badge>
                )}
                {state === "scheduled" && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Scheduled
                  </Badge>
                )}
                {state === "publishing" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {(state === "idle" || state === "error") && (
                  <Button size="sm" variant="outline" disabled={reelNeedsVideo} onClick={() => handlePublish(target)}>
                    {scheduleState.mode === "now"
                      ? <><Send className="h-3 w-3 mr-1" />{alreadyPublished.has(target.key) ? "Republish" : "Publish"}</>
                      : <><Clock className="h-3 w-3 mr-1" />Schedule</>
                    }
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        <a href="/en/admin/social-publishing/connections" className="hover:underline text-blue-600">
          Manage connections →
        </a>
        {" "}·{" "}
        <a href="/en/admin/social-publishing/calendar" className="hover:underline text-blue-600">
          View calendar →
        </a>
      </p>
    </div>
  );
}
