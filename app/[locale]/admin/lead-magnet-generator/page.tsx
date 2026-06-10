"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  LeadMagnetPromptInput,
  LeadMagnetOutline,
  LeadMagnetSection,
  GeneratedLeadMagnet,
  LeadMagnetImages,
  PublishedLeadMagnet,
} from "@/lib/lead-magnet-generator/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type GeneratorStep = "prompt" | "outline" | "generating" | "images" | "publish" | "success";

interface GeneratorState {
  step: GeneratorStep;
  promptInput?: LeadMagnetPromptInput;
  outline?: LeadMagnetOutline;
  completedSections?: LeadMagnetSection[];
  currentSectionIndex?: number;
  generatedContent?: GeneratedLeadMagnet;
  images?: LeadMagnetImages;
  pdfUrl?: string;
  pageCount?: number;
  publishedResult?: PublishedLeadMagnet;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "aca", label: "ACA / Health Insurance" },
  { value: "temporary-health-insurance", label: "Temporary Health Insurance" },
  { value: "dental-vision", label: "Dental & Vision" },
  { value: "hospital-indemnity", label: "Hospital Indemnity" },
  { value: "iul", label: "IUL (Life Insurance)" },
  { value: "final-expense", label: "Final Expense" },
  { value: "cancer-plans", label: "Cancer Plans" },
  { value: "heart-stroke", label: "Heart & Stroke" },
  { value: "general", label: "General Insurance" },
  { value: "tips-guides", label: "Tips & Guides" },
  { value: "news", label: "News" },
] as const;

const STEPS: { key: GeneratorStep; label: string }[] = [
  { key: "prompt", label: "Prompt" },
  { key: "outline", label: "Outline" },
  { key: "generating", label: "Generate" },
  { key: "images", label: "Images" },
  { key: "publish", label: "Publish" },
];

const STEP_ORDER: GeneratorStep[] = ["prompt", "outline", "generating", "images", "publish", "success"];

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

