# Lead Magnet Generator — Phase 7 Spec

## Context

This is Phase 7 of an 8-phase feature that generates professional PDF guides behind email-gated landing pages.

**Phases 1–6 (complete):** Data model, AI outline, AI sections, AI images, PDF generation, Sanity publishing — the full backend pipeline exists.

**Phase 7 (this doc):** Admin generator UI — a multi-step wizard page at `/admin/lead-magnet-generator/` that drives the entire pipeline through the UI, with live progress, editing, and one-click publish to Sanity.

**Remaining phases:**
- Phase 8: Public landing page + lead capture

---

## Phase 7: Admin Generator UI

### Goal

Build the admin generator page that walks through the 6 generation steps in sequence. The admin types a prompt, reviews the outline, watches sections generate in real time, manages images, previews the PDF, and publishes to Sanity — all without leaving the page. This page mirrors the blog generator (`app/[locale]/admin/blog-generator/page.tsx`) in structure and patterns.

### What to Build

1. **`app/[locale]/admin/lead-magnet-generator/page.tsx`** — the complete multi-step generator UI (Client Component, `"use client"`)

No new API routes in this phase — the UI calls the 6 routes already built in Phases 2–6.

---

### Page Structure

The page is a single Client Component that manages a `GeneratorState` and renders one step at a time. The overall shell renders:
- Step indicator (1–5 breadcrumb at top: Prompt → Outline → Generate → Images → Publish)
- Current step content
- Back button where applicable

```tsx
"use client";

export default function LeadMagnetGeneratorPage() {
  const { isSignedIn, isLoaded } = useAuth();
  // redirect to sign-in if not authenticated
  
  const [state, setState] = useState<GeneratorState>({ step: "prompt" });

  return (
    <div className="max-w-4xl mx-auto p-8">
      <StepIndicator currentStep={state.step} />
      {state.step === "prompt" && <PromptStep ... />}
      {state.step === "outline" && <OutlineStep ... />}
      {state.step === "generating" && <GeneratingStep ... />}
      {state.step === "images" && <ImagesStep ... />}
      {state.step === "publish" && <PublishStep ... />}
    </div>
  );
}
```

---

### State Model

```ts
type GeneratorStep = "prompt" | "outline" | "generating" | "images" | "publish";

interface GeneratorState {
  step: GeneratorStep;
  // populated progressively as generation completes:
  promptInput?: LeadMagnetPromptInput;
  outline?: LeadMagnetOutline;
  completedSections?: LeadMagnetSection[];
  currentSectionIndex?: number;
  generatedContent?: GeneratedLeadMagnet;
  images?: LeadMagnetImages;
  pdfUrl?: string;
  publishedResult?: PublishedLeadMagnet;
  error?: string;
}
```

Use `useState<GeneratorState>` — a single state object updated immutably (`setState(prev => ({ ...prev, ... }))`).

---

### Step 1: Prompt Input

**Component:** Inline within page or extracted as `PromptStep`

**Fields:**
```
Topic title (text input, required)
  Placeholder: "e.g. Final Expense Insurance for Seniors: The Complete Guide"

Category (select dropdown — same options as blog category)
  Default: "general"

Target audience (textarea, required)
  Placeholder: "e.g. Adults 55–80 who have never purchased life insurance"

Key topics to cover (textarea)
  Instruction: "One topic per line — list everything the guide must cover"
  Placeholder: "What final expense insurance covers\nHow premiums are calculated..."

Tone (radio buttons: Educational / Conversational / Urgent)
  Default: "educational"

Additional context (textarea, optional)
  Placeholder: "Any specific angle, regional focus, or things to avoid..."
```

**Submit button:** "Generate Outline →"

**On submit:**
1. Validate required fields (topic, category, targetAudience)
2. Parse `keyTopics` textarea into `string[]` (split by newline, trim, filter empty)
3. Build `LeadMagnetPromptInput`
4. Set `state.step = "outline"` and `state.promptInput = input` — show loading state
5. `POST /api/admin/lead-magnet-generator/generate-outline` with `{ promptInput }`
6. On success: `setState({ ...state, step: "outline", outline: data })`
7. On error: display error inline with retry option

