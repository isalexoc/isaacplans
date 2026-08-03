"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, Image as ImageIcon, Loader2, RotateCcw, Save } from "lucide-react";
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
import {
  ADS_LOBS,
  ADS_LOB_LABELS,
  ADS_LOB_LIVE_PATH,
  type AdsLob,
  type AdsImageKind,
  type AdsLocale,
  type AdsImageSettingRow,
} from "@/lib/ads-images/shared";

/** Mirror of the server-side guard for instant client feedback. */
function isAllowedAdsImageUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\/isaacdev\/.+/i.test(url.trim());
}

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
  const [value, setValue] = useState(row.override ?? "");
  const [savedOverride, setSavedOverride] = useState(row.override);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [pending, startTransition] = useTransition();

  const trimmed = value.trim();
  const previewUrl = trimmed || row.defaultUrl;
  const usingDefault = !trimmed;
  const invalid = trimmed.length > 0 && !isAllowedAdsImageUrl(trimmed);

  const save = (nextValue: string) => {
    setStatus({ type: "idle" });
    startTransition(async () => {
      const res = await saveAdsImageAction(row.lob, row.kind, row.locale, nextValue);
      if (res.ok) {
        setSavedOverride(nextValue.trim() || null);
        setStatus({
          type: "ok",
          msg: nextValue.trim()
            ? "Saved. The live page now uses this image."
            : "Cleared. The live page is back to the default image.",
        });
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
        <div className="flex flex-col gap-3 sm:flex-row">
          <div
            className={`relative ${previewAspect} w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg border bg-muted`}
          >
            {/* Plain img so any Cloudinary URL previews without next/image host limits. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover object-center" />
            <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {usingDefault ? "Default" : "Custom"}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor={`ads-img-${row.lob}-${row.kind}-${row.locale}`} className="block text-sm font-medium">
              Cloudinary image URL
            </label>
            <input
              id={`ads-img-${row.lob}-${row.kind}-${row.locale}`}
              type="url"
              inputMode="url"
              placeholder="https://res.cloudinary.com/isaacdev/image/upload/..."
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setStatus({ type: "idle" });
              }}
              disabled={pending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            {invalid && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Must be a Cloudinary URL on res.cloudinary.com/isaacdev/… (that is the only host
                the live page can display).
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Upload your image to Cloudinary, then paste its delivery URL here. Leave empty and
              save to go back to the default.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={() => save(value)}
                disabled={pending || invalid || trimmed === (savedOverride ?? "")}
              >
                {pending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setValue("");
                  save("");
                }}
                disabled={pending || (!trimmed && !savedOverride)}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Use default image
              </Button>
            </div>

            {status.type === "ok" && (
              <p className="text-xs font-medium text-green-600 dark:text-green-400">{status.msg}</p>
            )}
            {status.type === "error" && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{status.msg}</p>
            )}
          </div>
        </div>
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
