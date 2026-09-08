"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_OPTIONS } from "@/lib/social-media-studio/types";

/**
 * Starts a Real Presenter ad.
 *
 * All this does is create the draft post the durable jobs key on, then hand off to the post's own
 * page — where the take is uploaded and everything else happens. Keeping creation this thin means
 * a presenter ad is an ordinary post from the first second, so history, copy generation and
 * publishing all work on it without knowing anything about the mode.
 */
export function NewPresenterAd() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("iul");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) {
      setError("Give it a name so you can find it again.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/social-media-studio/materialize-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { type: "presenter_video", title: title.trim(), category, locale: "en" },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Could not create the ad.");
      router.push(`/en/admin/social-media-studio/history/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the ad.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 rounded-lg border p-6">
      <div className="flex items-center gap-2">
        <Clapperboard className="h-5 w-5 text-blue-600" />
        <h1 className="text-lg font-semibold">New Real Presenter ad</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Record yourself saying what you want to say. The studio listens to it, writes a story that
        illustrates your message, and cuts that story around your own voice — captions, music and
        end card included. English or Spanish; it works out which from how you speak.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="presenter-title">Name it</Label>
        <Input
          id="presenter-title"
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && create()}
          placeholder="IUL — the conversation nobody has with their parents"
        />
      </div>

      <div className="space-y-1.5">
        <Label>What it&apos;s about</Label>
        <Select value={category} onValueChange={setCategory} disabled={busy}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={create} disabled={busy || !title.trim()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
        {busy ? "Creating…" : "Continue"}
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
