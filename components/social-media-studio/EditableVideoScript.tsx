"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Full Script</Label>
        <Textarea value={full} onChange={(e) => { setFull(e.target.value); dirty(); }} rows={10} className="text-sm font-mono" />
        <p className="text-xs text-muted-foreground">The video narration is built from this script — edits here change the next generated video.</p>
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
