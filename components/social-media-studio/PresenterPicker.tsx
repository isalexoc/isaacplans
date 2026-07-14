"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Play, Pause, Check, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HeyGenAvatar, HeyGenVoice } from "@/lib/social-media-studio/heygen-presenter";
import type { SocialLocale } from "@/lib/social-media-studio/types";

export interface PresenterSelection {
  avatarId?: string;
  avatarName?: string;
  voiceId?: string;
  voiceName?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: SocialLocale;                 // defaults the voice-language filter
  current: PresenterSelection;
  onConfirm: (sel: PresenterSelection) => void;
}

type Gender = "" | "male" | "female";

// HeyGen stock avatars only expose gender + name, so "styles" are name-based shortcuts.
const AVATAR_STYLES = ["Business", "Casual", "Professional", "Doctor", "Nurse", "Suit", "Office", "Outdoor"];

export function PresenterPicker({ open, onOpenChange, locale, current, onConfirm }: Props) {
  const [avatars, setAvatars] = useState<HeyGenAvatar[]>([]);
  const [voices, setVoices]   = useState<HeyGenVoice[]>([]);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingV, setLoadingV] = useState(false);
  const [search, setSearch]   = useState("");
  const [aGender, setAGender] = useState<Gender>("");
  const [page, setPage]       = useState(0);
  const [total, setTotal]     = useState(0);
  const AVATAR_PAGE_SIZE = 40;
  const [vLang, setVLang]     = useState<string>(locale === "es" ? "Spanish" : "English");
  const [vGender, setVGender] = useState<Gender>("");
  const [vSearch, setVSearch] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  const [sel, setSel] = useState<PresenterSelection>(current);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset working selection + browsing state each time the modal opens.
  useEffect(() => { if (open) { setSel(current); setPage(0); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search / gender changes restart at page 0.
  function onSearchChange(v: string) { setSearch(v); setPage(0); }
  function onAvatarGender(g: Gender) { setAGender(g); setPage(0); }

  // Fetch one page of avatars (debounced). Only this page is held client-side.
  useEffect(() => {
    if (!open) return;
    setLoadingA(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ offset: String(page * AVATAR_PAGE_SIZE), limit: String(AVATAR_PAGE_SIZE) });
      if (search.trim()) qs.set("search", search.trim());
      if (aGender) qs.set("gender", aGender);
      fetch(`/api/admin/social-media-studio/heygen/avatars?${qs}`)
        .then((r) => r.json())
        .then((d) => { if (d.success) { setAvatars(d.data.avatars); setTotal(d.data.total); } })
        .finally(() => setLoadingA(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, search, aGender, page]);

  // Fetch voices on language/gender/search change (debounced for the search box).
  useEffect(() => {
    if (!open) return;
    setLoadingV(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (vLang) qs.set("language", vLang);
      if (vGender) qs.set("gender", vGender);
      if (vSearch.trim()) qs.set("search", vSearch.trim());
      fetch(`/api/admin/social-media-studio/heygen/voices?${qs}`)
        .then((r) => r.json())
        .then((d) => { if (d.success) { setVoices(d.data.voices); setLanguages(d.data.languages ?? []); } })
        .finally(() => setLoadingV(false));
    }, 300);
    return () => clearTimeout(t);
  }, [open, vLang, vGender, vSearch]);

  // Stop audio when modal closes.
  useEffect(() => {
    if (!open && audioRef.current) { audioRef.current.pause(); setPlayingId(null); }
  }, [open]);

  function togglePlay(voice: HeyGenVoice) {
    if (!voice.previewAudio) return;
    const el = audioRef.current;
    if (!el) return;
    if (playingId === voice.voiceId) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = voice.previewAudio;
    el.play().then(() => setPlayingId(voice.voiceId)).catch(() => setPlayingId(null));
  }

  const genderBtns = (value: Gender, set: (g: Gender) => void) => (
    <div className="flex gap-1">
      {([["", "All"], ["female", "Female"], ["male", "Male"]] as const).map(([g, label]) => (
        <button
          key={g}
          onClick={() => set(g as Gender)}
          className={cn(
            "px-2 py-1 text-xs border rounded-md transition-colors",
            value === g ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose presenter avatar & voice</DialogTitle>
        </DialogHeader>

        {/* Hidden audio element shared by all voice previews */}
        <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

        <Tabs defaultValue="avatar">
          <TabsList>
            <TabsTrigger value="avatar">Avatar {sel.avatarName ? `· ${sel.avatarName}` : ""}</TabsTrigger>
            <TabsTrigger value="voice">Voice {sel.voiceName ? `· ${sel.voiceName}` : ""}</TabsTrigger>
          </TabsList>

          {/* ── Avatars ── */}
          <TabsContent value="avatar" className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search avatars (e.g. Imelda, Georgia, business)…"
                  className="pl-8"
                />
              </div>
              {genderBtns(aGender, onAvatarGender)}
            </div>

            {/* Style quick-filters (name-based shortcuts) */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onSearchChange("")}
                className={cn(
                  "px-2 py-0.5 text-[11px] border rounded-full transition-colors",
                  !search ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
                )}
              >
                All
              </button>
              {AVATAR_STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => onSearchChange(s)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] border rounded-full transition-colors",
                    search.toLowerCase() === s.toLowerCase()
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <ScrollArea className="h-80">
              {loadingA ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 pr-3">
                  {avatars.map((a) => {
                    const selected = sel.avatarId === a.avatarId;
                    return (
                      <button
                        key={a.avatarId}
                        onClick={() => setSel((s) => ({ ...s, avatarId: a.avatarId, avatarName: a.name }))}
                        className={cn(
                          "relative block w-full rounded-md border overflow-hidden text-left group",
                          selected ? "ring-2 ring-blue-600 border-blue-600" : "hover:border-blue-400"
                        )}
                        title={a.name}
                      >
                        {/* Aspect ratio lives on this plain div — set on the <button> it sizes
                            unreliably in iPadOS/WebKit and crops the portrait to just the forehead. */}
                        <div className="relative aspect-[3/4] w-full bg-muted">
                          {a.previewImageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.previewImageUrl}
                              alt={a.name}
                              className="absolute inset-0 h-full w-full object-cover object-top"
                            />
                          )}
                        </div>
                        {selected && (
                          <span className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-1 py-0.5 truncate">
                          {a.name}
                        </span>
                      </button>
                    );
                  })}
                  {avatars.length === 0 && (
                    <p className="col-span-4 text-sm text-muted-foreground py-8 text-center">
                      No avatars — try a different search.
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Pagination — only one page (~40 thumbnails) is mounted at a time */}
            {(() => {
              const totalPages = Math.max(1, Math.ceil(total / AVATAR_PAGE_SIZE));
              const from = total === 0 ? 0 : page * AVATAR_PAGE_SIZE + 1;
              const to   = Math.min(total, (page + 1) * AVATAR_PAGE_SIZE);
              return (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {total === 0 ? "No matches" : `${from}–${to} of ${total}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" size="sm"
                      disabled={loadingA || page <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums">Page {page + 1} / {totalPages}</span>
                    <Button
                      variant="outline" size="sm"
                      disabled={loadingA || page + 1 >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          {/* ── Voices ── */}
          <TabsContent value="voice" className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={vLang}
                onChange={(e) => setVLang(e.target.value)}
                className="border rounded-md px-2 py-1.5 text-xs bg-background"
              >
                {(languages.length ? languages : [vLang]).map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {genderBtns(vGender, setVGender)}
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={vSearch}
                  onChange={(e) => setVSearch(e.target.value)}
                  placeholder="Search voices by name…"
                  className="pl-8"
                />
              </div>
            </div>

            <ScrollArea className="h-80">
              {loadingV ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col gap-1 pr-3">
                  {voices.map((v) => {
                    const selected = sel.voiceId === v.voiceId;
                    const playing  = playingId === v.voiceId;
                    return (
                      <div
                        key={v.voiceId}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2",
                          selected ? "ring-2 ring-blue-600 border-blue-600" : "border-border"
                        )}
                      >
                        <button
                          onClick={() => togglePlay(v)}
                          disabled={!v.previewAudio}
                          className="shrink-0 text-blue-600 disabled:opacity-30"
                          title={v.previewAudio ? "Preview voice" : "No preview"}
                        >
                          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => setSel((s) => ({ ...s, voiceId: v.voiceId, voiceName: v.name }))}
                          className="flex-1 text-left min-w-0"
                        >
                          <span className="text-sm font-medium">{v.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{v.gender}</span>
                        </button>
                        {selected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                      </div>
                    );
                  })}
                  {voices.length === 0 && (
                    <p className="text-sm text-muted-foreground py-8 text-center">No voices for this filter.</p>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <button
            onClick={() => setSel({})}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset to default
          </button>
          <Button onClick={() => { onConfirm(sel); onOpenChange(false); }}>
            Use selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
