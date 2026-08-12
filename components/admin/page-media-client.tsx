"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  ExternalLink,
  Film,
  Image as ImageIcon,
  Loader2,
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
  type MediaLocale,
  type MediaSurface,
  type PageMediaRow,
  type VideoPlayback,
} from "@/lib/page-media/shared";

const ACCEPTED_IMAGE = "image/jpeg,image/png,image/webp";
const ACCEPTED_VIDEO = "video/mp4,video/quicktime,video/webm";

const LOCALE_LABEL: Record<MediaLocale, string> = { en: "English", es: "Spanish" };

type Status = { type: "idle" } | { type: "ok"; msg: string } | { type: "error"; msg: string };

/** Cell key — stable across renders, used for React keys and input ids. */
const cellId = (r: PageMediaRow) => `${r.lob}-${r.surface}-${r.kind}-${r.locale}`;

function MediaEditor({ row }: { row: PageMediaRow }) {
  const [media, setMedia] = useState<HeroMedia | null>(row.override);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [busy, setBusy] = useState<"idle" | "compressing" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [pending, startTransition] = useTransition();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const working = busy !== "idle" || pending;
  const usingDefault = media === null;
  // Only heroes accept video — a link preview can't play one.
  const videoAllowed = row.kind === "hero";
  const previewUrl = media
    ? media.type === "video"
      ? media.posterUrl || row.defaultUrl
      : media.url
    : row.defaultUrl;

  /** Images go through our server (transform injection + compression); videos never can. */
  async function uploadImage(file: File) {
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

      const res = await fetch("/api/admin/page-media/upload", { method: "POST", body: form });
      const data: { success: boolean; url?: string; error?: string } = await res.json();
      if (data.success && data.url) {
        setMedia({ type: "image", url: data.url });
        setStatus({ type: "ok", msg: "Uploaded. The live page now uses this image." });
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
          playback: media?.type === "video" ? media.playback : "loop",
        }),
      });
      const saved = await saveRes.json();
      if (saved.success) {
        setMedia(saved.media as HeroMedia);
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
          playback: media?.type === "video" ? media.playback : "loop",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMedia(data.media as HeroMedia);
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
    if (media?.type !== "video") return;
    const next = { ...media, playback };
    setMedia(next);
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
          url: next.url,
          playback,
        }),
      });
      const data = await res.json();
      setStatus(
        data.success
          ? { type: "ok", msg: playback === "loop" ? "Now loops silently in the background." : "Now shows a play button." }
          : { type: "error", msg: data.error ?? "Could not save." }
      );
    });
  }

  function resetToDefault() {
    setStatus({ type: "idle" });
    startTransition(async () => {
      const res = await resetPageMediaAction(row.lob, row.surface, row.kind, row.locale);
      if (res.ok) {
        setMedia(null);
        setStatus({ type: "ok", msg: "Cleared. The live page is back to the built-in default." });
      } else {
        setStatus({ type: "error", msg: res.error ?? "Could not save." });
      }
    });
  }

  // Ads heroes sit in a tall desktop panel; everything else is a wide slot.
  const aspect =
    row.kind === "og" ? "aspect-[1200/630]" : row.surface === "ads" ? "aspect-[3/4]" : "aspect-video";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{LOCALE_LABEL[row.locale]}</CardTitle>
        <CardDescription>
          {media
            ? media.type === "video"
              ? `A custom video is active (${media.playback === "loop" ? "background loop" : "click to play"}).`
              : "A custom image is currently active."
            : "Currently showing the built-in default."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <input
          ref={imageInputRef}
          type="file"
          accept={ACCEPTED_IMAGE}
          className="hidden"
          disabled={working}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadImage(f);
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

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!working) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (!f || working) return;
            if (f.type.startsWith("video/") && videoAllowed) void uploadVideo(f);
            else void uploadImage(f);
          }}
          disabled={working}
          className={`group relative ${aspect} w-full max-w-[280px] overflow-hidden rounded-lg border-2 bg-muted text-left transition-colors disabled:cursor-wait ${
            dragOver ? "border-primary" : "border-dashed border-muted-foreground/30 hover:border-primary/60"
          }`}
        >
          {/* Plain img — the preview may be any Cloudinary URL, including a video poster frame. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview" className="h-full w-full object-cover object-center" />
          <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {media?.type === "video" ? <Film className="h-3 w-3" /> : null}
            {usingDefault ? "Default" : media?.type === "video" ? "Video" : "Custom"}
          </span>
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 ${
              dragOver || working ? "opacity-100" : ""
            }`}
          >
            {working ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs font-medium">
                  {busy === "compressing"
                    ? "Preparing…"
                    : progress > 0
                      ? `Uploading ${progress}%`
                      : "Uploading…"}
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="h-6 w-6" />
                <span className="text-xs font-medium">Click or drag to replace</span>
              </>
            )}
          </div>
        </button>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => imageInputRef.current?.click()}>
            <ImageIcon className="mr-1.5 h-4 w-4" /> Upload image
          </Button>
          {videoAllowed && (
            <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => videoInputRef.current?.click()}>
              <Film className="mr-1.5 h-4 w-4" /> Upload video
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={resetToDefault}
            disabled={working || usingDefault}
          >
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
            Use default
          </Button>
        </div>

        {media?.type === "video" && (
          <div className="rounded-md border bg-muted/40 p-2.5">
            <p className="mb-1.5 text-xs font-medium">How should it play?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={media.playback === "loop" ? "default" : "outline"}
                disabled={working}
                onClick={() => setPlayback("loop")}
              >
                Background loop
              </Button>
              <Button
                type="button"
                size="sm"
                variant={media.playback === "click" ? "default" : "outline"}
                disabled={working}
                onClick={() => setPlayback("click")}
              >
                Click to play
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {media.playback === "loop"
                ? "Plays automatically, silent, on repeat — behaves like the photo it replaced."
                : "Shows the first frame with a play button; plays with sound when clicked. Best for talking-head videos."}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {videoAllowed
            ? "JPEG, PNG or WebP for images; MP4, MOV or WebM for video. Large photos are compressed automatically."
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
            <TabsTrigger key={lob} value={lob}>
              {LOBS[lob].label}
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
                  {surfaces.map((surface) => (
                    <TabsTrigger key={surface} value={surface}>
                      {SURFACE_LABELS[surface]}
                    </TabsTrigger>
                  ))}
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
