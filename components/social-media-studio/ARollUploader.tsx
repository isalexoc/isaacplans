"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, Link2, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Gets a recorded take into the studio.
 *
 * Files go straight from the browser to Cloudinary. That detour past our own server is not
 * optional — Vercel caps a serverless request body at 4.5 MB and a minute of phone video is many
 * times that — and XHR rather than fetch is what gives a real progress bar. Same approach as
 * components/admin/call-study/call-uploader.tsx.
 *
 * A URL is handed to the server instead, which asks Cloudinary to fetch it. That covers "here is
 * the Cloudinary link to the video I already have" without a pointless round trip through here.
 */

export interface ArollStartPayload {
  publicId?:    string;
  videoUrl?:    string;
  durationSec?: number;
  width?:       number;
  height?:      number;
  sourceUrl?:   string;
  brief?:       string;
  forceCrop?:   boolean;
}

export function ARollUploader({
  onStart,
  disabled,
}: {
  onStart: (payload: ArollStartPayload) => Promise<void>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [brief, setBrief] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState<"idle" | "uploading" | "starting">("idle");
  const [error, setError] = useState<string | null>(null);

  const working = busy !== "idle" || Boolean(disabled);

  async function submit() {
    setError(null);
    try {
      if (mode === "url") {
        if (!url.trim()) throw new Error("Paste the link to your video first.");
        setBusy("starting");
        await onStart({ sourceUrl: url.trim(), brief: brief.trim() || undefined });
        reset();
        return;
      }

      if (!file) throw new Error("Choose a video first.");
      setBusy("uploading");
      setProgress(0);

      const signRes = await fetch("/api/admin/social-media-studio/sign", {
        method: "POST",
        credentials: "same-origin",
      });
      const sign = await signRes.json().catch(() => ({}));
      if (!sign?.success) throw new Error(sign?.error ?? "Could not start the upload.");

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("folder", sign.folder);
      form.append("signature", sign.signature);

      const uploaded = await new Promise<{
        public_id: string;
        secure_url: string;
        duration?: number;
        width?: number;
        height?: number;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/video/upload`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && body.public_id) resolve(body);
            else reject(new Error(body?.error?.message ?? "Cloudinary rejected the upload."));
          } catch {
            reject(new Error("Cloudinary returned an unexpected response."));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(form);
      });

      setBusy("starting");
      await onStart({
        publicId:    uploaded.public_id,
        videoUrl:    uploaded.secure_url,
        // Cloudinary measures the file on ingest, so the length is known without probing it
        // ourselves — and this number goes on to be the finished ad's length.
        durationSec: uploaded.duration ? Math.round(uploaded.duration * 10) / 10 : 0,
        width:       uploaded.width,
        height:      uploaded.height,
        brief:       brief.trim() || undefined,
      });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy("idle");
      setProgress(0);
    }
  }

  function reset() {
    setFile(null);
    setUrl("");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clapperboard className="h-4 w-4 text-blue-600" />
        <h4 className="text-sm font-medium">Your recording</h4>
        <span className="text-xs text-muted-foreground">
          — vertical is best; 20–90 seconds converts hardest
        </span>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["file", "Upload a file", Upload],
            ["url", "Paste a link", Link2],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            disabled={working}
            onClick={() => setMode(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition-colors disabled:opacity-50",
              mode === value ? "border-blue-600 bg-blue-600 text-white" : "border-border hover:bg-muted"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <input
          id="aroll-file"
          ref={inputRef}
          type="file"
          accept="video/*"
          disabled={working}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-600/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700"
        />
      ) : (
        <Input
          value={url}
          disabled={working}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://res.cloudinary.com/…/my-take.mp4"
        />
      )}

      <div>
        <label htmlFor="aroll-brief" className="text-xs font-medium text-muted-foreground">
          Anything the story should know (optional)
        </label>
        <Textarea
          id="aroll-brief"
          value={brief}
          disabled={working}
          onChange={(e) => setBrief(e.target.value)}
          rows={2}
          placeholder="e.g. this is for parents in their 50s who think it's too late to start"
          className="mt-1 text-sm"
        />
      </div>

      {busy !== "idle" && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{busy === "uploading" ? "Uploading…" : "Reading your video…"}</span>
            {busy === "uploading" && <span>{progress}%</span>}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all"
              style={{ width: busy === "uploading" ? `${progress}%` : "100%" }}
            />
          </div>
        </div>
      )}

      <Button size="sm" disabled={working || (mode === "file" ? !file : !url.trim())} onClick={submit}>
        {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
        {working ? "Working…" : "Use this take"}
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
