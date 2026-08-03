"use client";

import { useRef, useMemo, useState, useTransition } from "react";
import {
  ExternalLink,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveAdsImageAction } from "@/app/actions/ads-images";
import { compressImageFile, formatBytes } from "@/lib/image-compress";
import {
  ADS_LOBS,
  ADS_LOB_LABELS,
  ADS_LOB_LIVE_PATH,
  type AdsLob,
  type AdsImageKind,
  type AdsLocale,
  type AdsImageSettingRow,
} from "@/lib/ads-images/shared";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

const LOCALE_LABEL: Record<AdsLocale, string> = {
  en: "English",
  es: "Spanish",
};

const KIND_LABEL: Record<AdsImageKind, string> = {
  hero: "Hero image (desktop panel)",
  og: "OG / social share image",
};

const KIND_HINT: Record<AdsImageKind, string> = {
  hero: "Shown on the large desktop side panel. On phones the page shows the headline and form instead.",
  og: "Shown when the page link is shared on Facebook, iMessage, WhatsApp, etc. Standard size is 1200×630.",
};

type Status =
  | { type: "idle" }
  | { type: "ok"; msg: string }
  | { type: "error"; msg: string };

function AdsImageEditor({ row }: { row: AdsImageSettingRow }) {
  const [previewUrl, setPreviewUrl] = useState(row.override ?? row.defaultUrl);
  const [savedOverride, setSavedOverride] = useState(row.override);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const usingDefault = !savedOverride;
  const busy = uploading || pending;

  const uploadFile = async (file: File) => {
    setStatus({ type: "idle" });
    setUploading(true);
    try {
      const compressed = await compressImageFile(file);
      if (compressed.size > 4 * 1024 * 1024) {
        setStatus({
          type: "error",
          msg: `Image is still ${formatBytes(compressed.size)} after compression — try a smaller photo.`,
        });
        return;
      }

      const objectUrl = URL.createObjectURL(compressed);
      setPreviewUrl(objectUrl);

      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("lob", row.lob);
      formData.append("kind", row.kind);
      formData.append("locale", row.locale);

      const res = await fetch("/api/admin/ads-images/upload", {
        method: "POST",
        body: formData,
      });
      const data: { success: boolean; url?: string; error?: string } = await res.json();

      if (data.success && data.url) {
        setPreviewUrl(data.url);
        setSavedOverride(data.url);
        setStatus({ type: "ok", msg: "Uploaded. The live page now uses this image." });
      } else {
        setPreviewUrl(savedOverride ?? row.defaultUrl);
        setStatus({ type: "error", msg: data.error ?? "Upload failed." });
      }
      URL.revokeObjectURL(objectUrl);
    } catch {
      setPreviewUrl(savedOverride ?? row.defaultUrl);
      setStatus({ type: "error", msg: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  const resetToDefault = () => {
    setStatus({ type: "idle" });
    startTransition(async () => {
      const res = await saveAdsImageAction(row.lob, row.kind, row.locale, "");
      if (res.ok) {
        setPreviewUrl(row.defaultUrl);
        setSavedOverride(null);
        setStatus({ type: "ok", msg: "Cleared. The live page is back to the default image." });
      } else {
        setStatus({ type: "error", msg: res.error ?? "Could not save." });
      }
    });
  };

  const previewAspect = row.kind === "hero" ? "aspect-[3/4]" : "aspect-[1200/630]";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{LOCALE_LABEL[row.locale]}</CardTitle>
        <CardDescription>
          {savedOverride ? "A custom image is currently active." : "Currently showing the default image."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && !busy) void uploadFile(file);
          }}
          disabled={busy}
          className={`group relative ${previewAspect} w-full max-w-[220px] overflow-hidden rounded-lg border-2 bg-muted text-left transition-colors disabled:cursor-wait ${
            dragOver ? "border-primary" : "border-dashed border-muted-foreground/30 hover:border-primary/60"
          }`}
        >
          {/* Plain img — the preview can be a blob: URL mid-upload, or any Cloudinary URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview" className="h-full w-full object-cover object-center" />
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {usingDefault ? "Default" : "Custom"}
          </span>
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 ${
              dragOver || uploading ? "opacity-100" : ""
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs font-medium">Uploading…</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-6 w-6" />
                <span className="text-xs font-medium">Click or drag image to replace</span>
              </>
            )}
          </div>
        </button>

        <p className="text-xs text-muted-foreground">
          JPEG, PNG, or WebP. Large photos are compressed automatically before upload.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={resetToDefault}
            disabled={busy || !savedOverride}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-4 w-4" />
            )}
            Use default image
          </Button>
        </div>

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

function LobPanel({ rows }: { rows: AdsImageSettingRow[] }) {
  const byKind = useMemo(() => {
    const heroRows = rows.filter((r) => r.kind === "hero").sort((a, b) => a.locale.localeCompare(b.locale));
    const ogRows = rows.filter((r) => r.kind === "og").sort((a, b) => a.locale.localeCompare(b.locale));
    return { hero: heroRows, og: ogRows };
  }, [rows]);

  const lob = rows[0]?.lob;

  return (
    <div className="space-y-8">
      {(["hero", "og"] as AdsImageKind[]).map((kind) => (
        <section key={kind}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{KIND_LABEL[kind]}</h3>
              <p className="text-xs text-muted-foreground">{KIND_HINT[kind]}</p>
            </div>
            {lob && (
              <a
                href={ADS_LOB_LIVE_PATH[lob].en}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View live page <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {byKind[kind].map((row) => (
              <AdsImageEditor key={`${row.lob}-${row.kind}-${row.locale}`} row={row} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AdsImagesClient({ settings }: { settings: AdsImageSettingRow[] }) {
  const byLob = useMemo(() => {
    const map = new Map<AdsLob, AdsImageSettingRow[]>();
    for (const lob of ADS_LOBS) map.set(lob, []);
    for (const row of settings) map.get(row.lob)?.push(row);
    return map;
  }, [settings]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ImageIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ads Page Images</h1>
          <p className="text-sm text-muted-foreground">
            Swap the hero and social-share images on the Final Expense, IUL, and ACA get-covered
            ads pages to test what converts.
          </p>
        </div>
      </div>

      <Tabs defaultValue={ADS_LOBS[0]}>
        <TabsList>
          {ADS_LOBS.map((lob) => (
            <TabsTrigger key={lob} value={lob}>
              {ADS_LOB_LABELS[lob]}
            </TabsTrigger>
          ))}
        </TabsList>
        {ADS_LOBS.map((lob) => (
          <TabsContent key={lob} value={lob} className="mt-6">
            <LobPanel rows={byLob.get(lob) ?? []} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
