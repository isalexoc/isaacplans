"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Link2Off, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ALL_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "@/lib/social-publishing/types";

interface SafeConnection {
  id: string;
  platform: SocialPlatform;
  status: string;
  platformAccountName: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string;
}

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  facebook:        "🔵",
  instagram:       "📷",
  threads:         "🧵",
  google_business: "🔍",
  tiktok:          "🎵",
  youtube:         "▶️",
};

const PLATFORM_CONNECT_NOTE: Record<SocialPlatform, string> = {
  facebook:        "Connects Facebook Page. Also enables Instagram if linked.",
  instagram:       "Connected automatically via Facebook Page.",
  threads:         "Requires a separate Threads developer app enrollment.",
  google_business: "Uses your Google Cloud project. Connects to your GBP location.",
  tiktok:          "TikTok publishing requires developer app approval.",
  youtube:         "Posts as YouTube Shorts. Provide a 9:16 video URL at publish time.",
};

export default function SocialConnectionsPage() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<SafeConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null);
  const [disconnecting, setDisconnecting] = useState<SocialPlatform | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const connectedParam = searchParams.get("connected");
  const errorParam     = searchParams.get("error");

  useEffect(() => {
    if (connectedParam) setToast({ type: "success", msg: `${SOCIAL_PLATFORM_LABELS[connectedParam as SocialPlatform] ?? connectedParam} connected!` });
    if (errorParam)     setToast({ type: "error", msg: decodeURIComponent(errorParam) });
  }, [connectedParam, errorParam]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadConnections() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/social-publishing/connections");
      const data = await res.json();
      if (data.success) {
        setConnections(data.data);
      } else {
        setToast({ type: "error", msg: `Failed to load connections: ${data.error ?? "Unknown error"}` });
      }
    } catch (err) {
      setToast({ type: "error", msg: `Network error loading connections: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadConnections(); }, []);

  async function connect(platform: SocialPlatform) {
    // Instagram is connected automatically through Facebook
    if (platform === "instagram") {
      setToast({ type: "error", msg: "Connect Facebook first — Instagram is linked automatically." });
      return;
    }
    setConnecting(platform);
    try {
      const res = await fetch(`/api/admin/social-publishing/oauth/${platform}`);
      const data = await res.json();
      if (!data.url) throw new Error("No OAuth URL returned");
      window.location.href = data.url;
    } catch (err) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Failed to start OAuth" });
      setConnecting(null);
    }
  }

  async function disconnect(platform: SocialPlatform) {
    if (!confirm(`Disconnect ${SOCIAL_PLATFORM_LABELS[platform]}? Posts scheduled for this platform will fail.`)) return;
    setDisconnecting(platform);
    try {
      await fetch("/api/admin/social-publishing/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      await loadConnections();
      setToast({ type: "success", msg: `${SOCIAL_PLATFORM_LABELS[platform]} disconnected.` });
    } catch {
      setToast({ type: "error", msg: "Disconnect failed." });
    } finally {
      setDisconnecting(null);
    }
  }

  const connectedMap = new Map(connections.map((c) => [c.platform, c]));

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Social Platform Connections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your social accounts to publish directly from the studio.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/en/admin/social-publishing/calendar" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Calendar
          </a>
          <a href="/en/admin/social-media-studio" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Studio
          </a>
        </div>
      </div>

      {toast && (
        <div className={`rounded-md p-3 text-sm ${toast.type === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {ALL_SOCIAL_PLATFORMS.map((platform) => {
            const conn = connectedMap.get(platform);
            const isConnected = conn?.status === "active";
            const isConnecting    = connecting    === platform;
            const isDisconnecting = disconnecting === platform;

            return (
              <Card key={platform}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="text-xl">{PLATFORM_ICONS[platform]}</span>
                      {SOCIAL_PLATFORM_LABELS[platform]}
                      {isConnected && (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                          Connected
                        </Badge>
                      )}
                    </CardTitle>

                    {isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnect(platform)}
                        disabled={isDisconnecting}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        {isDisconnecting
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <><Link2Off className="h-3 w-3 mr-1" />Disconnect</>
                        }
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => connect(platform)}
                        disabled={!!connecting || platform === "instagram"}
                        className={platform === "instagram" ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {isConnecting
                          ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Redirecting...</>
                          : "Connect →"
                        }
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {isConnected && conn ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{conn.platformAccountName ?? "Connected"}</span>
                      {conn.tokenExpiresAt && (
                        <span className="text-xs">
                          · expires {new Date(conn.tokenExpiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{PLATFORM_CONNECT_NOTE[platform]}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
