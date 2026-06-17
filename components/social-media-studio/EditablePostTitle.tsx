"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  postId: string;
  initialTitle: string;
}

export function EditablePostTitle({ postId, initialTitle }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(initialTitle);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | undefined>();

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/admin/social-media-studio/history/${postId}/update`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sourceTitle: value.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 group">
        {initialTitle || "Untitled"}
        <button
          onClick={() => { setValue(initialTitle); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition"
          title="Edit title"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </h1>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} className="text-lg font-semibold max-w-xl" autoFocus />
        <button onClick={save} disabled={saving || !value.trim()} className="text-green-600 hover:text-green-700 disabled:opacity-50" title="Save">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        </button>
        <button onClick={() => setEditing(false)} disabled={saving} className="text-muted-foreground hover:text-foreground" title="Cancel">
          <X className="h-5 w-5" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
