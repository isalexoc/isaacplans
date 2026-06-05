"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, RotateCcw, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VALID_CATEGORIES,
  type BlogCategory,
  type YouTubeExtractionResult,
  type GeneratedBlogContent,
  type SanityPublishResult,
  type CTASettings,
  type BilingualImages,
} from "@/lib/blog-generator/types";
import { CATEGORY_CTA } from "@/lib/blog-generator/cta-config";

type Stage =
  | "idle"
  | "extracting"
  | "generating"
  | "generating-images"
  | "review"
  | "publishing"
  | "success";

type RegenerableField = "title" | "excerpt" | "body";

interface ReviewForm {
  title: string;
  excerpt: string;
  category: BlogCategory;
  tags: string;
  readingTime: number;
  bodyMarkdown: string;
  seo: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    keywords: string;
  };
  cta: CTASettings;
  publishStatus: "draft" | "published";
}

interface BatchItem {
  url: string;
  status: "queued" | "processing" | "done" | "error";
  result?: SanityPublishResult;
  error?: string;
}

const EMPTY_FORM: ReviewForm = {
  title: "",
  excerpt: "",
  category: "general",
  tags: "",
  readingTime: 5,
  bodyMarkdown: "",
  seo: { metaTitle: "", metaDescription: "", focusKeyword: "", keywords: "" },
  cta: { enableCTA: true, ctaType: "consultation", ctaText: "Schedule a Free Consultation", ctaPosition: "bottom" },
  publishStatus: "draft",
};

const STAGE_LABELS: Record<string, string> = {
  extracting: "Extracting transcript and metadata...",
  generating: "Generating blog post with AI...",
  "generating-images": "Generating images with DALL-E 3 (this takes ~30 seconds)...",
  publishing: "Translating to Spanish and publishing...",
};

