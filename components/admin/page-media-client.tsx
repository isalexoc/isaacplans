"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  ExternalLink,
  Film,
  Image as ImageIcon,
  Loader2,
  Play,
  Repeat,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resetPageMediaAction } from "@/app/actions/page-media";
import { compressImageFile, formatBytes } from "@/lib/image-compress";
import {
  KIND_HINTS,
  KIND_LABELS,
  LOBS,
  LOB_SLUGS,
  SURFACE_HINTS,
  SURFACE_LABELS,
  livePathFor,
  surfacesFor,
  type HeroMedia,
  type LobSlug,
  type MediaKind,
  type MediaSurface,
  type PageMediaRow,
  type VideoPlayback,
} from "@/lib/page-media/shared";

const ACCEPTED_IMAGE = "image/jpeg,image/png,image/webp";
const ACCEPTED_VIDEO = "video/mp4,video/quicktime,video/webm";

const LOCALE_LABEL = { en: "English", es: "Spanish" } as const;

type Status = { type: "idle" } | { type: "ok"; msg: string } | { type: "error"; msg: string };

const cellId = (r: PageMediaRow) => `${r.lob}-${r.surface}-${r.kind}-${r.locale}`;

/**
 * Filename at the end of a Cloudinary URL, for showing WHICH asset is in use. Without this the
 * card can only show a picture, and one still frame looks much like another.
 */
function assetName(url: string): string {
  const last = url.split("?")[0].split("/").pop() ?? "";
  return last.replace(/\.[a-z0-9]+$/i, "") || url;
}

