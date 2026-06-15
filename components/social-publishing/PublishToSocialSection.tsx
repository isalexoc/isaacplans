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
} from "@/lib/social-publishing/types";
import type { SocialPostCopy } from "@/lib/social-media-studio/types";

interface Props {
  sanityPostId: string;
  copies: SocialPostCopy[];
  squareImageUrl?: string;
  verticalImageUrl?: string;
  locale: string;
}

interface ConnectionInfo {
  platform: SocialPlatform;
  status: string;
  platformAccountName: string | null;
}

type PlatformPublishState = "idle" | "publishing" | "success" | "error" | "scheduled";

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
};

export function PublishToSocialSection({ sanityPostId, copies, squareImageUrl, verticalImageUrl, locale }: Props) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [platformStates, setPlatformStates] = useState<Record<SocialPlatform, PlatformPublishState>>(
    {} as Record<SocialPlatform, PlatformPublishState>
  );
  const [platformErrors, setPlatformErrors] = useState<Partial<Record<SocialPlatform, string>>>({});
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

  function setPlatformState(platform: SocialPlatform, state: PlatformPublishState) {
    setPlatformStates((prev) => ({ ...prev, [platform]: state }));
  }

  async function publishNow(platform: SocialPlatform) {
    const caption  = getCaptionForPlatform(platform);
    const imageUrl = getImageForPlatform(platform);
    if (!caption || !imageUrl) {
      setPlatformErrors((prev) => ({ ...prev, [platform]: "Missing copy or image for this platform" }));
      return;
    }

    setPlatformState(platform, "publishing");
    setPlatformErrors((prev) => { const n = { ...prev }; delete n[platform]; return n; });

    const res = await fetch("/api/admin/social-publishing/publish", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sanityPostId, platform, caption, imageUrl }),
    });
    const data = await res.json();
    if (data.success) {
      setPlatformState(platform, "success");
    } else {
      setPlatformState(platform, "error");
      setPlatformErrors((prev) => ({ ...prev, [platform]: data.error ?? "Publish failed" }));
    }
  }

  async function schedulePost(platform: SocialPlatform) {
    const caption  = getCaptionForPlatform(platform);
    const imageUrl = getImageForPlatform(platform);
    if (!caption || !imageUrl) {
      setPlatformErrors((prev) => ({ ...prev, [platform]: "Missing copy or image" }));
      return;
    }

    setPlatformState(platform, "publishing");
    const res = await fetch("/api/admin/social-publishing/schedule", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sanityPostId,
        sanityPostTitle: copies[0]?.hook?.slice(0, 80) ?? sanityPostId,
        platform,
        locale,
        scheduledFor: new Date(scheduleState.scheduledFor).toISOString(),
        imageUrl,
        copySnapshot: copies.find((c) => c.platform === platform && c.locale === locale),
      }),
    });
    const data = await res.json();
    if (data.success) {
      setPlatformState(platform, "scheduled");
    } else {
      setPlatformState(platform, "error");
      setPlatformErrors((prev) => ({ ...prev, [platform]: data.error ?? "Schedule failed" }));
    }
  }

  async function handlePublish(platform: SocialPlatform) {
    if (scheduleState.mode === "now") {
      await publishNow(platform);
    } else {
      await schedulePost(platform);
    }
  }

  const connectedPlatforms = new Set(connections.filter((c) => c.status === "active").map((c) => c.platform));

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

      {/* Platform rows */}
      <div className="flex flex-col gap-2">
        {ALL_SOCIAL_PLATFORMS.filter((p) => connectedPlatforms.has(p)).map((platform) => {
          const state = platformStates[platform] ?? "idle";
          const error = platformErrors[platform];
          const conn  = connections.find((c) => c.platform === platform);

          return (
            <div
              key={platform}
              className="flex items-center justify-between gap-3 p-3 rounded-md border"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span>{PLATFORM_ICONS[platform]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{SOCIAL_PLATFORM_LABELS[platform]}</p>
                  {conn?.platformAccountName && (
                    <p className="text-xs text-muted-foreground truncate">{conn.platformAccountName}</p>
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
                  <Button size="sm" variant="outline" onClick={() => handlePublish(platform)}>
                    {scheduleState.mode === "now"
                      ? <><Send className="h-3 w-3 mr-1" />Publish</>
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