---

### Step 2: Outline Review

**Component:** `OutlineStep`

**UI:**
- Editable title (text input, pre-filled from AI)
- Editable subtitle (text input)
- Target audience (read-only label)
- Key benefits (5 editable text inputs — one per benefit)
- Sections list: each section shows editable `sectionTitle` + read-only key points preview
  - "Add section" button (max 8 sections)
  - "Remove" button per section (min 4 sections)
- Estimated word count + pages (read-only badge)

**Buttons:**
- "← Change prompt" (back to Step 1 with `promptInput` pre-filled)
- "Generate Full Guide →" (advances to Step 3)

**On "Generate Full Guide":**
- Persist edited outline into state: `setState({ ...state, outline: editedOutline, step: "generating", completedSections: [], currentSectionIndex: 0 })`
- Immediately trigger first section generation (Step 3 auto-starts)

---

### Step 3: Section Generation Progress

**Component:** `GeneratingStep`

This step runs automatically — the user watches progress but does not click to advance each section.

**UI:**
- Progress bar: `"Generating section {currentSectionIndex + 1} of {outline.sections.length}..."`
- Each completed section appears below as a collapsible card:
  - Section title + word count badge
  - Collapsed by default; click to expand and read content
  - "Regenerate" button per completed section
- After all sections: loading state "Writing introduction and conclusion..."
- After intro/conclusion: auto-advances to Step 4

**Generation loop (runs in `useEffect` when `step === "generating"`):**

```ts
useEffect(() => {
  if (state.step !== "generating") return;
  if (!state.outline || !state.completedSections) return;

  const totalSections = state.outline.sections.length;
  const nextIndex = state.currentSectionIndex ?? 0;

  if (nextIndex < totalSections) {
    // generate next section
    generateSection(state.outline, nextIndex, state.completedSections)
      .then((sectionData) => {
        const updatedSections = [
          ...state.completedSections!,
          { ...state.outline!.sections[nextIndex], ...sectionData },
        ];
        setState((prev) => ({
          ...prev,
          completedSections: updatedSections,
          currentSectionIndex: nextIndex + 1,
        }));
      })
      .catch((err) => setState((prev) => ({ ...prev, error: err.message })));
  } else {
    // all sections done — generate intro/conclusion
    generateIntroConclusion({
      outline: state.outline,
      sections: state.completedSections,
    } as GeneratedLeadMagnet)
      .then((introConclusionData) => {
        const generatedContent: GeneratedLeadMagnet = {
          outline: state.outline!,
          sections: state.completedSections!,
          ...introConclusionData,
        };
        setState((prev) => ({ ...prev, generatedContent, step: "images" }));
        // auto-trigger image generation when advancing to step 4
      });
  }
}, [state.step, state.currentSectionIndex]);
```

**Regenerate section:**
- Clicking "Regenerate" on a completed section calls `POST /api/admin/lead-magnet-generator/generate-section` again
- Replaces the section at that index in `completedSections`

**Error handling:**
- If a section fails, show the error inline with "Retry" button — do not clear completed sections

---

### Step 4: Image Management

**Component:** `ImagesStep`

**Auto-starts image generation** when entering this step (`useEffect` on `step === "images"` with no images yet).

**UI:**
- Loading state: "Generating images..." (spinner)
- After generation:
  - Cover image preview (large card, full width)
    - "Regenerate" button
    - "Upload custom image" button (file input → upload to Cloudinary via existing upload flow)
  - Section images (grid of 3–4 small cards)
    - Each shows the section title it belongs to
    - "Regenerate" button per image
    - Empty images show a placeholder with "Generation failed" message
- "Skip Images" link — advance to Step 5 without images
- "Continue to PDF →" button

**On "Continue to PDF →":**
- `setState({ ...state, step: "publish", images: currentImages })`
- PDF generation is triggered in Step 5, not here

