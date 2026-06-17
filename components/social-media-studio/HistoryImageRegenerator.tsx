"use client";

import { useState, useCallback } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  postId: string;
  /** Pre-filled from the saved imageHeadline */
  initialHeadline: string;
  initialSquareUrl: string;
  initialVerticalUrl: string;
  /** Passed to DALL-E prompt for category scene + demographic hints */
  sourceTitle?: string;
  sourceCategory?: string;
  sourceLocale?: string;
  /** The original (non-branded) source image URL for "use source image" mode */
  sourceImageUrl?: string;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function HistoryImageRegenerator({
  postId,
  initialHeadline,
  initialSquareUrl,
  initialVerticalUrl,
  sourceTitle,
  sourceCategory,
  sourceLocale,
  sourceImageUrl,
}: Props) {
  const [headline, setHeadline]         = useState(initialHeadline);
  const [generateNew, setGenerateNew]   = useState(false);
  const [squareUrl, setSquareUrl]       = useState(initialSquareUrl);
  const [verticalUrl, setVerticalUrl]   = useState(initialVerticalUrl);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | undefined>();
  const [savedAt, setSavedAt]           = useState<string | undefined>();

  const triggerRegeneration = useCallback(async (h: string, newBg: boolean) => {
    setIsLoading(true);
    setError(undefined);
    setSavedAt(undefined);
    try {
      const result = await postJson(
        `/api/admin/social-media-studio/history/${postId}/update-images`,
        {
          headline:       h,
          sourceImageUrl: sourceImageUrl,
          generateNew:    newBg,
          category:       sourceCategory,
          sourceTitle:    sourceTitle,
          locale:         sourceLocale,
        }
      );
      if (!result.success) throw new Error(result.error ?? "Generation failed");
      setSquareUrl(result.data.squareImageUrl);
      setVerticalUrl(result.data.verticalImageUrl);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setIsLoading(false);
    }
  }, [postId, sourceImageUrl, sourceCategory, sourceTitle, sourceLocale]);

  return (
    <div className="space-y-5">
      {/* Headline input */}
      <div className="flex flex-col gap-1.5">
        <Label>Image headline (text overlay)</Label>
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="max-w-lg"
          disabled={isLoading}
        />
      </div>

      {/* Source toggle */}
      <div className="flex gap-3 flex-wrap">
        {([
          { value: false, label: "Use source image" },
          { value: true,  label: "Generate new AI image" },
        ] as const).map(({ value, label }) => (
          <button
            key={String(value)}
            disabled={isLoading}
            onClick={() => setGenerateNew(value)}
            className={cn(
              "px-3 py-2 text-sm border rounded-md transition-colors disabled:opacity-50",
              generateNew === value
                ? "bg-blue-600 text-white border-blue-600"
                : "border-border hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Generate button */}
      <Button
        onClick={() => triggerRegeneration(headline, generateNew)}
        disabled={isLoading || !headline.trim()}
        className="w-fit"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating… (20–60 s)
          </>
        ) : (
          <>
            <RotateCcw className="h-4 w-4 mr-2" />
            Generate with AI
          </>
        )}
      </Button>

      {/* Error */}
      {error && !isLoading && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => { setError(undefined); triggerRegeneration(headline, generateNew); }}
            className="shrink-0 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Saved confirmation */}
      {savedAt && !isLoading && (
        <p className="text-xs text-green-600 dark:text-green-400">
          ✓ Images updated and saved at {savedAt}
        </p>
      )}

      {/* Image previews */}
      {isLoading ? (
        <div className="flex items-center gap-3 py-8 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          Generating your branded creatives…
        </div>
      ) : (
        <div className="flex gap-6 flex-wrap items-start">
          {squareUrl && (
            <div className="space-y-1.5">
              <img
                src={squareUrl}
                alt="Square 1:1"
                className="w-52 h-52 rounded-lg object-cover border border-border"
              />
              <p className="text-xs text-muted-foreground text-center">Square (1:1)</p>
              <a
                href={squareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline text-center"
              >
                Download
              </a>
            </div>
          )}
          {verticalUrl && (
            <div className="space-y-1.5">
              <img
                src={verticalUrl}
                alt="Vertical 9:16"
                className="w-32 h-56 rounded-lg object-cover border border-border"
              />
              <p className="text-xs text-muted-foreground text-center">Vertical (9:16)</p>
              <a
                href={verticalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline text-center"
              >
                Download
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
