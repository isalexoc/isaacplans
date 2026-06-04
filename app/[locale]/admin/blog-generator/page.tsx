"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VALID_CATEGORIES, type BlogCategory, type YouTubeExtractionResult, type GeneratedBlogContent, type SanityPublishResult } from "@/lib/blog-generator/types";

type Stage = "idle" | "extracting" | "generating" | "review" | "publishing" | "success";

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
}

const EMPTY_FORM: ReviewForm = {
  title: "",
  excerpt: "",
  category: "general",
  tags: "",
  readingTime: 5,
  bodyMarkdown: "",
  seo: { metaTitle: "", metaDescription: "", focusKeyword: "", keywords: "" },
};

const STAGE_LABELS: Record<string, string> = {
  extracting: "Extracting transcript and metadata...",
  generating: "Generating blog post with AI...",
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

export default function BlogGeneratorPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<YouTubeExtractionResult | null>(null);
  const [form, setForm] = useState<ReviewForm>(EMPTY_FORM);
  const [result, setResult] = useState<SanityPublishResult | null>(null);

  function resetAll() {
    setStage("idle");
    setUrl("");
    setError(null);
    setExtraction(null);
    setForm(EMPTY_FORM);
    setResult(null);
  }

  async function runPipeline() {
    setError(null);

    try {
      setStage("extracting");
      const extractRes = await fetch("/api/admin/blog-generator/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const extractData = await extractRes.json();
      if (!extractData.success) throw new Error(extractData.error);
      setExtraction(extractData.data);

      setStage("generating");
      const generateRes = await fetch("/api/admin/blog-generator/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction: extractData.data }),
      });
      const generateData = await generateRes.json();
      if (!generateData.success) throw new Error(generateData.error);

      const content: GeneratedBlogContent = generateData.data;
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
      });

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

    const content: GeneratedBlogContent = {
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

    try {
      const res = await fetch("/api/admin/blog-generator/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, extraction }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data.data);
      setStage("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
      setStage("review");
    }
  }

  function setFormField<K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setSeoField(key: keyof ReviewForm["seo"], value: string) {
    setForm((prev) => ({ ...prev, seo: { ...prev.seo, [key]: value } }));
  }

  // ── Loading stages ──────────────────────────────────────────────────────────
  if (stage === "extracting" || stage === "generating" || stage === "publishing") {
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

  // ── Success ─────────────────────────────────────────────────────────────────
  if (stage === "success" && result) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-8">Blog Generator</h1>
        <Card>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Posts created as drafts in Sanity</span>
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
          {/* Video metadata */}
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

          {/* Content fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Content
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <Label htmlFor="title">Title *</Label>
                  <span className="text-xs text-muted-foreground">{form.title.length}/70</span>
                </div>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setFormField("title", e.target.value)}
                  maxLength={70}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <Label htmlFor="excerpt">Excerpt *</Label>
                  <span className="text-xs text-muted-foreground">{form.excerpt.length}/200</span>
                </div>
                <Textarea
                  id="excerpt"
                  rows={3}
                  value={form.excerpt}
                  onChange={(e) => setFormField("excerpt", e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Category *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setFormField("category", v as BlogCategory)}
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
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Body (Markdown)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={20}
                value={form.bodyMarkdown}
                onChange={(e) => setFormField("bodyMarkdown", e.target.value)}
                className="font-mono text-sm"
              />
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handlePublish} size="lg" className="w-full">
            Publish as Draft
          </Button>
        </div>
      </div>
    );
  }

  // ── Idle — URL input ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Blog Generator</h1>
      <p className="text-muted-foreground mb-8">
        Generate a bilingual blog post from a YouTube video using AI.
      </p>

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
    </div>
  );
}
