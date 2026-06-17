"use client";

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  SocialPostSource,
  SocialPostCopy,
  SocialCreativeImages,
  VideoScript,
  PublishedSocialPost,
  SocialPlatform,
  SocialLocale,
  BlogPostSummary,
  LeadMagnetSummary,
} from "@/lib/social-media-studio/types";
import {
  PLATFORM_LABELS,
  PLATFORM_COPY_LIMITS,
  ALL_PLATFORMS,
} from "@/lib/social-media-studio/types";
import { PublishToSocialSection } from "@/components/social-publishing/PublishToSocialSection";

// ─── Types ────────────────────────────────────────────────────────────────────

type StudioStep = "source" | "copy" | "images" | "script" | "export";

interface StudioState {
  step: StudioStep;
  source?: SocialPostSource;
  copies?: SocialPostCopy[];
  isGeneratingCopy?: boolean;
  copyError?: string;
  images?: SocialCreativeImages;
  isGeneratingImages?: boolean;
  imageError?: string;
  videoScript?: VideoScript;
  scriptDuration?: 30 | 60;
  isGeneratingScript?: boolean;
  scriptError?: string;
  savedResult?: PublishedSocialPost;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "aca",                       label: "ACA / Health Plans" },
  { value: "temporary-health-insurance", label: "Short-Term Health Plans" },
  { value: "dental-vision",             label: "Dental & Vision Plans" },
  { value: "hospital-indemnity",        label: "Hospital Benefits" },
  { value: "iul",                       label: "IUL / Wealth Building" },
  { value: "final-expense",             label: "Final Expense Plans" },
  { value: "cancer-plans",              label: "Cancer Protection Plans" },
  { value: "heart-stroke",              label: "Heart & Stroke Plans" },
  { value: "general",                   label: "Financial Protection" },
  { value: "tips-guides",               label: "Planning Tips & Guides" },
] as const;

const STEPS: { key: StudioStep; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "copy",   label: "Copy" },
  { key: "images", label: "Images" },
  { key: "script", label: "Script" },
  { key: "export", label: "Export" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Request failed");
  return data;
}

function assembleCopy(
  hook: string,
  body: string,
  cta: string,
  hashtags: string[],
  platform: SocialPlatform
): string {
  const noHashtagPlatforms: SocialPlatform[] = ["threads", "google_business"];
  const parts = [hook, body, cta].filter(Boolean);
  let post = parts.join("\n\n");
  if (!noHashtagPlatforms.includes(platform) && hashtags.length > 0) {
    post += "\n\n" + hashtags.map((h) => `#${h}`).join(" ");
  }
  return post;
}

function shortenTitleOptions(title: string): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length <= 5) return [];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const len of [5, 6, 7]) {
    if (words.length > len) {
      const opt = words.slice(0, len).join(" ");
      if (!seen.has(opt)) { seen.add(opt); options.push(opt); }
    }
  }
  return options;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 flex items-start justify-between gap-3">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="shrink-0 text-red-700 border-red-300 hover:bg-red-100"
        >
          Retry
        </Button>
      )}
    </div>
  );
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="text-xs shrink-0 gap-1">
      {copied ? (
        <><Check className="h-3 w-3 text-green-600" />Copied!</>
      ) : (
        <><Copy className="h-3 w-3" />{label}</>
      )}
    </Button>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: StudioStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-1 flex-wrap mb-2">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-1">
          <div
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              i < currentIndex  && "text-green-600",
              i === currentIndex && "text-blue-600",
              i > currentIndex  && "text-gray-400"
            )}
          >
            <span
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border",
                i < currentIndex  && "bg-green-100 border-green-500 text-green-700",
                i === currentIndex && "bg-blue-100 border-blue-500 text-blue-700",
                i > currentIndex  && "bg-gray-100 border-gray-300 text-gray-500"
              )}
            >
              {i < currentIndex ? "✓" : i + 1}
            </span>
            {step.label}
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "w-6 h-px mx-1",
                i < currentIndex ? "bg-green-400" : "bg-gray-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Source Picker ────────────────────────────────────────────────────

