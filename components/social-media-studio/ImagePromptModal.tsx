"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw, Shuffle, Sparkles, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ImagePromptPart, ImagePromptPreview } from "@/lib/social-media-studio/types";

interface PreviewParams {
  headline: string;
  category?: string;
  sourceTitle?: string;
  locale?: string;
  /** Post content (from the saved generated copy) that feeds the AI image concept */
  subtitle?: string;
  bodyText?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Inputs used to build the preview prompt — the same inputs the generate call sends. */
  previewParams: PreviewParams;
  /** A previously tuned prompt; when present the modal opens in Raw mode seeded with it. */
  initialPrompt?: string;
  isGenerating: boolean;
  /** Called with the final (possibly tuned) prompt when the user confirms. */
  onGenerate: (finalPrompt: string) => void;
}

type Mode = "sections" | "raw";

function joinParts(parts: ImagePromptPart[]): string {
  return parts.map((p) => p.text).join(" ");
}

export function ImagePromptModal({
  open,
  onOpenChange,
  previewParams,
  initialPrompt,
  isGenerating,
  onGenerate,
}: Props) {
  const [mode, setMode]               = useState<Mode>("sections");
  const [parts, setParts]             = useState<ImagePromptPart[]>([]);
  const [availableMoods, setMoods]    = useState<string[]>([]);
  const [currentMood, setCurrentMood] = useState<string>("");
  const [conceptFromAI, setConceptAI] = useState<boolean>(false);
  const [rawPrompt, setRawPrompt]     = useState<string>("");
  const [loading, setLoading]         = useState(false);
  const [regenerating, setRegen]      = useState(false);
  const [error, setError]             = useState<string | undefined>();

  const fetchPreview = useCallback(async (): Promise<ImagePromptPreview> => {
    const res = await fetch("/api/admin/social-media-studio/preview-image-prompt", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(previewParams),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error((json as { error?: string }).error ?? `Request failed: ${res.status}`);
    }
    return (json as { data: ImagePromptPreview }).data;
  }, [previewParams]);

  // Load the full preview (concept + all parts) into the sections editor.
  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const data = await fetchPreview();
      setParts(data.parts);
      setMoods(data.availableMoods);
      setCurrentMood(data.mood);
      setConceptAI(data.conceptFromAI);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build prompt preview");
    } finally {
      setLoading(false);
    }
  }, [fetchPreview]);

  // When the modal opens: seed from a saved prompt (Raw mode) or fetch a fresh preview.
  useEffect(() => {
    if (!open) return;
    setError(undefined);
    if (initialPrompt?.trim()) {
      setMode("raw");
      setRawPrompt(initialPrompt);
      setParts([]);
    } else {
      setMode("sections");
      setRawPrompt("");
      void loadPreview();
    }
    // Only re-run when the modal transitions to open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setPartText = (key: string, text: string) => {
    setParts((prev) => prev.map((p) => (p.key === key ? { ...p, text } : p)));
  };

  const applyMood = (mood: string) => {
    setCurrentMood(mood);
    setPartText("lighting", `Lighting: ${mood}.`);
  };

  const shuffleMood = () => {
    if (availableMoods.length === 0) return;
    const next = availableMoods[Math.floor(Math.random() * availableMoods.length)];
    applyMood(next);
  };

  // Re-roll only the AI scene; preserve every other edited part.
  const regenerateConcept = async () => {
    setRegen(true);
    setError(undefined);
    try {
      const data = await fetchPreview();
      const freshScene = data.parts.find((p) => p.key === "scene");
      if (freshScene) setPartText("scene", freshScene.text);
      setConceptAI(data.conceptFromAI);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate concept");
    } finally {
      setRegen(false);
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "raw") {
      // Carry the assembled sections into the raw editor.
      setRawPrompt(joinParts(parts));
    } else if (parts.length === 0) {
      // Coming from a saved-prompt Raw session with no parts loaded yet.
      void loadPreview();
    }
    setMode(next);
  };

  const finalPrompt = mode === "raw" ? rawPrompt : joinParts(parts);
  const canGenerate = finalPrompt.trim().length > 0 && !loading && !isGenerating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-blue-600" />
            Image prompt control panel
          </DialogTitle>
          <DialogDescription>
            This is the exact prompt that will be sent to the image model. Tune any section — or
            switch to the raw prompt to rewrite it freely — then generate.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {([
            { value: "sections" as Mode, label: "Sections" },
            { value: "raw" as Mode,      label: "Raw prompt" },
          ]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => switchMode(value)}
              className={cn(
                "px-3 py-1.5 text-sm border rounded-md transition-colors",
                mode === value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-border hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <button onClick={() => loadPreview()} className="shrink-0 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-12 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Building the prompt…
          </div>
        ) : mode === "sections" ? (
          <div className="space-y-4">
            {parts.map((part) => (
              <div key={part.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {part.label}
                  </Label>

                  {/* Scene gets an AI re-roll + concept-source badge */}
                  {part.key === "scene" && (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
                          conceptFromAI
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Sparkles className="h-3 w-3" />
                        {conceptFromAI ? "AI concept" : "Category fallback"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={regenerating}
                        onClick={regenerateConcept}
                      >
                        {regenerating ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3 mr-1" />
                        )}
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>

                {/* Lighting gets a mood picker + shuffle */}
                {part.key === "lighting" && availableMoods.length > 0 && (
                  <div className="flex gap-2">
                    <Select value={currentMood} onValueChange={applyMood}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Pick a lighting mood" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMoods.map((m) => (
                          <SelectItem key={m} value={m} className="text-sm">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={shuffleMood}
                    >
                      <Shuffle className="h-3.5 w-3.5 mr-1" />
                      Shuffle
                    </Button>
                  </div>
                )}

                <Textarea
                  value={part.text}
                  onChange={(e) => setPartText(part.key, e.target.value)}
                  rows={part.key === "scene" ? 3 : 2}
                  className="text-sm"
                />
              </div>
            ))}

            {/* Live assembled preview */}
            {parts.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Final prompt (sent to model)
                </Label>
                <p className="text-xs leading-relaxed text-muted-foreground bg-muted/50 rounded-md p-3 whitespace-pre-wrap">
                  {finalPrompt}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Full prompt (editable)
            </Label>
            <Textarea
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              rows={14}
              className="text-sm font-mono"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={() => onGenerate(finalPrompt.trim())} disabled={!canGenerate}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate images
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