function MediaEditor({ row }: { row: PageMediaRow }) {
  const [override, setOverride] = useState<HeroMedia | null>(row.override);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [busy, setBusy] = useState<"idle" | "compressing" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [pending, startTransition] = useTransition();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  const working = busy !== "idle" || pending;
  const usingDefault = override === null;
  /** What the live page renders for this cell: the override if there is one, else the built-in
   *  default — which is itself a video on the pages that ship one. */
  const media: HeroMedia = override ?? row.defaultMedia;
  const isVideo = media.type === "video";
  /** Still to fall back to when a video has no poster of its own. */
  const defaultStill = row.defaultMedia.type === "video" ? row.defaultMedia.posterUrl : row.defaultMedia.url;
  const videoAllowed = row.kind === "hero";

  // Ads heroes sit in a tall desktop panel; everything else is a wide slot.
  const aspect =
    row.kind === "og" ? "aspect-[1200/630]" : row.surface === "ads" ? "aspect-[3/4]" : "aspect-video";

  /** Images go through our server (transform injection + compression); videos never can. */
  async function uploadImage(file: File, asPoster: boolean) {
    setStatus({ type: "idle" });
    setBusy("compressing");
    try {
      const compressed = await compressImageFile(file);
      if (compressed.size > 4 * 1024 * 1024) {
        setStatus({
          type: "error",
          msg: `Image is still ${formatBytes(compressed.size)} after compression — try a smaller photo.`,
        });
        return;
      }
      setBusy("uploading");
      const form = new FormData();
      form.append("file", compressed);
      form.append("lob", row.lob);
      form.append("surface", row.surface);
      form.append("kind", row.kind);
      form.append("locale", row.locale);
      if (asPoster) form.append("target", "poster");

      const res = await fetch("/api/admin/page-media/upload", { method: "POST", body: form });
      const data: { success: boolean; media?: HeroMedia; error?: string } = await res.json();
      if (data.success && data.media) {
        setOverride(data.media);
        setStatus({
          type: "ok",
          msg: asPoster ? "Poster updated. It shows before the video plays." : "Uploaded. The live page now uses this image.",
        });
      } else {
        setStatus({ type: "error", msg: data.error ?? "Upload failed." });
      }
    } catch {
      setStatus({ type: "error", msg: "Upload failed. Please try again." });
    } finally {
      setBusy("idle");
    }
  }

  /**
   * Video goes browser → Cloudinary directly. Vercel caps a serverless request body at 4.5 MB, so
   * proxying it through our own API route is not possible; XHR (rather than fetch) is what gives
   * us upload progress on a file that can take a minute.
   */
  async function uploadVideo(file: File) {
    setStatus({ type: "idle" });
    setBusy("uploading");
    setProgress(0);
    try {
      const signRes = await fetch("/api/admin/page-media/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lob: row.lob, surface: row.surface, locale: row.locale }),
      });
      const sign = await signRes.json();
      if (!sign.success) {
        setStatus({ type: "error", msg: sign.error ?? "Could not start the upload." });
        return;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("folder", sign.folder);
      form.append("signature", sign.signature);

      const publicId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && body.public_id) resolve(body.public_id);
            else reject(new Error(body?.error?.message ?? "Cloudinary rejected the upload."));
          } catch {
            reject(new Error("Cloudinary returned an unexpected response."));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(form);
      });

      const saveRes = await fetch("/api/admin/page-media/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lob: row.lob,
          surface: row.surface,
          kind: row.kind,
          locale: row.locale,
          publicId,
          playback: isVideo ? (media as Extract<HeroMedia, { type: "video" }>).playback : "loop",
        }),
      });
      const saved = await saveRes.json();
      if (saved.success) {
        setOverride(saved.media as HeroMedia);
        setStatus({ type: "ok", msg: "Video uploaded. The live page now plays it." });
      } else {
        setStatus({ type: "error", msg: saved.error ?? "Could not save the video." });
      }
    } catch (e) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Upload failed." });
    } finally {
      setBusy("idle");
      setProgress(0);
    }
  }

  async function saveFromUrl() {
    if (!urlInput.trim()) return;
    setStatus({ type: "idle" });
    setBusy("uploading");
    try {
      const res = await fetch("/api/admin/page-media/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lob: row.lob,
          surface: row.surface,
          kind: row.kind,
          locale: row.locale,
          url: urlInput.trim(),
          playback: isVideo ? (media as Extract<HeroMedia, { type: "video" }>).playback : "loop",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOverride(data.media as HeroMedia);
        setUrlInput("");
        setStatus({ type: "ok", msg: "Saved. The live page now uses this." });
      } else {
        setStatus({ type: "error", msg: data.error ?? "Could not save." });
      }
    } finally {
      setBusy("idle");
    }
  }

  function setPlayback(playback: VideoPlayback) {
    if (media.type !== "video") return;
    const optimistic = { ...media, playback };
    setOverride(optimistic);
    setStatus({ type: "idle" });
    startTransition(async () => {
      const res = await fetch("/api/admin/page-media/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lob: row.lob,
          surface: row.surface,
          kind: row.kind,
          locale: row.locale,
          url: optimistic.url,
          playback,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOverride(data.media as HeroMedia);
        setStatus({
          type: "ok",
          msg: playback === "loop" ? "Now loops silently in the background." : "Now shows a play button.",
        });
      } else {
        setStatus({ type: "error", msg: data.error ?? "Could not save." });
      }
    });
  }

  function resetToDefault() {
    setStatus({ type: "idle" });
    startTransition(async () => {
      const res = await resetPageMediaAction(row.lob, row.surface, row.kind, row.locale);
      if (res.ok) {
        setOverride(null);
        setStatus({ type: "ok", msg: "Cleared. The live page is back to the built-in default." });
      } else {
        setStatus({ type: "error", msg: res.error ?? "Could not save." });
      }
    });
  }

  const summary = usingDefault
    ? isVideo
      ? "Built-in video"
      : "Built-in default"
    : isVideo
      ? `Video — ${(media as Extract<HeroMedia, { type: "video" }>).playback === "loop" ? "background loop" : "click to play"}`
      : "Custom image";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{LOCALE_LABEL[row.locale]}</CardTitle>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              usingDefault
                ? "bg-muted text-muted-foreground"
                : isVideo
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            }`}
          >
            {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
            {summary}
          </span>
        </div>
        <CardDescription>{KIND_LABELS[row.kind]}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <input
          ref={imageInputRef}
          type="file"
          accept={ACCEPTED_IMAGE}
          className="hidden"
          disabled={working}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadImage(f, false);
            e.target.value = "";
          }}
        />
        <input
          ref={posterInputRef}
          type="file"
          accept={ACCEPTED_IMAGE}
          className="hidden"
          disabled={working}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadImage(f, true);
            e.target.value = "";
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept={ACCEPTED_VIDEO}
          className="hidden"
          disabled={working}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadVideo(f);
            e.target.value = "";
          }}
        />

        {/* ── What the live page is showing right now ── */}
        <section>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            On the live page
          </p>
          <div className={`relative ${aspect} w-full max-w-[300px] overflow-hidden rounded-lg border bg-muted`}>
            {isVideo ? (
              // The real video, playable right here — the only way to be sure which clip is live.
              <video
                key={(media as Extract<HeroMedia, { type: "video" }>).url}
                src={(media as Extract<HeroMedia, { type: "video" }>).url}
                poster={(media as Extract<HeroMedia, { type: "video" }>).posterUrl || undefined}
                controls
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(media as Extract<HeroMedia, { type: "image" }>).url}
                alt="Current"
                className="h-full w-full object-cover object-center"
              />
            )}
            {working && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs font-medium">
                  {busy === "compressing" ? "Preparing…" : progress > 0 ? `Uploading ${progress}%` : "Saving…"}
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
            {assetName(media.url)}
          </p>
        </section>

        {/* ── The still shown before a video plays ── */}
        {isVideo && (
          <section className="rounded-md border bg-muted/40 p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Poster image
              <span className="ml-1.5 font-normal normal-case tracking-normal">
                {(media as Extract<HeroMedia, { type: "video" }>).posterCustom
                  ? "· your upload"
                  : "· auto, first frame of the video"}
              </span>
            </p>
            <div className="flex items-start gap-3">
              <div className={`relative ${aspect} w-24 shrink-0 overflow-hidden rounded border bg-background`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(media as Extract<HeroMedia, { type: "video" }>).posterUrl || defaultStill}
                  alt="Poster"
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={working}
                  onClick={() => posterInputRef.current?.click()}
                >
                  <ImageIcon className="mr-1.5 h-4 w-4" /> Upload poster
                </Button>
                <p className="break-all font-mono text-[10px] text-muted-foreground">
                  {assetName((media as Extract<HeroMedia, { type: "video" }>).posterUrl)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Playback mode ── */}
        {isVideo && (
          <section className="rounded-md border bg-muted/40 p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              How it plays
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={(media as Extract<HeroMedia, { type: "video" }>).playback === "loop" ? "default" : "outline"}
                disabled={working}
                onClick={() => setPlayback("loop")}
              >
                <Repeat className="mr-1.5 h-4 w-4" /> Background loop
              </Button>
              <Button
                type="button"
                size="sm"
                variant={(media as Extract<HeroMedia, { type: "video" }>).playback === "click" ? "default" : "outline"}
                disabled={working}
                onClick={() => setPlayback("click")}
              >
                <Play className="mr-1.5 h-4 w-4" /> Click to play
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {(media as Extract<HeroMedia, { type: "video" }>).playback === "loop"
                ? "Plays automatically, silent, on repeat — behaves like the photo it replaced. The poster is only a fallback here."
                : "Shows the poster with an animated play button; plays with sound when clicked. Best for talking-head videos."}
            </p>
          </section>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => imageInputRef.current?.click()}>
            <UploadCloud className="mr-1.5 h-4 w-4" /> {isVideo ? "Replace with image" : "Upload image"}
          </Button>
          {videoAllowed && (
            <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => videoInputRef.current?.click()}>
              <Film className="mr-1.5 h-4 w-4" /> {isVideo ? "Replace video" : "Upload video"}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={resetToDefault} disabled={working || usingDefault}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
            Use default
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {videoAllowed
            ? "JPEG, PNG or WebP for images; MP4, MOV or WebM for video. Uploading a new video resets the poster to its first frame."
            : "JPEG, PNG or WebP. Standard social card size is 1200×630."}
        </p>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Or paste a Cloudinary URL
          </summary>
          <div className="mt-2 flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://res.cloudinary.com/isaacdev/…"
              className="h-8 text-xs"
              disabled={working}
            />
            <Button type="button" size="sm" disabled={working || !urlInput.trim()} onClick={saveFromUrl}>
              Save
            </Button>
          </div>
        </details>

        {status.type === "ok" && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400">{status.msg}</p>
        )}
        {status.type === "error" && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{status.msg}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SurfacePanel({ lob, surface, rows }: { lob: LobSlug; surface: MediaSurface; rows: PageMediaRow[] }) {
  return (
    <div className="space-y-8">
      <p className="text-xs text-muted-foreground">{SURFACE_HINTS[surface]}</p>
      {(["hero", "og"] as MediaKind[]).map((kind) => {
        const cells = rows
          .filter((r) => r.kind === kind)
          .sort((a, b) => a.locale.localeCompare(b.locale));
        if (!cells.length) return null;
        return (
          <section key={kind}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{KIND_LABELS[kind]}</h3>
                <p className="text-xs text-muted-foreground">{KIND_HINTS[kind]}</p>
              </div>
              <a
                href={livePathFor(lob, surface, "en")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View live page <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {cells.map((row) => (
                <MediaEditor key={cellId(row)} row={row} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function PageMediaClient({ settings }: { settings: PageMediaRow[] }) {
  const byLob = useMemo(() => {
    const map = new Map<LobSlug, PageMediaRow[]>();
    for (const lob of LOB_SLUGS) map.set(lob, []);
    for (const row of settings) map.get(row.lob)?.push(row);
    return map;
  }, [settings]);

  /** Lines that have at least one override, so the tabs show where something is customized. */
  const customized = useMemo(() => {
    const set = new Set<LobSlug>();
    for (const row of settings) if (row.override) set.add(row.lob);
    return set;
  }, [settings]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ImageIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Page Media</h1>
          <p className="text-sm text-muted-foreground">
            Swap the hero and social-share image on any line-of-business page — or drop in a video
            instead of a photo. Changes go live immediately, no deploy.
          </p>
        </div>
      </div>

      <Tabs defaultValue={LOB_SLUGS[0]}>
        <TabsList className="flex-wrap">
          {LOB_SLUGS.map((lob) => (
            <TabsTrigger key={lob} value={lob} className="gap-1.5">
              {LOBS[lob].label}
              {customized.has(lob) && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" title="Has custom media" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {LOB_SLUGS.map((lob) => {
          const rows = byLob.get(lob) ?? [];
          const surfaces = surfacesFor(lob);
          return (
            <TabsContent key={lob} value={lob} className="mt-6">
              <Tabs defaultValue={surfaces[0]}>
                <TabsList>
                  {surfaces.map((surface) => {
                    const hasCustom = rows.some((r) => r.surface === surface && r.override);
                    return (
                      <TabsTrigger key={surface} value={surface} className="gap-1.5">
                        {SURFACE_LABELS[surface]}
                        {hasCustom && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" title="Has custom media" />
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {surfaces.map((surface) => (
                  <TabsContent key={surface} value={surface} className="mt-6">
                    <SurfacePanel
                      lob={lob}
                      surface={surface}
                      rows={rows.filter((r) => r.surface === surface)}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
