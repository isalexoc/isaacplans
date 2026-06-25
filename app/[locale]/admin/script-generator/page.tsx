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
import {
  LINES_OF_BUSINESS,
  SECTION_KEYS,
  SECTION_LABELS,
  lineOfBusinessLabel,
  type LineOfBusiness,
  type GeneratedScript,
  type ScriptPublishResult,
  type SectionKey,
  type VideoDistillation,
} from "@/lib/script-generator/types";

type Stage = "idle" | "distilling" | "generating" | "review" | "publishing" | "success";

interface DistillItem {
  url: string;
  status: "queued" | "processing" | "done" | "error";
  title?: string;
  sourceType?: string;
  error?: string;
}

interface ReviewForm {
  title: string;
  description: string;
  en: GeneratedScript;
  es: GeneratedScript;
  status: "draft" | "published";
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Request failed");
  return data;
}

export default function ScriptGeneratorPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [lineOfBusiness, setLineOfBusiness] = useState<LineOfBusiness | "">("");
  const [urlsText, setUrlsText] = useState("");
  const [distillItems, setDistillItems] = useState<DistillItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(null);
  const [previewLang, setPreviewLang] = useState<"en" | "es">("en");
  const [result, setResult] = useState<ScriptPublishResult | null>(null);

  function resetAll() {
    setStage("idle");
    setUrlsText("");
    setDistillItems([]);
    setError(null);
    setForm(null);
    setPreviewLang("en");
    setResult(null);
  }

  function parseUrls(): string[] {
    return Array.from(
      new Set(
        urlsText
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean)
      )
    );
  }

  async function runPipeline() {
    if (!lineOfBusiness) return;
    const urls = parseUrls();
    if (urls.length === 0) return;

    setError(null);
    setResult(null);

    const items: DistillItem[] = urls.map((url) => ({ url, status: "queued" }));
    setDistillItems(items);
    setStage("distilling");

    // ── Map: distill each video on its own request (no link-count limit) ──────
    const collected: VideoDistillation[] = [];
    for (let i = 0; i < items.length; i++) {
      setDistillItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "processing" } : it))
      );
      try {
        const data = await postJson("/api/admin/script-generator/distill", {
          url: items[i].url,
          lineOfBusiness,
        });
        collected.push(data.data);
        setDistillItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: "done", title: data.data.title, sourceType: data.data.sourceType }
              : it
          )
        );
      } catch (err) {
        setDistillItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: "error", error: err instanceof Error ? err.message : "Failed" }
              : it
          )
        );
      }
    }

    if (collected.length === 0) {
      setError("None of the videos could be processed. Check the links and try again.");
      setStage("idle");
      return;
    }

    // ── Reduce: synthesize one script + translate to Spanish ──────────────────
    setStage("generating");
    try {
      const data = await postJson("/api/admin/script-generator/generate", {
        distillations: collected,
        lineOfBusiness,
      });
      const en: GeneratedScript = data.data.en;
      const es: GeneratedScript = data.data.es;
      setForm({
        title: en.title,
        description: en.description,
        en,
        es,
        status: "draft",
      });
      setPreviewLang("en");
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate the script");
      setStage("idle");
    }
  }

  function updateSection(lang: "en" | "es", key: SectionKey, field: "content" | "tips", value: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const script = prev[lang];
      return {
        ...prev,
        [lang]: {
          ...script,
          sections: {
            ...script.sections,
            [key]: { ...script.sections[key], [field]: value },
          },
        },
      };
    });
  }

  function updateCompleteScript(lang: "en" | "es", value: string) {
    setForm((prev) => (prev ? { ...prev, [lang]: { ...prev[lang], completeScript: value } } : prev));
  }

  async function handlePublish() {
    if (!form || !lineOfBusiness) return;
    setError(null);
    setStage("publishing");
    try {
      const data = await postJson("/api/admin/script-generator/publish", {
        en: form.en,
        es: form.es,
        lineOfBusiness,
        title: form.title,
        description: form.description,
        status: form.status,
      });
      setResult(data.data);
      setStage("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
      setStage("review");
    }
  }

  const doneCount = distillItems.filter((i) => i.status === "done").length;
  const processedCount = distillItems.filter((i) => i.status === "done" || i.status === "error").length;

  // ── Distilling / Generating (progress) ─────────────────────────────────────
  if (stage === "distilling" || stage === "generating") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-2">Sales Script Generator</h1>
        <p className="text-muted-foreground mb-8">
          {lineOfBusiness && lineOfBusinessLabel(lineOfBusiness)} ·{" "}
          {stage === "distilling"
            ? `Analyzing videos (${processedCount}/${distillItems.length})…`
            : "Synthesizing the final script + translating to Spanish…"}
        </p>

        <div className="flex flex-col gap-2">
          {distillItems.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex-shrink-0 w-4">
                {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {item.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                {item.status === "queued" && <span className="text-muted-foreground">○</span>}
                {item.status === "error" && <span className="text-red-600">✗</span>}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="truncate text-xs">{item.title || item.url}</span>
                {item.status === "done" && (
                  <span className="text-green-600 text-xs">{item.sourceType} · distilled ✓</span>
                )}
                {item.status === "processing" && (
                  <span className="text-blue-600 text-xs">fetching transcript & distilling…</span>
                )}
                {item.status === "queued" && <span className="text-muted-foreground text-xs">queued</span>}
                {item.status === "error" && <span className="text-red-600 text-xs">{item.error}</span>}
              </div>
            </div>
          ))}
        </div>

        {stage === "generating" && (
          <div className="flex items-center gap-2 mt-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Building the script from {doneCount} source(s)…</span>
          </div>
        )}
      </div>
    );
  }

  // ── Publishing ──────────────────────────────────────────────────────────────
  if (stage === "publishing") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-12">Sales Script Generator</h1>
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Saving the script to Sanity…</p>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (stage === "success" && result) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-8">Sales Script Generator</h1>
        <Card>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">
                Script {form?.status === "published" ? "published" : "saved as a draft"} in Sanity
              </span>
            </div>
            <Separator />
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground font-medium">Open in Sanity Studio to review &amp; fine-tune:</p>
              <a
                href={result.studioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {result.studioUrl}
              </a>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              Once its status is <strong>Published</strong>, it appears on{" "}
              <a href="/en/presentations" className="text-blue-600 hover:underline">/presentations</a> under{" "}
              {lineOfBusiness && lineOfBusinessLabel(lineOfBusiness)}.
            </p>
            <Button onClick={resetAll} className="mt-2 w-fit">
              Generate Another Script
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Review & Edit ───────────────────────────────────────────────────────────
  if (stage === "review" && form) {
    const script = form[previewLang];
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Sales Script Generator</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {lineOfBusiness && lineOfBusinessLabel(lineOfBusiness)} · review &amp; edit before saving
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={resetAll}>
            Start Over
          </Button>
        </div>

        <div className="flex flex-col gap-6">
          {/* Meta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Script Details
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Language toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Language:</span>
            <Button
              variant={previewLang === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewLang("en")}
            >
              English
            </Button>
            <Button
              variant={previewLang === "es" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewLang("es")}
            >
              Español
            </Button>
          </div>

          {/* Sections */}
          {SECTION_KEYS.map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {SECTION_LABELS[key]}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Script (markdown)</Label>
                  <Textarea
                    rows={10}
                    className="font-mono text-sm"
                    value={script.sections[key].content}
                    onChange={(e) => updateSection(previewLang, key, "content", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Tips (markdown)</Label>
                  <Textarea
                    rows={4}
                    className="font-mono text-sm"
                    value={script.sections[key].tips}
                    onChange={(e) => updateSection(previewLang, key, "tips", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Complete script */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Complete Script (all-in-one)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={14}
                className="font-mono text-sm"
                value={script.completeScript}
                onChange={(e) => updateCompleteScript(previewLang, e.target.value)}
              />
            </CardContent>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-medium">Save as:</span>
              <Button
                variant={form.status === "draft" ? "default" : "outline"}
                size="sm"
                onClick={() => setForm((prev) => (prev ? { ...prev, status: "draft" } : prev))}
              >
                Draft
              </Button>
              <Button
                variant={form.status === "published" ? "default" : "outline"}
                size="sm"
                onClick={() => setForm((prev) => (prev ? { ...prev, status: "published" } : prev))}
              >
                Published
              </Button>
            </div>
            <Button onClick={handlePublish} size="lg" className="flex-1" disabled={!form.title.trim()}>
              Save to Sanity
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Idle — setup ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Sales Script Generator</h1>
      <p className="text-muted-foreground mb-8">
        Pick a line of business and paste YouTube links (sales calls, training videos). The AI distills the
        useful sales content from each video, then synthesizes one bilingual sales script saved to Sanity.
      </p>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label>Line of Business *</Label>
          <Select value={lineOfBusiness} onValueChange={(v) => setLineOfBusiness(v as LineOfBusiness)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a line of business…" />
            </SelectTrigger>
            <SelectContent>
              {LINES_OF_BUSINESS.map((lob) => (
                <SelectItem key={lob.value} value={lob.value}>
                  {lob.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="urls">YouTube URLs (one per line — no limit)</Label>
          <Textarea
            id="urls"
            rows={10}
            placeholder={"https://www.youtube.com/watch?v=...\nhttps://youtu.be/...\nhttps://www.youtube.com/watch?v=..."}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Each video is processed independently, so you can paste as many as you like — failed videos are
            skipped without stopping the run.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          onClick={runPipeline}
          disabled={!lineOfBusiness || !urlsText.trim()}
          size="lg"
          className="w-fit"
        >
          Generate Script
        </Button>
      </div>
    </div>
  );
}
