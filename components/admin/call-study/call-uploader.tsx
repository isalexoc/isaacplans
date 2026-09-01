"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sends a recording straight from the browser to Cloudinary, then registers it for transcription.
 *
 * The detour past our own server is not optional: Vercel caps a serverless request body at 4.5 MB
 * and these are hour-long recordings. XHR rather than fetch is what gives a real progress bar on an
 * upload that takes minutes. Same approach as `components/admin/page-media-client.tsx`.
 */
export default function CallUploader({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [speakers, setSpeakers] = useState("2");
  const [language, setLanguage] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState<"idle" | "uploading" | "starting">("idle");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    if (!file) return;
    setError(null);
    setBusy("uploading");
    setProgress(0);

    try {
      const signRes = await fetch("/api/admin/call-study/sign", {
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

      const uploaded = await new Promise<{ public_id: string; duration?: number; bytes?: number }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          // Audio and video both go to the video endpoint — Cloudinary treats audio as a video
          // resource with no picture, which is what makes the .mp3 rendition possible later.
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
        }
      );

      setBusy("starting");
      const res = await fetch("/api/admin/call-study/recordings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: uploaded.public_id,
          filename: file.name,
          title: title.trim() || file.name,
          sizeBytes: uploaded.bytes ?? file.size,
          durationSeconds: uploaded.duration ? Math.round(uploaded.duration) : undefined,
          numSpeakers: Number(speakers) || 2,
          languageCode: language.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Could not start transcription.");

      reset();
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy("idle");
      setProgress(0);
    }
  }

  const uploading = busy !== "idle";

  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <Upload className="h-5 w-5" /> Add a call
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Any audio or video file — mp3, wav, m4a, mp4. Up to 10 hours.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="cs-file">Recording</Label>
          <input
            id="cs-file"
            ref={inputRef}
            type="file"
            accept="audio/*,video/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
            }}
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
          />
        </div>

        <div>
          <Label htmlFor="cs-title">Title</Label>
          <Input
            id="cs-title"
            value={title}
            disabled={uploading}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Smith IUL call"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cs-speakers">Speakers</Label>
            <select
              id="cs-speakers"
              value={speakers}
              disabled={uploading}
              onChange={(e) => setSpeakers(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="2">2 (a phone call)</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="0">Let it decide</option>
            </select>
          </div>
          <div>
            <Label htmlFor="cs-lang">Language</Label>
            <select
              id="cs-lang"
              value={language}
              disabled={uploading}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Detect</option>
              <option value="eng">English</option>
              <option value="spa">Spanish</option>
            </select>
          </div>
        </div>
      </div>

      {uploading && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{busy === "uploading" ? "Uploading…" : "Starting transcription…"}</span>
            {busy === "uploading" && <span>{progress}%</span>}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all"
              style={{ width: busy === "uploading" ? `${progress}%` : "100%" }}
            />
          </div>
        </div>
      )}

      <Button className="mt-4" disabled={!file || uploading} onClick={submit}>
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {uploading ? "Working…" : "Upload and transcribe"}
      </Button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