---

### Step 5: Publish

**Component:** `PublishStep`

**UI sections:**

**Metadata panel (editable):**
```
Guide title (text input)
Subtitle (text input)
SEO meta title (text input, 60 char counter)
SEO meta description (textarea, 120–160 char counter)
Focus keyword (text input)
```

**Lead form settings panel:**
```
CTA headline (text input, default "Get Your Free Guide")
CTA subtext (textarea)
Button text (text input, default "Download Free Guide")
Success message (text input)
```

**Status toggle:**
```
○ Save as Draft    ● Publish Now
```

**PDF panel:**
- If no `pdfUrl` yet: "Generate PDF" button with loading state
- If `pdfUrl` exists: PDF preview via `<iframe src={pdfUrl} className="w-full h-96" />` + "Regenerate PDF" button

**Publish button:** "Save to Sanity →"

**On "Generate PDF":**
1. `POST /api/admin/lead-magnet-generator/generate-pdf` with `{ generatedContent, images, outline }`
2. On success: set `state.pdfUrl = data.pdfUrl`

**On "Save to Sanity":**
1. `POST /api/admin/lead-magnet-generator/publish` with complete payload
2. On success: show success state with links:
   - "View in Sanity Studio →" (deep link to the Sanity document)
   - "View public landing page →" (if published: link to `/lead-magnets/{slug}`)
   - "Generate another guide" (reset state to Step 1)

---

### Shared UI Patterns

**Loading states:** Use the same spinner pattern as the blog generator — a centered spinner with a descriptive text label below it.

**Error display:** Inline red alert box below the triggering button. Include the error message and a "Retry" button that re-calls the same API. Do not navigate away on error.

**Character counters:** For SEO fields, show `{current}/{max}` below the input, red when over limit. Same pattern as blog generator SEO fields.

**Back navigation:** Each step shows a "← Back" button that returns to the previous step WITHOUT clearing the current step's data — so the user can go back, review, and return without re-generating.

---

### File Structure After Phase 7

```
app/
  [locale]/
    admin/
      lead-magnet-generator/
        page.tsx           ← NEW (entire multi-step wizard)
      blog-generator/
        page.tsx           ← unchanged (reference for patterns)
```

No new API routes. No new component files (keep all step components inline or as local sub-components in the same file — do not extract to `components/` unless they exceed 200 lines individually).

---

### Success Criteria

Phase 7 is complete when:

1. Navigating to `/en/admin/lead-magnet-generator` (authenticated) renders the prompt input form
2. Submitting a valid prompt navigates to the Outline step with all AI-generated fields editable
3. Clicking "Generate Full Guide" auto-generates all sections sequentially — progress bar advances with each completion
4. Each completed section card is collapsible and has a working Regenerate button
5. After all sections + intro/conclusion: auto-advances to Images step and starts image generation
6. Images step shows the cover + section image previews with Regenerate buttons
7. Publish step allows PDF generation, shows iframe PDF preview, and has all metadata fields editable
8. "Save to Sanity" creates a real `leadMagnet` document in Sanity Studio (verify in Studio)
9. An unauthenticated visit redirects to sign-in
10. The page compiles without TypeScript errors: `pnpm tsc --noEmit`

---

## References

**Files to read before implementing:**
- `app/[locale]/admin/blog-generator/page.tsx` — the primary reference; replicate its state management pattern, loading state components, error display, section layout, and step-by-step flow
- `lib/lead-magnet-generator/types.ts` — all types imported in the page: `LeadMagnetPromptInput`, `LeadMagnetOutline`, `LeadMagnetSection`, `GeneratedLeadMagnet`, `LeadMagnetImages`, `PublishedLeadMagnet`
- Existing blog generator API route paths — the lead magnet routes follow the same `/api/admin/lead-magnet-generator/` prefix pattern
- `components/ui/` — existing shadcn/ui components to use: `Button`, `Input`, `Textarea`, `Select`, `Card`, `Progress`, `Badge`