function selectSectionIndices(n: number): number[] {
  if (n <= 4) return Array.from({ length: n }, (_, i) => i);
  return [0.2, 0.45, 0.7, 0.9].map((pct) => Math.min(Math.floor(pct * n), n - 1));
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 flex items-start justify-between gap-3">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 text-red-700 border-red-300 hover:bg-red-100">
          Retry
        </Button>
      )}
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: GeneratorStep }) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((step, idx) => {
        const stepIdx = STEP_ORDER.indexOf(step.key);
        const isActive = step.key === currentStep;
        const isDone = stepIdx < currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              isActive ? "bg-blue-600 text-white" : isDone ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
            }`}>
              {isDone ? <CheckCircle2 className="h-3 w-3" /> : <span>{idx + 1}</span>}
              {step.label}
            </div>
            {idx < STEPS.length - 1 && <div className="h-px w-4 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Prompt ───────────────────────────────────────────────────────────

function PromptStep({
  initial,
  onSubmit,
}: {
  initial?: LeadMagnetPromptInput;
  onSubmit: (input: LeadMagnetPromptInput) => void;
}) {
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "general");
  const [targetAudience, setTargetAudience] = useState(initial?.targetAudience ?? "");
  const [keyTopicsText, setKeyTopicsText] = useState(initial?.keyTopics.join("\n") ?? "");
  const [tone, setTone] = useState<"educational" | "conversational" | "urgent">(initial?.tone ?? "educational");
  const [additionalContext, setAdditionalContext] = useState(initial?.additionalContext ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!topic.trim() || !targetAudience.trim()) {
      setError("Topic and target audience are required.");
      return;
    }
    const keyTopics = keyTopicsText.split("\n").map((t) => t.trim()).filter(Boolean);
    if (keyTopics.length === 0) {
      setError("Please enter at least one key topic.");
      return;
    }

    const input: LeadMagnetPromptInput = {
      topic: topic.trim(),
      category: category as LeadMagnetPromptInput["category"],
      targetAudience: targetAudience.trim(),
      keyTopics,
      tone,
      additionalContext: additionalContext.trim() || undefined,
    };

    setError(null);
    setLoading(true);
    try {
      const data = await postJson("/api/admin/lead-magnet-generator/generate-outline", { promptInput: input });
      onSubmit({ ...input, _outlineData: data.data } as unknown as LeadMagnetPromptInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Outline generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">New Lead Magnet</h2>
        <p className="text-sm text-muted-foreground">Describe the guide and let AI generate a complete outline.</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="topic">Guide topic *</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Final Expense Insurance for Seniors: The Complete Guide"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Category *</Label>
          <Select value={category} onValueChange={setCategory}>
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
          <Label htmlFor="targetAudience">Target audience *</Label>
          <Textarea
            id="targetAudience"
            rows={2}
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g. Adults 55–80 who have never purchased life insurance"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="keyTopics">Key topics to cover</Label>
          <p className="text-xs text-muted-foreground">One topic per line — list everything the guide must cover</p>
          <Textarea
            id="keyTopics"
            rows={5}
            value={keyTopicsText}
            onChange={(e) => setKeyTopicsText(e.target.value)}
            placeholder={"What final expense insurance covers\nHow premiums are calculated\nHow to choose a carrier"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Tone</Label>
          <div className="flex gap-3">
            {(["educational", "conversational", "urgent"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  tone === t ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="additionalContext">Additional context (optional)</Label>
          <Textarea
            id="additionalContext"
            rows={2}
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Any specific angle, regional focus, or things to avoid..."
          />
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={handleSubmit} />}

      <Button onClick={handleSubmit} disabled={loading} size="lg">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating outline...</> : "Generate Outline →"}
      </Button>
    </div>
  );
}

// ─── Step 2: Outline Review ───────────────────────────────────────────────────

function OutlineStep({
  outline,
  promptInput,
  onBack,
  onGenerate,
}: {
  outline: LeadMagnetOutline;
  promptInput: LeadMagnetPromptInput;
  onBack: () => void;
  onGenerate: (edited: LeadMagnetOutline) => void;
}) {
  const [title, setTitle] = useState(outline.title);
  const [subtitle, setSubtitle] = useState(outline.subtitle);
  const [benefits, setBenefits] = useState<string[]>(outline.keyBenefits);
  const [sections, setSections] = useState(outline.sections.map((s) => s.sectionTitle));

  function updateSection(idx: number, value: string) {
    setSections((prev) => prev.map((s, i) => (i === idx ? value : s)));
  }

  function addSection() {
    if (sections.length >= 8) return;
    setSections((prev) => [...prev, "New Section"]);
  }

  function removeSection(idx: number) {
    if (sections.length <= 4) return;
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleGenerate() {
    const editedOutline: LeadMagnetOutline = {
      ...outline,
      title: title.trim() || outline.title,
      subtitle: subtitle.trim() || outline.subtitle,
      keyBenefits: benefits.filter(Boolean),
      sections: sections
        .filter(Boolean)
        .map((title, i) => ({
          ...(outline.sections[i] ?? outline.sections[0]),
          sectionTitle: title,
        })),
    };
    onGenerate(editedOutline);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Review Outline</h2>
          <p className="text-sm text-muted-foreground">Edit the AI-generated outline before generating full content.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{outline.estimatedWordCount.toLocaleString()} words</Badge>
          <Badge variant="outline">~{outline.estimatedPages} pages</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Identity</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Guide title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
            <p className="text-xs text-muted-foreground text-right">{title.length}/80</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Subtitle</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={160} />
            <p className="text-xs text-muted-foreground text-right">{subtitle.length}/160</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Audience:</span> {outline.targetAudience}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Key Benefits</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {benefits.map((b, i) => (
            <Input key={i} value={b} onChange={(e) => setBenefits((prev) => prev.map((x, j) => j === i ? e.target.value : x))} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Sections ({sections.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={addSection}
              disabled={sections.length >= 8}
              className="text-xs"
            >
              + Add section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sections.map((title, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
              <Input value={title} onChange={(e) => updateSection(i, e.target.value)} className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSection(i)}
                disabled={sections.length <= 4}
                className="text-xs text-muted-foreground hover:text-red-600 shrink-0"
              >
                Remove
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">4–8 sections. Key points for each section will be preserved.</p>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>← Change prompt</Button>
        <Button onClick={handleGenerate} size="lg" className="flex-1">Generate Full Guide →</Button>
      </div>
    </div>
  );
}

// ─── Step 3: Section Generation ───────────────────────────────────────────────

function GeneratingStep({
  state,
  setState,
}: {
  state: GeneratorState;
  setState: React.Dispatch<React.SetStateAction<GeneratorState>>;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  const outline = state.outline!;
  const completedSections = state.completedSections ?? [];
  const currentIdx = state.currentSectionIndex ?? 0;
  const totalSections = outline.sections.length;
  const allSectionsDone = currentIdx >= totalSections;
  const generatingIntroConclusion = allSectionsDone && !state.generatedContent;

  useEffect(() => {
    if (state.step !== "generating") return;
    if (!state.outline || state.error) return;

    const completed = state.completedSections ?? [];
    const nextIdx = state.currentSectionIndex ?? 0;
    const total = state.outline.sections.length;

    if (nextIdx < total) {
      postJson("/api/admin/lead-magnet-generator/generate-section", {
        outline: state.outline,
        sectionIndex: nextIdx,
        completedSections: completed,
      })
        .then((data) => {
          const newSection: LeadMagnetSection = {
            ...state.outline!.sections[nextIdx],
            content: data.data.content,
            contentBlocks: data.data.contentBlocks,
            wordCount: data.data.wordCount,
          };
          setState((prev) => ({
            ...prev,
            completedSections: [...(prev.completedSections ?? []), newSection],
            currentSectionIndex: nextIdx + 1,
            error: undefined,
          }));
        })
        .catch((err) => {
          setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : "Section generation failed" }));
        });
    } else {
      postJson("/api/admin/lead-magnet-generator/generate-intro-conclusion", {
        generatedContent: { outline: state.outline, sections: completed },
      })
        .then((data) => {
          const generatedContent: GeneratedLeadMagnet = {
            outline: state.outline!,
            sections: completed,
            introduction: data.data.introduction,
            conclusion: data.data.conclusion,
            introductionBlocks: data.data.introductionBlocks,
            conclusionBlocks: data.data.conclusionBlocks,
          };
          setState((prev) => ({ ...prev, generatedContent, step: "images" }));
        })
        .catch((err) => {
          setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : "Intro/conclusion generation failed" }));
        });
    }
  }, [state.step, state.currentSectionIndex]);

  async function regenerateSection(idx: number) {
    if (!state.outline) return;
    setRegeneratingIdx(idx);
    try {
      const priorSections = completedSections.slice(0, idx);
      const data = await postJson("/api/admin/lead-magnet-generator/generate-section", {
        outline: state.outline,
        sectionIndex: idx,
        completedSections: priorSections,
      });
      const newSection: LeadMagnetSection = {
        ...state.outline.sections[idx],
        content: data.data.content,
        contentBlocks: data.data.contentBlocks,
        wordCount: data.data.wordCount,
      };
      setState((prev) => ({
        ...prev,
        completedSections: (prev.completedSections ?? []).map((s, i) => i === idx ? newSection : s),
        error: undefined,
      }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : "Regeneration failed" }));
    } finally {
      setRegeneratingIdx(null);
    }
  }

  const progressPct = totalSections > 0
    ? Math.min(100, Math.round((currentIdx / (totalSections + 1)) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Generating Guide Content</h2>
        <p className="text-sm text-muted-foreground">
          {allSectionsDone
            ? "Writing introduction and conclusion..."
            : `Generating section ${currentIdx + 1} of ${totalSections}...`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Progress value={progressPct} className="h-2" />
        <p className="text-xs text-muted-foreground text-right">{progressPct}%</p>
      </div>

      {state.error && (
        <ErrorBox
          message={state.error}
          onRetry={() => setState((prev) => ({ ...prev, error: undefined }))}
        />
      )}

      <div className="flex flex-col gap-2">
        {completedSections.map((section, i) => (
          <div key={i} className="border rounded-md overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 text-left"
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm font-medium">{section.sectionTitle}</span>
                {section.wordCount && (
                  <Badge variant="outline" className="text-xs">{section.wordCount} words</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); regenerateSection(i); }}
                  disabled={regeneratingIdx !== null}
                >
                  {regeneratingIdx === i
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RotateCcw className="h-3 w-3" />}
                </Button>
                {expandedIdx === i ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </button>
            {expandedIdx === i && section.content && (
              <div className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap font-mono text-xs max-h-64 overflow-y-auto">
                {section.content}
              </div>
            )}
          </div>
        ))}

        {(currentIdx < totalSections || generatingIntroConclusion) && !state.error && (
          <div className="flex items-center gap-3 px-4 py-3 border rounded-md bg-blue-50 border-blue-100">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
            <span className="text-sm text-blue-700">
              {allSectionsDone
                ? "Writing introduction and conclusion..."
                : `Writing section ${currentIdx + 1}: ${outline.sections[currentIdx]?.sectionTitle ?? ""}...`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: Images ───────────────────────────────────────────────────────────

function ImagesStep({
  state,
  setState,
  onBack,
  onContinue,
}: {
  state: GeneratorState;
  setState: React.Dispatch<React.SetStateAction<GeneratorState>>;
  onBack: () => void;
  onContinue: (images: LeadMagnetImages) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [imageWarnings, setImageWarnings] = useState<string[]>([]);

  const images = state.images;
  const outline = state.outline!;
  const sectionIndices = selectSectionIndices(outline.sections.length);

  useEffect(() => {
    if (state.step !== "images" || state.images) return;
    generateImages();
  }, [state.step]);

  async function generateImages() {
    setGenerating(true);
    setImageWarnings([]);
    setState((prev) => ({ ...prev, error: undefined }));
    try {
      const data = await postJson("/api/admin/lead-magnet-generator/generate-images", { outline });
      setState((prev) => ({ ...prev, images: data.data }));
      if (data.warnings?.length) setImageWarnings(data.warnings);
    } catch (err) {
      setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : "Image generation failed" }));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Guide Images</h2>
          <p className="text-sm text-muted-foreground">AI-generated visuals for the cover and key sections.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
      </div>

      {generating && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Generating images with AI (this takes ~30 seconds)...</p>
        </div>
      )}

      {state.error && !generating && (
        <ErrorBox message={state.error} onRetry={generateImages} />
      )}

      {imageWarnings.length > 0 && !generating && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 flex flex-col gap-1">
          <p className="text-sm font-medium text-yellow-800">Image generation warnings:</p>
          {imageWarnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-700">{w}</p>
          ))}
        </div>
      )}

      {images && !generating && (
        <div className="flex flex-col gap-4">
          {/* Cover image */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Cover Image</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={generateImages} disabled={generating}>
                  <RotateCcw className="h-3 w-3 mr-1" />Regenerate all
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {images.coverImage ? (
                <img
                  src={images.coverImage}
                  alt="Guide cover"
                  className="w-full max-h-48 object-cover rounded-md"
                />
              ) : (
                <div className="w-full h-32 bg-muted rounded-md flex items-center justify-center text-sm text-muted-foreground">
                  Generation failed
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section images */}
          {images.sectionImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Section Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {images.sectionImages.map((url, i) => {
                    const sectionIdx = sectionIndices[i];
                    const sectionTitle = outline.sections[sectionIdx]?.sectionTitle ?? `Section ${sectionIdx + 1}`;
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        {url ? (
                          <img src={url} alt={sectionTitle} className="w-full aspect-square object-cover rounded-md" />
                        ) : (
                          <div className="w-full aspect-square bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
                            Failed
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground truncate">{sectionTitle}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" size="sm" onClick={() => onContinue(images ?? { coverImage: "", sectionImages: [] })}>
          Skip Images
        </Button>
        <Button
          onClick={() => onContinue(images ?? { coverImage: "", sectionImages: [] })}
          disabled={generating}
          size="lg"
          className="flex-1"
        >
          Continue to Publish →
        </Button>
      </div>
    </div>
  );
}

// ─── Step 5: Publish ──────────────────────────────────────────────────────────

function PublishStep({
  state,
  setState,
  onBack,
  onReset,
}: {
  state: GeneratorState;
  setState: React.Dispatch<React.SetStateAction<GeneratorState>>;
  onBack: () => void;
  onReset: () => void;
}) {
  const outline = state.outline!;
  const generatedContent = state.generatedContent!;

  const [title, setTitle] = useState(outline.title);
  const [subtitle, setSubtitle] = useState(outline.subtitle);
  const [metaTitle, setMetaTitle] = useState(outline.title.slice(0, 60));
  const [metaDescription, setMetaDescription] = useState(outline.subtitle.slice(0, 160));
  const [focusKeyword, setFocusKeyword] = useState(outline.sections[0]?.keyPoints[0] ?? "");
  const [ctaHeadline, setCtaHeadline] = useState("Get Your Free Guide");
  const [ctaSubtext, setCtaSubtext] = useState("Enter your info below to download instantly — no spam, ever.");
  const [ctaButtonText, setCtaButtonText] = useState("Download Free Guide");
  const [successMessage, setSuccessMessage] = useState("Your guide is downloading now!");
  const [publishStatus, setPublishStatus] = useState<"draft" | "published">("draft");

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const pdfUrl = state.pdfUrl;

  async function handleGeneratePdf() {
    if (!state.images) return;
    setGeneratingPdf(true);
    setPdfError(null);
    try {
      const data = await postJson("/api/admin/lead-magnet-generator/generate-pdf", {
        generatedContent,
        images: state.images,
        outline,
      });
      setState((prev) => ({ ...prev, pdfUrl: data.data.pdfUrl, pageCount: data.data.pageCount }));
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "PDF generation failed");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handlePublish() {
    if (!pdfUrl || !state.images || !state.promptInput) return;
    setPublishing(true);
    setPublishError(null);

    const updatedOutline: LeadMagnetOutline = {
      ...outline,
      title: title.trim() || outline.title,
      subtitle: subtitle.trim() || outline.subtitle,
    };

    try {
      const data = await postJson("/api/admin/lead-magnet-generator/publish", {
        outline: updatedOutline,
        generatedContent: { ...generatedContent, outline: updatedOutline },
        images: state.images,
        pdfUrl,
        status: publishStatus,
        originalPromptInput: state.promptInput,
      });
      setState((prev) => ({ ...prev, publishedResult: data.data, step: "success" }));
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Publish Guide</h2>
          <p className="text-sm text-muted-foreground">Review metadata, generate the PDF, then save to Sanity.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Metadata</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Guide title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Subtitle</Label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={160} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <Label>SEO meta title</Label>
              <span className={`text-xs ${metaTitle.length > 60 ? "text-red-600" : "text-muted-foreground"}`}>{metaTitle.length}/60</span>
            </div>
            <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
              <Label>SEO meta description</Label>
              <span className={`text-xs ${metaDescription.length > 160 ? "text-red-600" : metaDescription.length < 120 ? "text-amber-600" : "text-muted-foreground"}`}>
                {metaDescription.length}/160
              </span>
            </div>
            <Textarea rows={2} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Focus keyword</Label>
            <Input value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Lead form */}
      <Card>
        <CardHeader><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Lead Form Settings</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>CTA headline</Label>
            <Input value={ctaHeadline} onChange={(e) => setCtaHeadline(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>CTA subtext</Label>
            <Textarea rows={2} value={ctaSubtext} onChange={(e) => setCtaSubtext(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Button text</Label>
            <Input value={ctaButtonText} onChange={(e) => setCtaButtonText(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Success message</Label>
            <Input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* PDF */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              PDF {state.pageCount ? `(~${state.pageCount} pages)` : ""}
            </CardTitle>
            {pdfUrl && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={handleGeneratePdf} disabled={generatingPdf}>
                <RotateCcw className="h-3 w-3 mr-1" />Regenerate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!pdfUrl && !generatingPdf && (
            <Button onClick={handleGeneratePdf} variant="outline" className="w-full">
              Generate PDF
            </Button>
          )}
          {generatingPdf && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Assembling PDF (15–40 seconds)...</span>
            </div>
          )}
          {pdfError && <ErrorBox message={pdfError} onRetry={handleGeneratePdf} />}
          {pdfUrl && !generatingPdf && (
            <iframe src={pdfUrl} className="w-full h-96 rounded border" title="PDF preview" />
          )}
        </CardContent>
      </Card>

      {/* Publish status */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Save as:</span>
        <Button
          variant={publishStatus === "draft" ? "default" : "outline"}
          size="sm"
          onClick={() => setPublishStatus("draft")}
        >
          Draft
        </Button>
        <Button
          variant={publishStatus === "published" ? "default" : "outline"}
          size="sm"
          onClick={() => setPublishStatus("published")}
        >
          Publish Now
        </Button>
      </div>

      {publishError && <ErrorBox message={publishError} onRetry={handlePublish} />}

      <Button
        onClick={handlePublish}
        disabled={publishing || !pdfUrl}
        size="lg"
        title={!pdfUrl ? "Generate the PDF first" : undefined}
      >
        {publishing
          ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving to Sanity...</>
          : "Save to Sanity →"}
      </Button>

      {!pdfUrl && (
        <p className="text-xs text-muted-foreground text-center">Generate the PDF before publishing.</p>
      )}
    </div>
  );
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessView({
  result,
  publishStatus,
  onReset,
}: {
  result: PublishedLeadMagnet;
  publishStatus: "draft" | "published";
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <h2 className="text-xl font-semibold">
          Lead magnet {publishStatus === "published" ? "published" : "saved as draft"} in Sanity
        </h2>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Sanity Studio</p>
            <a
              href={`/studio/structure/leadMagnet;${result.sanityDocumentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              View in Sanity Studio →
            </a>
          </div>

          {publishStatus === "published" && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Public landing page</p>
              <a
                href={result.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                {result.publicUrl}
              </a>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">PDF</p>
            <a
              href={result.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              Download PDF →
            </a>
          </div>

          <Button onClick={onReset} variant="outline" className="w-fit">
            Generate Another Guide
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadMagnetGeneratorPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<GeneratorState>({ step: "prompt" });

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

  function reset() {
    setState({ step: "prompt" });
  }

  function handlePromptSubmit(input: LeadMagnetPromptInput & { _outlineData?: LeadMagnetOutline }) {
    const { _outlineData, ...cleanInput } = input as LeadMagnetPromptInput & { _outlineData?: LeadMagnetOutline };
    setState((prev) => ({
      ...prev,
      step: "outline",
      promptInput: cleanInput,
      outline: _outlineData,
    }));
  }

  function handleOutlineGenerate(editedOutline: LeadMagnetOutline) {
    setState((prev) => ({
      ...prev,
      outline: editedOutline,
      step: "generating",
      completedSections: [],
      currentSectionIndex: 0,
      error: undefined,
    }));
  }

  function handleImagesContinue(images: LeadMagnetImages) {
    setState((prev) => ({ ...prev, images, step: "publish" }));
  }

  const publishStatus = state.step === "success" && state.publishedResult
    ? (state.outline?.title ? "draft" : "draft")
    : "draft";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Lead Magnet Generator</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate a complete branded PDF guide in minutes using AI.
        </p>
      </div>

      {state.step !== "success" && <StepIndicator currentStep={state.step} />}

      {state.step === "prompt" && (
        <PromptStep
          initial={state.promptInput}
          onSubmit={handlePromptSubmit}
        />
      )}

      {state.step === "outline" && state.outline && state.promptInput && (
        <OutlineStep
          outline={state.outline}
          promptInput={state.promptInput}
          onBack={() => setState((prev) => ({ ...prev, step: "prompt" }))}
          onGenerate={handleOutlineGenerate}
        />
      )}

      {state.step === "generating" && state.outline && (
        <GeneratingStep state={state} setState={setState} />
      )}

      {state.step === "images" && state.outline && state.generatedContent && (
        <ImagesStep
          state={state}
          setState={setState}
          onBack={() => setState((prev) => ({ ...prev, step: "generating" }))}
          onContinue={handleImagesContinue}
        />
      )}

      {state.step === "publish" && state.outline && state.generatedContent && state.images && (
        <PublishStep
          state={state}
          setState={setState}
          onBack={() => setState((prev) => ({ ...prev, step: "images" }))}
          onReset={reset}
        />
      )}

      {state.step === "success" && state.publishedResult && (
        <SuccessView
          result={state.publishedResult}
          publishStatus="draft"
          onReset={reset}
        />
      )}
    </div>
  );
}
