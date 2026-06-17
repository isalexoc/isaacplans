"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { SocialPostCopy, SocialLocale } from "@/lib/social-media-studio/types";

interface Props {
  postId: string;
  locale: SocialLocale;
  initialCopies: SocialPostCopy[];   // copies for this locale only
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", threads: "Threads",
  google_business: "Google Business", tiktok: "TikTok", youtube: "YouTube",
};
const PLATFORM_ICONS: Record<string, string> = {
  facebook: "🔵", instagram: "📷", threads: "🧵", google_business: "🔍", tiktok: "🎵", youtube: "▶️",
};

export function EditableCopies({ postId, locale, initialCopies }: Props) {
  const router = useRouter();
  const [copies, setCopies] = useState<SocialPostCopy[]>(initialCopies);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | undefined>();

  function updateCopy(idx: number, patch: Partial<SocialPostCopy>) {
    setCopies((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    setSaved(false);
  }

  async function saveAll() {
    setSaving(true);
    setError(undefined);
    try {
      const items = copies.map((c) => ({ ...c, characterCount: c.fullPost.length }));
      const res = await fetch(`/api/admin/social-media-studio/history/${postId}/update`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ copies: { locale, items } }),
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

  if (copies.length === 0) return null;

  return (
    <div className="space-y-4">
      {copies.map((copy, idx) => (
        <div key={`${copy.platform}_${copy.locale}`} className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
            <span>{PLATFORM_ICONS[copy.platform] ?? "📣"}</span>
            <span className="font-medium text-sm">{PLATFORM_LABELS[copy.platform] ?? copy.platform}</span>
            <span className="ml-auto text-xs text-muted-foreground">{copy.fullPost.length} chars</span>
          </div>
          <div className="p-4 space-y-2">
            <Textarea
              value={copy.fullPost}
              onChange={(e) => updateCopy(idx, { fullPost: e.target.value })}
              rows={6}
              className="text-sm"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Hashtags (comma or space separated, no #)</label>
              <Input
                value={(copy.hashtags ?? []).join(" ")}
                onChange={(e) =>
                  updateCopy(idx, {
                    hashtags: e.target.value.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean),
                  })
                }
                className="text-sm"
                placeholder="health aca savings"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button onClick={saveAll} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save copy changes</>}
        </Button>
        {saved && !saving && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