type SourceTab = "blog_post" | "lead_magnet" | "direct_topic";

function SourcePickerStep({
  state,
  setState,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
}) {
  const [tab, setTab] = useState<SourceTab>("blog_post");
  const [query, setQuery] = useState("");
  const [blogResults, setBlogResults] = useState<BlogPostSummary[]>([]);
  const [magnetResults, setMagnetResults] = useState<LeadMagnetSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Direct topic form
  const [topicTitle, setTopicTitle] = useState("");
  const [topicCategory, setTopicCategory] = useState("general");
  const [topicLocale, setTopicLocale] = useState<SocialLocale>("en");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicCtaUrl, setTopicCtaUrl] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearResults() {
    setBlogResults([]);
    setMagnetResults([]);
  }

  useEffect(() => {
    if (tab === "direct_topic") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { clearResults(); return; }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/admin/social-media-studio/sources?q=${encodeURIComponent(query)}&limit=20`
        );
        const data = await res.json();
        if (data.success) {
          setBlogResults(data.data.blogPosts ?? []);
          setMagnetResults(data.data.leadMagnets ?? []);
        }
      } catch {
        // non-fatal
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab]);

  function triggerCopyGeneration(source: SocialPostSource) {
    setState((prev) => ({
      ...prev,
      source,
      step: "copy",
      isGeneratingCopy: true,
      copies: undefined,
      copyError: undefined,
    }));
    postJson("/api/admin/social-media-studio/generate-copy", { source })
      .then((result) => {
        setState((prev) => ({ ...prev, copies: result.data.copies, isGeneratingCopy: false }));
      })
      .catch((err) => {
        setState((prev) => ({
          ...prev,
          copyError: err instanceof Error ? err.message : "Copy generation failed",
          isGeneratingCopy: false,
        }));
      });
  }

  async function selectSource(type: "blog_post" | "lead_magnet", id: string) {
    setLoadError(null);
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/social-media-studio/sources/${type}/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load content");
      triggerCopyGeneration(data.data as SocialPostSource);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoadingId(null);
    }
  }

  async function submitDirectTopic() {
    if (!topicTitle.trim()) { setTopicError("Title is required."); return; }
    setTopicError(null);
    setIsSubmitting(true);
    const source: SocialPostSource = {
      type: "direct_topic",
      title: topicTitle.trim(),
      subtitle: topicDescription.trim() || undefined,
      category: topicCategory,
      locale: topicLocale,
      publicUrl: topicCtaUrl.trim() || undefined,
    };
    triggerCopyGeneration(source);
    setIsSubmitting(false);
  }

  const results = tab === "blog_post" ? blogResults : magnetResults;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Choose Your Content Source</h2>
        <p className="text-sm text-muted-foreground">
          Pick a blog post or lead magnet to repurpose, or enter a topic directly.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 flex-wrap">
        {(["blog_post", "lead_magnet", "direct_topic"] as SourceTab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); clearResults(); setQuery(""); }}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm border transition-colors",
              tab === t ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
            )}
          >
            {t === "blog_post" ? "Blog Post" : t === "lead_magnet" ? "Lead Magnet" : "Direct Topic"}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab !== "direct_topic" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 items-center">
            <Input
              placeholder={tab === "blog_post" ? "Search blog posts..." : "Search lead magnets..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            {isSearching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />}
          </div>

          {loadError && <ErrorBox message={loadError} onRetry={() => setLoadError(null)} />}

          <div className="flex flex-col gap-2">
            {isSearching && results.length === 0 && (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
              ))
            )}
            {!isSearching && query.trim() && results.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No results found.</p>
            )}
            {results.map((item) => {
              const imgUrl = tab === "blog_post"
                ? (item as BlogPostSummary).featuredImageUrl
                : (item as LeadMagnetSummary).coverImageUrl;
              const subtitle = tab === "blog_post"
                ? (item as BlogPostSummary).excerpt
                : (item as LeadMagnetSummary).subtitle;
              const isLoading = loadingId === item._id;
              return (
                <div
                  key={item._id}
                  className="flex items-center gap-3 border rounded-md p-3 hover:bg-muted/40 transition-colors"
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={item.title}
                      className="w-16 h-16 object-cover rounded-md shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-md shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {subtitle && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
                    )}
                    <div className="flex gap-1 flex-wrap mt-1">
                      {item.category && (
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      )}
                      {(item as BlogPostSummary | LeadMagnetSummary).locale && (
                        <Badge variant="outline" className="text-xs uppercase">
                          {(item as BlogPostSummary | LeadMagnetSummary).locale}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectSource(tab as "blog_post" | "lead_magnet", item._id)}
                    disabled={!!loadingId}
                    className="shrink-0"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Select →"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct Topic form */}
      {tab === "direct_topic" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topicTitle">Topic / Title *</Label>
            <Input
              id="topicTitle"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="e.g. Why ACA plans are better than you think in 2025"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={topicCategory} onValueChange={setTopicCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topicDescription">Brief description</Label>
            <Textarea
              id="topicDescription"
              rows={3}
              value={topicDescription}
              onChange={(e) => setTopicDescription(e.target.value)}
              placeholder="Key points, angle, or context for the AI..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topicCtaUrl">CTA link (optional)</Label>
            <Input
              id="topicCtaUrl"
              value={topicCtaUrl}
              onChange={(e) => setTopicCtaUrl(e.target.value)}
              placeholder="https://isaacplans.com/..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Post language</Label>
            <div className="flex gap-2">
              {(["en", "es"] as SocialLocale[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setTopicLocale(l)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-sm font-medium border transition-colors",
                    topicLocale === l ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
                  )}
                >
                  {l === "en" ? "English" : "Spanish"}
                </button>
              ))}
            </div>
          </div>
          {topicError && <ErrorBox message={topicError} />}
          <Button onClick={submitDirectTopic} disabled={isSubmitting} size="lg">
            {isSubmitting
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Starting...</>
              : "Generate Post Package →"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Copy Review ──────────────────────────────────────────────────────

function CopyReviewStep({
  state,
  setState,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
}) {
  const [platform, setPlatform] = useState<SocialPlatform>("facebook");
  const [locale] = useState<SocialLocale>(state.source?.locale ?? "en");
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  const copies = state.copies ?? [];
  const currentCopy = copies.find((c) => c.platform === platform && c.locale === locale);
  const limits = PLATFORM_COPY_LIMITS[platform];
  const charCount = currentCopy?.fullPost.length ?? 0;
  const isOverLimit = charCount > limits.max;

  function updateCopy(updates: Partial<SocialPostCopy>) {
    setState((prev) => ({
      ...prev,
      copies: (prev.copies ?? []).map((c) => {
        if (c.platform !== platform || c.locale !== locale) return c;
        const merged = { ...c, ...updates };
        merged.fullPost = assembleCopy(merged.hook, merged.body, merged.cta, merged.hashtags, platform);
        merged.characterCount = merged.fullPost.length;
        return merged;
      }),
    }));
  }

  function removeHashtag(tag: string) {
    if (!currentCopy) return;
    updateCopy({ hashtags: currentCopy.hashtags.filter((h) => h !== tag) });
  }

  function addHashtag() {
    if (!currentCopy || !newTag.trim()) return;
    updateCopy({ hashtags: [...currentCopy.hashtags, newTag.trim().replace(/^#/, "")] });
    setNewTag("");
    setShowTagInput(false);
  }

  async function regenerateCopy() {
    if (!state.source) return;
    if (!confirm("Regenerate will overwrite your edits. Continue?")) return;
    setState((prev) => ({ ...prev, isGeneratingCopy: true, copyError: undefined }));
    try {
      const result = await postJson("/api/admin/social-media-studio/generate-copy", { source: state.source });
      setState((prev) => ({ ...prev, copies: result.data.copies, isGeneratingCopy: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        copyError: err instanceof Error ? err.message : "Regeneration failed",
        isGeneratingCopy: false,
      }));
    }
  }

  if (state.isGeneratingCopy) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-1">Generating Copy</h2>
          <p className="text-sm text-muted-foreground">"{state.source?.title}"</p>
        </div>
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Generating social media copy for all 6 platforms in {(state.source?.locale ?? "en").toUpperCase()}...</p>
          <p className="text-xs">This takes about 15–30 seconds.</p>
        </div>
      </div>
    );
  }

  if (state.copyError) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Copy Generation</h2>
        <ErrorBox
          message={state.copyError}
          onRetry={() => {
            setState((prev) => ({ ...prev, copyError: undefined, isGeneratingCopy: true }));
            postJson("/api/admin/social-media-studio/generate-copy", { source: state.source })
              .then((r) => setState((prev) => ({ ...prev, copies: r.data.copies, isGeneratingCopy: false })))
              .catch((e) => setState((prev) => ({ ...prev, copyError: e.message, isGeneratingCopy: false })));
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold mb-1">Review Copy</h2>
          <p className="text-sm text-muted-foreground">Source: "{state.source?.title}"</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setState((prev) => ({ ...prev, step: "source" }))}>
            ← Change source
          </Button>
          <Button variant="ghost" size="sm" onClick={regenerateCopy}>
            <RotateCcw className="h-3 w-3 mr-1" /> Regenerate All
          </Button>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-0 flex-wrap border-b">
        {ALL_PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              platform === p
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      {currentCopy ? (
        <div className="flex flex-col gap-5">
          {/* Hook */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">Hook</Label>
              <CopyBtn text={currentCopy.hook} />
            </div>
            <Textarea rows={3} value={currentCopy.hook} onChange={(e) => updateCopy({ hook: e.target.value })} />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">Body</Label>
              <CopyBtn text={currentCopy.body} />
            </div>
            <Textarea rows={4} value={currentCopy.body} onChange={(e) => updateCopy({ body: e.target.value })} />
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">Call to Action</Label>
              <CopyBtn text={currentCopy.cta} />
            </div>
            <Textarea rows={2} value={currentCopy.cta} onChange={(e) => updateCopy({ cta: e.target.value })} />
          </div>

          {/* Hashtags */}
          {platform !== "threads" && platform !== "google_business" && (
            <div className="flex flex-col gap-2">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">Hashtags</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {currentCopy.hashtags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-xs">
                    #{tag}
                    <button onClick={() => removeHashtag(tag)} className="text-muted-foreground hover:text-red-600 leading-none">×</button>
                  </span>
                ))}
                {showTagInput ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="tag"
                      className="h-7 w-24 text-xs"
                      onKeyDown={(e) => { if (e.key === "Enter") addHashtag(); }}
                      autoFocus
                    />
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={addHashtag}>Add</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowTagInput(true)}
                    className="px-2 py-1 text-xs border border-dashed rounded-full text-muted-foreground hover:text-foreground hover:border-foreground"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Full post preview */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">Full Post Preview</Label>
              <CopyBtn text={currentCopy.fullPost} label="Copy Full Post" />
            </div>
            <div className="rounded-md border bg-muted/20 p-3 whitespace-pre-wrap text-sm min-h-24">
              {currentCopy.fullPost}
            </div>
            <p className={cn("text-xs text-right", isOverLimit ? "text-red-600 font-medium" : "text-muted-foreground")}>
              {charCount} / {limits.max} chars
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No copy available for this combination.</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, step: "source" }))}>
          ← Back
        </Button>
        <Button
          onClick={() => setState((prev) => ({ ...prev, step: "images" }))}
          disabled={copies.length === 0}
          className="flex-1"
          size="lg"
        >
          Continue to Images →
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Image Studio ─────────────────────────────────────────────────────

function ImageStudioStep({
  state,
  setState,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
}) {
  const [headline, setHeadline] = useState(state.source?.title ?? "");
  const [generateNew, setGenerateNew] = useState(false);
  const [shortenOptions, setShortenOptions] = useState<string[]>([]);
  const [shortenAttempted, setShortenAttempted] = useState(false);

  async function triggerImageGeneration(h: string, newBg: boolean) {
    setState((prev) => ({ ...prev, isGeneratingImages: true, imageError: undefined }));
    try {
      const result = await postJson("/api/admin/social-media-studio/generate-images", {
        headline: h,
        sourceImageUrl: state.source?.imageUrl,
        generateNew: newBg,
        category: state.source?.category,
        sourceTitle: state.source?.title,
        subtitle: state.source?.subtitle,
        bodyText: state.source?.bodyText,
      });
      const images = result.data as SocialCreativeImages;
      // Surface server-side warnings (e.g. DALL-E failure) as a visible error
      if (!images.square && !images.vertical) {
        const msg = result.warnings?.[0] ?? "Image generation failed. Please try again.";
        setState((prev) => ({ ...prev, imageError: msg, isGeneratingImages: false }));
        return;
      }
      setState((prev) => ({
        ...prev,
        images,
        isGeneratingImages: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        imageError: err instanceof Error ? err.message : "Image generation failed",
        isGeneratingImages: false,
      }));
    }
  }

  // Auto-start on step entry
  useEffect(() => {
    if (state.step !== "images") return;
    if (state.images || state.isGeneratingImages) return;
    triggerImageGeneration(headline, generateNew);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  function handleShorten() {
    setShortenAttempted(true);
    setShortenOptions(shortenTitleOptions(headline));
  }

  const images = state.images;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Image Studio</h2>
        <p className="text-sm text-muted-foreground">Branded creatives for all formats.</p>
      </div>

      {/* Headline */}
      <div className="flex flex-col gap-1.5">
        <Label>Image headline (text overlay)</Label>
        <div className="flex gap-2">
          <Input
            value={headline}
            onChange={(e) => { setHeadline(e.target.value); setShortenOptions([]); setShortenAttempted(false); }}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={handleShorten}>
            Shorten ✎
          </Button>
        </div>
        {shortenOptions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {shortenOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => { setHeadline(opt); setShortenOptions([]); }}
                className="px-3 py-1 text-xs border rounded-full hover:bg-blue-50 hover:border-blue-400 transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {shortenAttempted && shortenOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">Headline is already concise.</p>
        )}
      </div>

      {/* Background toggle */}
      <div className="flex gap-3 flex-wrap">
        {([
          { value: false, label: "Use source image" },
          { value: true,  label: "Generate new AI image" },
        ] as const).map(({ value, label }) => (
          <button
            key={String(value)}
            onClick={() => setGenerateNew(value)}
            className={cn(
              "px-3 py-2 text-sm border rounded-md transition-colors",
              generateNew === value ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {state.isGeneratingImages && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Generating your branded creatives...</p>
          <p className="text-xs">This takes 20–60 seconds.</p>
        </div>
      )}

      {/* Error */}
      {state.imageError && !state.isGeneratingImages && (
        <ErrorBox
          message={state.imageError}
          onRetry={() => {
            setState((prev) => ({ ...prev, imageError: undefined }));
            triggerImageGeneration(headline, generateNew);
          }}
        />
      )}

      {/* Image previews */}
      {images && !state.isGeneratingImages && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  Square (1:1) — Facebook · Instagram
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {images.square ? (
                  <img src={images.square} alt="Square social image" className="w-full aspect-square object-cover rounded-md" />
                ) : (
                  <div className="w-full aspect-square bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground">
                    Image generation failed
                  </div>
                )}
                {images.square && (
                  <a href={images.square} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    Download 1:1
                  </a>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  Vertical (9:16) — Stories · TikTok · Reels
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {images.vertical ? (
                  <img
                    src={images.vertical}
                    alt="Vertical social image"
                    className="w-full object-cover rounded-md"
                    style={{ aspectRatio: "9 / 16", maxHeight: 300 }}
                  />
                ) : (
                  <div className="w-full bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground" style={{ aspectRatio: "9 / 16", maxHeight: 300 }}>
                    Image generation failed
                  </div>
                )}
                {images.vertical && (
                  <a href={images.vertical} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    Download 9:16
                  </a>
                )}
              </CardContent>
            </Card>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setState((prev) => ({ ...prev, images: undefined }));
              triggerImageGeneration(headline, generateNew);
            }}
            className="w-fit"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Regenerate Images
          </Button>
        </>
      )}

      <div className="flex gap-3 pt-2 flex-wrap">
        <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, step: "copy" }))}>
          ← Back to Copy
        </Button>
        <Button variant="ghost" onClick={() => setState((prev) => ({ ...prev, step: "export" }))}>
          Skip Script → Export
        </Button>
        <Button
          onClick={() => setState((prev) => ({ ...prev, step: "script" }))}
          disabled={state.isGeneratingImages}
          className="flex-1"
          size="lg"
        >
          Continue to Script →
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Video Script ─────────────────────────────────────────────────────

function VideoScriptStep({
  state,
  setState,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
}) {
  const duration = state.scriptDuration ?? 30;
  const [expandedScript, setExpandedScript] = useState(false);

  async function triggerScriptGeneration(dur: 30 | 60) {
    if (!state.source) return;
    setState((prev) => ({ ...prev, isGeneratingScript: true, scriptError: undefined, scriptDuration: dur }));
    try {
      const result = await postJson("/api/admin/social-media-studio/generate-video-script", {
        source: state.source,
        duration: dur,
      });
      setState((prev) => ({
        ...prev,
        videoScript: result.data.script as VideoScript,
        scriptDuration: dur,
        isGeneratingScript: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        scriptError: err instanceof Error ? err.message : "Script generation failed",
        isGeneratingScript: false,
      }));
    }
  }

  // Auto-start on step entry (30s default)
  useEffect(() => {
    if (state.step !== "script") return;
    if (state.videoScript || state.isGeneratingScript) return;
    triggerScriptGeneration(30);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const script = state.videoScript;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Video Script</h2>
        <p className="text-sm text-muted-foreground">TikTok / Instagram Reel — talking head format.</p>
      </div>

      {/* Duration toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          {([30, 60] as const).map((d) => (
            <button
              key={d}
              onClick={() => setState((prev) => ({ ...prev, scriptDuration: d }))}
              className={cn(
                "px-3 py-1.5 text-sm border rounded-md transition-colors",
                duration === d ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
              )}
            >
              {d} seconds
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setState((prev) => ({ ...prev, videoScript: undefined }));
            triggerScriptGeneration(duration);
          }}
          disabled={state.isGeneratingScript}
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Regenerate for selected duration
        </Button>
      </div>

      {/* Loading */}
      {state.isGeneratingScript && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Generating your {duration}-second video script...</p>
        </div>
      )}

      {/* Error */}
      {state.scriptError && !state.isGeneratingScript && (
        <ErrorBox
          message={state.scriptError}
          onRetry={() => {
            setState((prev) => ({ ...prev, videoScript: undefined, scriptError: undefined }));
            triggerScriptGeneration(duration);
          }}
        />
      )}

      {/* Script */}
      {script && !state.isGeneratingScript && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">
                Hook (first {duration === 30 ? "3" : "5"} seconds)
              </Label>
              <CopyBtn text={script.hookScript} label="Copy Hook" />
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm">{script.hookScript}</div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">Full Script</Label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedScript((p) => !p)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {expandedScript ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {expandedScript ? "Collapse" : "Expand"}
                </button>
                <CopyBtn text={script.fullScript} label="Copy Full Script" />
              </div>
            </div>
            <div className={cn("rounded-md border p-3 text-xs whitespace-pre-wrap font-mono overflow-hidden transition-all", expandedScript ? "" : "max-h-40")}>
              {script.fullScript}
            </div>
          </div>

          {script.onScreenTextSuggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">On-Screen Text Suggestions</Label>
              <ul className="space-y-1">
                {script.onScreenTextSuggestions.map((t, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-blue-500 shrink-0">•</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {script.brollSuggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">B-Roll Ideas</Label>
              <ul className="space-y-1">
                {script.brollSuggestions.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-blue-500 shrink-0">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {script.voiceoverTips && (
            <div className="flex flex-col gap-1.5">
              <Label className="uppercase text-xs tracking-wide text-muted-foreground">Delivery Tips</Label>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{script.voiceoverTips}</div>
            </div>
          )}

          {script.suggestedCaption && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="uppercase text-xs tracking-wide text-muted-foreground">Suggested Caption</Label>
                <CopyBtn text={script.suggestedCaption} label="Copy Caption" />
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-sm">{script.suggestedCaption}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2 flex-wrap">
        <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, step: "images" }))}>
          ← Back
        </Button>
        <Button variant="ghost" onClick={() => setState((prev) => ({ ...prev, step: "export" }))}>
          Skip to Export
        </Button>
        <Button
          onClick={() => setState((prev) => ({ ...prev, step: "export" }))}
          disabled={state.isGeneratingScript}
          className="flex-1"
          size="lg"
        >
          Continue to Export →
        </Button>
      </div>
    </div>
  );
}

// ─── Step 5: Export ───────────────────────────────────────────────────────────

function ExportStep({
  state,
  setState,
}: {
  state: StudioState;
  setState: Dispatch<SetStateAction<StudioState>>;
}) {
  const [platform, setPlatform] = useState<SocialPlatform>("facebook");
  const [locale] = useState<SocialLocale>(state.source?.locale ?? "en");
  const [saveStatus, setSaveStatus] = useState<"draft" | "published">("draft");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedScript, setExpandedScript] = useState(false);

  const copies = state.copies ?? [];
  const currentCopy = copies.find((c) => c.platform === platform && c.locale === locale);
  const images = state.images;
  const script = state.videoScript;

  async function saveToSanity() {
    if (!state.source || !copies.length) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await postJson("/api/admin/social-media-studio/publish", {
        source: state.source,
        copies,
        images: images ?? { square: "", vertical: "", sourceImageUrl: "", headline: "", generatedByAI: false },
        videoScript: script,
        status: saveStatus,
        tags,
      });
      setState((prev) => ({ ...prev, savedResult: result.data as PublishedSocialPost }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Your social media package is ready!</h2>
      </div>

      <p className="text-sm text-muted-foreground -mt-4">
        Source: <span className="font-medium text-foreground">"{state.source?.title}"</span>
        <Badge variant="outline" className="ml-2 text-xs">
          {state.source?.type?.replace(/_/g, " ") ?? ""}
        </Badge>
      </p>

      {/* Platform copy */}
      <div className="flex flex-col gap-4">
        <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Platform Copy</h3>
        <div className="flex gap-0 flex-wrap border-b">
          {ALL_PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                platform === p ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
        {currentCopy ? (
          <div className="flex flex-col gap-2">
            <div className="rounded-md border bg-muted/20 p-4 whitespace-pre-wrap text-sm min-h-24">
              {currentCopy.fullPost}
            </div>
            <div className="flex justify-end">
              <CopyBtn text={currentCopy.fullPost} label="Copy for Metricool" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No copy available for this combination.</p>
        )}
      </div>

      {/* Images */}
      {images && (
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Images</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              {images.square ? (
                <img src={images.square} alt="Square" className="w-full aspect-square object-cover rounded-md border" />
              ) : (
                <div className="w-full aspect-square bg-muted rounded-md" />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Square (1:1)</span>
                {images.square && (
                  <a href={images.square} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Download</a>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {images.vertical ? (
                <img src={images.vertical} alt="Vertical" className="w-full object-cover rounded-md border" style={{ aspectRatio: "9 / 16", maxHeight: 200 }} />
              ) : (
                <div className="w-full bg-muted rounded-md" style={{ aspectRatio: "9 / 16", maxHeight: 200 }} />
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Vertical (9:16)</span>
                {images.vertical && (
                  <a href={images.vertical} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Download</a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video script */}
      {script && (
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Video Script</h3>
          <div className="rounded-md border p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{script.duration}s script</Badge>
              <CopyBtn text={script.fullScript} label="Copy Script" />
            </div>
            <p className="text-sm font-medium">{script.hookScript}</p>
            <div className={cn("text-xs text-muted-foreground whitespace-pre-wrap font-mono overflow-hidden transition-all", expandedScript ? "" : "max-h-20")}>
              {script.fullScript}
            </div>
            <button onClick={() => setExpandedScript((p) => !p)} className="text-xs text-blue-600 hover:underline text-left">
              {expandedScript ? "Collapse" : "Expand full script"}
            </button>
          </div>
        </div>
      )}

      {/* Save to Sanity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Save to Sanity (optional)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {state.savedResult ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Saved successfully!</span>
              </div>
              <a
                href={`/studio/structure/socialPost;${state.savedResult.sanityDocumentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                View in Sanity Studio →
              </a>
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-3">Publish to Social Platforms</p>
                <PublishToSocialSection
                  sanityPostId={state.savedResult.sanityDocumentId}
                  copies={state.copies ?? []}
                  squareImageUrl={state.images?.square}
                  verticalImageUrl={state.images?.vertical}
                  locale={state.source?.locale ?? "en"}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium">Save as:</span>
                {(["draft", "published"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSaveStatus(s)}
                    className={cn(
                      "px-3 py-1 text-sm border rounded-md transition-colors capitalize",
                      saveStatus === s ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
                    )}
                  >
                    {s === "draft" ? "Save as Draft" : "Mark as Published"}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Tags (optional)</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs">
                      {t}
                      <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="text-muted-foreground hover:text-red-600">×</button>
                    </span>
                  ))}
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="+ add tag"
                    className="h-7 w-28 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTag.trim()) {
                        setTags((prev) => [...prev, newTag.trim()]);
                        setNewTag("");
                      }
                    }}
                  />
                </div>
              </div>
              {saveError && <ErrorBox message={saveError} onRetry={saveToSanity} />}
              <Button onClick={saveToSanity} disabled={isSaving}>
                {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save to Sanity →"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, step: "script" }))}>
          ← Back to Script
        </Button>
        <Button variant="outline" onClick={() => setState({ step: "source" })}>
          Generate Another Post
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SocialMediaStudioPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<StudioState>({ step: "source" });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Social Media Content Studio</h1>
          <p className="text-muted-foreground text-sm">
            Generate a complete post package from any blog post or guide.
          </p>
        </div>
        <a
          href={`/en/admin/social-media-studio/history`}
          className="text-sm text-blue-600 hover:underline flex-shrink-0"
        >
          View History →
        </a>
      </header>
      <StepIndicator currentStep={state.step} />
      {state.step === "source" && <SourcePickerStep state={state} setState={setState} />}
      {state.step === "copy"   && <CopyReviewStep   state={state} setState={setState} />}
      {state.step === "images" && <ImageStudioStep  state={state} setState={setState} />}
      {state.step === "script" && <VideoScriptStep  state={state} setState={setState} />}
      {state.step === "export" && <ExportStep       state={state} setState={setState} />}
    </div>
  );
}
