"use client";

import { useState, useTransition } from "react";
import { ExternalLink, ImageIcon, Loader2, RotateCcw, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveHeroImageAction } from "@/app/actions/get-covered-hero";
import type { HeroLocale, HeroSettingRow } from "@/lib/get-covered-fast/hero-setting";

/** Mirror of the server-side guard for instant client feedback. */
function isAllowedHeroUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\/isaacdev\/.+/i.test(url.trim());
}

const LIVE_PATH: Record<HeroLocale, string> = {
  es: "/es/gastos-finales/obtener-cobertura",
  en: "/en/final-expense/get-covered",
};

const LOCALE_LABEL: Record<HeroLocale, string> = {
  es: "Spanish page (es) — your ads page",
  en: "English page (en)",
};

type Status =
  | { type: "idle" }
  | { type: "ok"; msg: string }
  | { type: "error"; msg: string };

function HeroLocaleEditor({ row }: { row: HeroSettingRow }) {
  const [value, setValue] = useState(row.override ?? "");
  const [savedOverride, setSavedOverride] = useState(row.override);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [pending, startTransition] = useTransition();

  const trimmed = value.trim();
  const previewUrl = trimmed || row.defaultUrl;
  const usingDefault = !trimmed;
  const invalid = trimmed.length > 0 && !isAllowedHeroUrl(trimmed);

  const save = (nextValue: string) => {
    setStatus({ type: "idle" });
    startTransition(async () => {
      const res = await saveHeroImageAction(row.locale, nextValue);
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{LOCALE_LABEL[row.locale]}</CardTitle>
          <a
            href={LIVE_PATH[row.locale]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View live page <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <CardDescription>
          {savedOverride
            ? "A custom image is currently active."
            : "Currently showing the built-in default image."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live preview */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative aspect-[3/4] w-full max-w-[180px] shrink-0 overflow-hidden rounded-lg border bg-muted">
            {/* Plain img so any Cloudinary URL previews without next/image host limits. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Hero preview"
              className="h-full w-full object-cover object-center"
            />
            <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {usingDefault ? "Default" : "Custom"}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <label
              htmlFor={`hero-url-${row.locale}`}
              className="block text-sm font-medium"
            >
              Cloudinary image URL
            </label>
            <input
              id={`hero-url-${row.locale}`}
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
                Must be a Cloudinary URL on res.cloudinary.com/isaacdev/… (that is the
                only host the live page can display).
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Upload your image to Cloudinary, then paste its delivery URL here. Leave
              empty and save to go back to the default.
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
              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                {status.msg}
              </p>
            )}
            {status.type === "error" && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {status.msg}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GetCoveredHeroClient({
  settings,
}: {
  settings: HeroSettingRow[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <ImageIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Get Covered — Hero Image
          </h1>
          <p className="text-sm text-muted-foreground">
            Swap the hero image on the final-expense get-covered ads page to test which
            one converts best.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>Heads up:</strong> the hero image only shows on desktop (the large
        side panel). On phones the page shows the headline and form instead, so a hero
        swap mainly affects desktop visitors and the social/link preview stays the same.
      </div>

      <div className="space-y-4">
        {settings.map((row) => (
          <HeroLocaleEditor key={row.locale} row={row} />
        ))}
      </div>
    </div>
  );
}