const CATEGORY_LABELS: Record<BlogCategory, string> = {
  aca: "ACA / Obamacare",
  "temporary-health-insurance": "Temporary Health Insurance",
  "dental-vision": "Dental & Vision",
  "hospital-indemnity": "Hospital Indemnity",
  iul: "Indexed Universal Life",
  "final-expense": "Final Expense",
  "cancer-plans": "Cancer Plans",
  "heart-stroke": "Heart Attack & Stroke",
  general: "General Insurance",
  "tips-guides": "Insurance Tips & Guides",
  news: "Industry News",
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

export default function BlogGeneratorPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<YouTubeExtractionResult | null>(null);
  const [form, setForm] = useState<ReviewForm>(EMPTY_FORM);
  const [result, setResult] = useState<SanityPublishResult | null>(null);
  const [images, setImages] = useState<BilingualImages | null>(null);

  const [regenerating, setRegenerating] = useState({ title: false, excerpt: false, body: false });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegenerableField, string>>>({});
  const [generatingImages, setGeneratingImages] = useState(false);

  const [batchUrls, setBatchUrls] = useState("");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  function resetAll() {
    setStage("idle");
    setUrl("");
    setError(null);
    setExtraction(null);
    setForm(EMPTY_FORM);
    setResult(null);
    setImages(null);
    setRegenerating({ title: false, excerpt: false, body: false });
    setFieldErrors({});
  }

  function setFormField<K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setSeoField(key: keyof ReviewForm["seo"], value: string) {
    setForm((prev) => ({ ...prev, seo: { ...prev.seo, [key]: value } }));
  }

  function setCTAField<K extends keyof CTASettings>(key: K, value: CTASettings[K]) {
    setForm((prev) => ({ ...prev, cta: { ...prev.cta, [key]: value } }));
  }

  function handleCategoryChange(category: BlogCategory) {
    const defaults = CATEGORY_CTA[category];
    setForm((prev) => ({ ...prev, category, cta: { ...prev.cta, ...defaults } }));
  }

  function buildContentFromForm(): GeneratedBlogContent {
    return {
      title: form.title,
      excerpt: form.excerpt,
      bodyMarkdown: form.bodyMarkdown,
      bodyBlocks: [],
      category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      readingTime: form.readingTime,
      seo: {
        metaTitle: form.seo.metaTitle,
        metaDescription: form.seo.metaDescription,
        focusKeyword: form.seo.focusKeyword,
        keywords: form.seo.keywords.split(",").map((k) => k.trim()).filter(Boolean),
      },
    };
  }

  async function runPipeline() {
    setError(null);
    try {
      setStage("extracting");
      const extractData = await postJson("/api/admin/blog-generator/extract", { url });
      setExtraction(extractData.data);

      setStage("generating");
      const generateData = await postJson("/api/admin/blog-generator/generate", { extraction: extractData.data });

      const content: GeneratedBlogContent = generateData.data;
      const ctaDefaults = CATEGORY_CTA[content.category];
      setForm({
        title: content.title,
        excerpt: content.excerpt,
        category: content.category,
        tags: content.tags.join(", "),
        readingTime: content.readingTime,
        bodyMarkdown: content.bodyMarkdown,
        seo: {
          metaTitle: content.seo.metaTitle,
          metaDescription: content.seo.metaDescription,
          focusKeyword: content.seo.focusKeyword,
          keywords: content.seo.keywords.join(", "),
        },
        cta: { enableCTA: true, ...ctaDefaults },
        publishStatus: "draft",
      });

      // Image generation — non-fatal
      setStage("generating-images");
      try {
        const imagesData = await postJson("/api/admin/blog-generator/generate-images", { content });
        setImages(imagesData.data);
      } catch {
        setImages(null);
      }

      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("idle");
    }
  }

  async function handlePublish() {
    if (!extraction) return;
    setError(null);
    setStage("publishing");
    try {
      const data = await postJson("/api/admin/blog-generator/publish", {
        content: buildContentFromForm(),
        extraction,
        cta: form.cta,
        status: form.publishStatus,
        images: images ?? undefined,
      });
      setResult(data.data);
      setStage("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
      setStage("review");
    }
  }

  async function handleRegenerate(field: RegenerableField) {
    if (!extraction) return;
    setRegenerating((prev) => ({ ...prev, [field]: true }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    try {
      const data = await postJson("/api/admin/blog-generator/regenerate", {
        field,
        extraction,
        currentContent: buildContentFromForm(),
      });
      if (field === "title") setFormField("title", data.data.value);
      if (field === "excerpt") setFormField("excerpt", data.data.value);
      if (field === "body") setFormField("bodyMarkdown", data.data.value);
    } catch (err) {
      setFieldErrors((prev) => ({
        ...prev,
        [field]: err instanceof Error ? err.message : "Regeneration failed",
      }));
    } finally {
      setRegenerating((prev) => ({ ...prev, [field]: false }));
    }
  }

  async function handleGenerateImages() {
    setGeneratingImages(true);
    setError(null);
    try {
      const data = await postJson("/api/admin/blog-generator/generate-images", {
        content: buildContentFromForm(),
      });
      setImages(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setGeneratingImages(false);
    }
  }

  async function runBatch() {
    const urls = batchUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (urls.length === 0) return;

    const items: BatchItem[] = urls.map((u) => ({ url: u, status: "queued" }));
    setBatchItems(items);
    setBatchRunning(true);

    for (let i = 0; i < items.length; i++) {
      setBatchItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "processing" } : item))
      );
      try {
        const extractData = await postJson("/api/admin/blog-generator/extract", { url: items[i].url });
        const generateData = await postJson("/api/admin/blog-generator/generate", { extraction: extractData.data });
        const content: GeneratedBlogContent = generateData.data;

        let batchImages: BilingualImages | undefined;
        try {
          const imgData = await postJson("/api/admin/blog-generator/generate-images", { content });
          batchImages = imgData.data;
        } catch {
          batchImages = undefined;
        }

        const cta = CATEGORY_CTA[content.category];
        const publishData = await postJson("/api/admin/blog-generator/publish", {
          content,
          extraction: extractData.data,
          cta: { enableCTA: true, ...cta },
          status: "draft",
          images: batchImages,
        });
        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "done", result: publishData.data } : item
          )
        );
      } catch (err) {
        setBatchItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "error", error: err instanceof Error ? err.message : "Failed" }
              : item
          )
        );
      }
    }
    setBatchRunning(false);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (stage === "extracting" || stage === "generating" || stage === "generating-images" || stage === "publishing") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-12">Blog Generator</h1>
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>{STAGE_LABELS[stage]}</p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (stage === "success" && result) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-8">Blog Generator</h1>
        <Card>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">
                Posts {form.publishStatus === "published" ? "published" : "created as drafts"} in Sanity
                {images ? " with AI-generated images" : ""}
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground font-medium">Open in Sanity Studio:</p>
              <a
                href={`/studio/structure/post;${result.enPostId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                English post → /studio/structure/post;{result.enPostId}
              </a>
              <a
                href={`/studio/structure/post;${result.esPostId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Spanish post → /studio/structure/post;{result.esPostId}
              </a>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <p className="font-medium">Preview URLs (once published):</p>
              <span>/en/blog/{result.enSlug}</span>
              <span>/es/blog/{result.esSlug}</span>
            </div>
            <Button onClick={resetAll} className="mt-2 w-fit">
              Generate Another Post
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Review & Edit ────────────────────────────────────────────────────────────
  if (stage === "review") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Blog Generator</h1>
          <Button variant="outline" size="sm" onClick={resetAll}>
            Start Over
          </Button>
        </div>

        <div className="flex flex-col gap-6">
          {/* Source video */}
          {extraction && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Source Video
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                {extraction.metadata.thumbnailUrl && (
                  <img
                    src={extraction.metadata.thumbnailUrl}
                    alt={extraction.metadata.title}
                    className="w-40 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">{extraction.metadata.title}</p>
                  <p className="text-muted-foreground">{extraction.metadata.channelName}</p>
                  <p className="text-muted-foreground">
                    {Math.floor(extraction.metadata.durationSeconds / 60)}m {extraction.metadata.durationSeconds % 60}s
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Images
              </CardTitle>
            </CardHeader>
            <CardContent>
              {images ? (
                <div className="flex flex-col gap-4">
                  {(["en", "es"] as const).map((locale) => (
                    <div key={locale} className="flex flex-col gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {locale === "en" ? "English (American)" : "Spanish (Hispanic)"}
                      </p>
                      <div className="flex gap-3 flex-wrap items-start">
                        <img
                          src={images[locale].featured.url}
                          alt={images[locale].featured.alt}
                          className="rounded-lg object-cover flex-shrink-0"
                          style={{ height: "96px", aspectRatio: "16/9" }}
                        />
                        <div className="flex gap-2 flex-wrap">
                          {images[locale].body.map((img, i) => (
                            <img
                              key={i}
                              src={img.url}
                              alt={img.alt}
                              className="h-24 w-24 rounded-lg object-cover flex-shrink-0"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Each locale gets its own featured image + 3 body images (25%, 50%, 75% of post body).
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => setImages(null)}
                  >
                    Remove Images
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <p className="text-sm text-muted-foreground">No images generated. Will use YouTube thumbnail.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateImages}
                    disabled={generatingImages}
                  >
                    {generatingImages ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" />Generating...</>
                    ) : (
                      <><ImageIcon className="h-3 w-3 mr-1" />Generate Images</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Content
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">Title *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{form.title.length}/70</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleRegenerate("title")}
                      disabled={regenerating.title}
                    >
                      {regenerating.title ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      <span className="ml-1">Regenerate</span>
                    </Button>
                  </div>
                </div>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setFormField("title", e.target.value)}
                  maxLength={70}
                />
                {fieldErrors.title && <p className="text-xs text-red-600">{fieldErrors.title}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="excerpt">Excerpt *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{form.excerpt.length}/200</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleRegenerate("excerpt")}
                      disabled={regenerating.excerpt}
                    >
                      {regenerating.excerpt ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      <span className="ml-1">Regenerate</span>
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="excerpt"
                  rows={3}
                  value={form.excerpt}
                  onChange={(e) => setFormField("excerpt", e.target.value)}
                  maxLength={200}
                />
                {fieldErrors.excerpt && <p className="text-xs text-red-600">{fieldErrors.excerpt}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Category *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => handleCategoryChange(v as BlogCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="readingTime">Reading Time (min)</Label>
                  <Input
                    id="readingTime"
                    type="number"
                    min={1}
                    value={form.readingTime}
                    onChange={(e) => setFormField("readingTime", parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(e) => setFormField("tags", e.target.value)}
                  placeholder="health insurance, ACA, subsidies"
                />
              </div>
            </CardContent>
          </Card>

          {/* Body */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Body (Markdown)
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs font-normal"
                  onClick={() => handleRegenerate("body")}
                  disabled={regenerating.body}
                >
                  {regenerating.body ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  <span className="ml-1">Regenerate</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={20}
                value={form.bodyMarkdown}
                onChange={(e) => setFormField("bodyMarkdown", e.target.value)}
                className="font-mono text-sm"
              />
              {fieldErrors.body && <p className="text-xs text-red-600 mt-1">{fieldErrors.body}</p>}
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                SEO
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <Label htmlFor="metaTitle">Meta Title</Label>
                  <span className="text-xs text-muted-foreground">{form.seo.metaTitle.length}/60</span>
                </div>
                <Input
                  id="metaTitle"
                  value={form.seo.metaTitle}
                  onChange={(e) => setSeoField("metaTitle", e.target.value)}
                  maxLength={60}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <Label htmlFor="metaDescription">Meta Description</Label>
                  <span className="text-xs text-muted-foreground">{form.seo.metaDescription.length}/160</span>
                </div>
                <Textarea
                  id="metaDescription"
                  rows={2}
                  value={form.seo.metaDescription}
                  onChange={(e) => setSeoField("metaDescription", e.target.value)}
                  maxLength={160}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="focusKeyword">Focus Keyword</Label>
                <Input
                  id="focusKeyword"
                  value={form.seo.focusKeyword}
                  onChange={(e) => setSeoField("focusKeyword", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Input
                  id="keywords"
                  value={form.seo.keywords}
                  onChange={(e) => setSeoField("keywords", e.target.value)}
                  placeholder="health insurance, ACA enrollment, subsidies"
                />
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                CTA
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="enableCTA"
                  checked={form.cta.enableCTA}
                  onCheckedChange={(checked) => setCTAField("enableCTA", checked)}
                />
                <Label htmlFor="enableCTA">Enable CTA</Label>
              </div>
              {form.cta.enableCTA && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label>CTA Type</Label>
                      <Select
                        value={form.cta.ctaType}
                        onValueChange={(v) => setCTAField("ctaType", v as CTASettings["ctaType"])}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quote">Quote</SelectItem>
                          <SelectItem value="consultation">Consultation</SelectItem>
                          <SelectItem value="contact">Contact</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Position</Label>
                      <Select
                        value={form.cta.ctaPosition}
                        onValueChange={(v) => setCTAField("ctaPosition", v as CTASettings["ctaPosition"])}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="middle">Middle</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="floating">Floating</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ctaText">Button Text</Label>
                    <Input
                      id="ctaText"
                      value={form.cta.ctaText}
                      onChange={(e) => setCTAField("ctaText", e.target.value)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-medium">Publish as:</span>
              <Button
                variant={form.publishStatus === "draft" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormField("publishStatus", "draft")}
              >
                Draft
              </Button>
              <Button
                variant={form.publishStatus === "published" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormField("publishStatus", "published")}
              >
                Published
              </Button>
            </div>
            <Button onClick={handlePublish} size="lg" className="flex-1">
              Publish
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Idle — URL input with tabs ───────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Blog Generator</h1>
      <p className="text-muted-foreground mb-8">
        Generate a bilingual blog post from a YouTube video using AI.
      </p>



      <Tabs defaultValue="single">
        <TabsList className="mb-6">
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="batch">Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="youtube-url">YouTube URL</Label>
              <div className="flex gap-2">
                <Input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && url.trim() && runPipeline()}
                />
                <Button onClick={runPipeline} disabled={!url.trim()}>
                  Generate
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </TabsContent>

        <TabsContent value="batch">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="batch-urls">YouTube URLs (one per line, max 10)</Label>
              <Textarea
                id="batch-urls"
                rows={6}
                placeholder={"https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/watch?v=..."}
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                disabled={batchRunning}
              />
            </div>

            <Button onClick={runBatch} disabled={batchRunning || !batchUrls.trim()}>
              {batchRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
              ) : (
                "Process All as Drafts"
              )}
            </Button>

            {batchItems.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                <Separator />
                {batchItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex-shrink-0 w-4">
                      {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {item.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                      {item.status === "queued" && <span className="text-muted-foreground">○</span>}
                      {item.status === "error" && <span className="text-red-600">✗</span>}
                    </span>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="truncate text-muted-foreground text-xs">{item.url}</span>
                      {item.status === "done" && item.result && (
                        <span className="text-green-600 text-xs">→ /en/blog/{item.result.enSlug}</span>
                      )}
                      {item.status === "processing" && <span className="text-blue-600 text-xs">processing...</span>}
                      {item.status === "queued" && <span className="text-muted-foreground text-xs">queued</span>}
                      {item.status === "error" && <span className="text-red-600 text-xs">{item.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
