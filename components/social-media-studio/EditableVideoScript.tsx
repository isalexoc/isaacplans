"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { planNarration } from "@/lib/social-media-studio/script-narration";

interface Props {
  postId: string;
  initial: {
    duration?: number;
    hookScript?: string;
    fullScript?: string;
    suggestedCaption?: string;
  };
}

export function EditableVideoScript({ postId, initial }: Props) {
  const router = useRouter();
  const [duration, setDuration] = useState<30 | 60>(initial.duration === 60 ? 60 : 30);
  const [hook, setHook]         = useState(initial.hookScript ?? "");
  const [full, setFull]         = useState(initial.fullScript ?? "");
  const [caption, setCaption]   = useState(initial.suggestedCaption ?? "");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | undefined>();

  function dirty() { setSaved(false); }

  // The Full Script is the ONLY source of truth for the video: it is spoken word for word,
  // and the video ends when it ends. Show that length live so the script can be tuned to hit
  // a target duration — the render follows the script, not the 30s/60s button.
  const narration = useMemo(() => planNarration(full), [full]);
  const spokenLabel = narration.estimatedSeconds < 60
    ? `${Math.round(narration.estimatedSeconds)}s`
    : `${Math.floor(narration.estimatedSeconds / 60)}m ${Math.round(narration.estimatedSeconds % 60)}s`;
  const offTarget = narration.wordCount > 0 && Math.abs(narration.estimatedSeconds - duration) > duration * 0.25;

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/admin/social-media-studio/history/${postId}/update`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          videoScript: { duration, hookScript: hook, fullScript: full, suggestedCaption: caption },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Duration</Label>
        <div className="flex gap-2">
          {([30, 60] as const).map((d) => (
            <button
              key={d}
              onClick={() => { setDuration(d); dirty(); }}
              className={cn(
                "px-3 py-1 text-xs border rounded-md transition-colors",
                duration === d ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
              )}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hook</Label>
        <Textarea value={hook} onChange={(e) => { setHook(e.target.value); dirty(); }} rows={2} className="text-sm" />
        <p className="text-xs text-muted-foreground">
          Reference only — the hook lines are already part of the Full Script below, so this field is
          never spoken separately in the video.
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Full Script</Label>
          {narration.wordCount > 0 && (
            <span className={cn(
              "flex items-center gap-1 text-xs",
              offTarget ? "text-amber-600" : "text-muted-foreground"
            )}>
              <Clock className="h-3 w-3" />
              {narration.wordCount} spoken words · ≈ {spokenLabel} video
            </span>
          )}
        </div>
        <Textarea value={full} onChange={(e) => { setFull(e.target.value); dirty(); }} rows={10} className="text-sm font-mono" />
        <p className="text-xs text-muted-foreground">
          <strong>This script is the video.</strong> It is spoken word for word — nothing is added,
          removed or rewritten — and the video ends when the script ends. Timestamps like{" "}
          <code className="text-[10px]">[0:00–0:03]</code>, beat labels like{" "}
          <code className="text-[10px]">HOOK:</code>, bracketed directions and hashtags are stripped
          before recording; everything else is read aloud exactly as typed.
        </p>
        {offTarget && (
          <p className="text-xs text-amber-600">
            This script runs ≈ {spokenLabel}, not {duration}s. The video will be ≈ {spokenLabel} —
            the duration button only sets the target; the script decides the real length.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Suggested Caption</Label>
        <Textarea value={caption} onChange={(e) => { setCaption(e.target.value); dirty(); }} rows={2} className="text-sm" />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save script changes</>}
        </Button>
        {saved && !saving && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
