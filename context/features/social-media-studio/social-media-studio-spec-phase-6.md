# Social Media Content Studio — Phase 6 Spec

## Context

Phases 1–5 built the complete backend: data model, source API, AI copy generator, AI image generator, and video script generator.

**Phase 6 (this doc):** Admin UI Wizard — a multi-step page at `/en/admin/social-media-studio/` that lets Isaac go from picking a content source to having a complete, copy-paste-ready social media package in under 5 minutes. This page mirrors the lead magnet generator page in structure and state management patterns.

**Remaining phases:** Phase 7 (Sanity publish + history).

---

## Phase 6: Admin UI Wizard

### Goal

Build the admin generator page as a single Client Component with 5 sequential steps:

1. **Source Picker** — search and select a blog post or lead magnet, or enter a topic directly
2. **Copy Review** — view and edit generated copy per platform + language, with copy buttons
3. **Image Studio** — preview branded images, regenerate or toggle source/AI background
4. **Video Script** — view and copy the 30s/60s video script
5. **Export + Save** — final copy-everything screen with optional Sanity save

No new API routes in this phase. The UI calls routes built in Phases 2–5.

### What to Build

1. **`app/[locale]/admin/social-media-studio/page.tsx`** — the complete multi-step wizard (Client Component, `"use client"`)

All step sub-components are defined inline in the same file or as local function components in the same file. Do not extract to `components/` unless a single component exceeds 200 lines individually.

---

### Page Structure

```tsx
"use client";

export default function SocialMediaStudioPage() {
  const { isSignedIn, isLoaded } = useAuth();
  // redirect to /sign-in if not authenticated after loaded

  const [state, setState] = useState<StudioState>({ step: "source" });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Social Media Content Studio</h1>
        <p className="text-gray-500 text-sm">Generate a complete post package from any blog post or guide.</p>
      </header>
      <StepIndicator currentStep={state.step} />
      {state.step === "source"  && <SourcePickerStep state={state} setState={setState} />}
      {state.step === "copy"    && <CopyReviewStep   state={state} setState={setState} />}
      {state.step === "images"  && <ImageStudioStep  state={state} setState={setState} />}
      {state.step === "script"  && <VideoScriptStep  state={state} setState={setState} />}
      {state.step === "export"  && <ExportStep       state={state} setState={setState} />}
    </div>
  );
}
```

---

### State Model

```ts
type StudioStep = "source" | "copy" | "images" | "script" | "export";

interface StudioState {
  step: StudioStep;

  // Step 1 output
  source?: SocialPostSource;

  // Step 2 output — copies can be edited by user
  copies?: SocialPostCopy[];
  isGeneratingCopy?: boolean;
  copyError?: string;

  // Step 3 output
  images?: SocialCreativeImages;
  isGeneratingImages?: boolean;
  imageError?: string;

  // Step 4 output
  videoScript?: VideoScript;
  scriptDuration?: 30 | 60;
  isGeneratingScript?: boolean;
  scriptError?: string;

  // Step 5
  savedResult?: PublishedSocialPost;
}
```

Use `useState<StudioState>` — a single state object updated immutably: `setState(prev => ({ ...prev, ... }))`.

---

### Step 1: Source Picker

**Purpose:** Let Isaac find an existing blog post or lead magnet to use as source, or type a topic directly.

**UI layout:**

```
[Blog Post] [Lead Magnet] [Direct Topic]   ← tab switcher

--- Blog Post / Lead Magnet tab ---
Search: [_______________] [Search]

Results list (card per result):
┌─────────────────────────────────────────────────────┐
│ [thumbnail 64×64]  Title of the Blog Post           │
│                    Category badge · Published date  │
│                               [Select →]            │
└─────────────────────────────────────────────────────┘

--- Direct Topic tab ---
Topic/Title:       [_________________________________]
Category:          [dropdown — same options as blog generator]
Brief description: [textarea — what should this post cover?]
CTA link:          [optional — e.g. https://isaacplans.com/...]

[Generate Post Package →]
```

**Source picker behavior:**
- On tab switch: clear the results list
- Typing in search box: debounce 400ms → `GET /api/admin/social-media-studio/sources?q={term}`
- Loading state: show skeleton cards while fetching
- Clicking "Select →" on a result card:
  1. Show loading overlay: "Loading content..."
  2. `GET /api/admin/social-media-studio/sources/{type}/{id}`
  3. On success: store `source` in state
  4. Auto-trigger copy generation: `POST /api/admin/social-media-studio/generate-copy` with the fetched source
  5. Advance to Step 2 immediately (show generating spinner while copy generates)
  6. On error: show inline error with retry

**Direct Topic behavior:**
- On submit: build a `SocialPostSource` from form fields directly (no API call for source fetching)
- Then trigger copy generation and advance to Step 2

---

### Step 2: Copy Review

**Purpose:** Review and edit the AI-generated copy for each platform and language before using it.

**UI layout:**

```
Source: "Understanding Final Expense Insurance"  [Change source]

Language:  [EN]  [ES]   ← toggle — switches all platform views simultaneously

Platform tabs:
[Facebook] [Instagram] [TikTok] [Threads] [Google Business]

Per-platform view:
┌─────────────────────────────────────────────────────────────────┐
│  HOOK                                                   [Copy]  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Most people don't discover the gaps in their...         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  BODY                                                   [Copy]  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Final expense insurance is designed for one purpose...  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  CALL TO ACTION                                         [Copy]  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Comment 'INFO' below and I'll send you the details.     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  HASHTAGS (drag to reorder)                                      │
│  [#FinalExpense ×] [#LifeInsurance ×] [#InsuranceTips ×] [+]   │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  FULL POST PREVIEW                           [Copy Full Post]   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Most people don't discover...                           │   │
│  │                                                         │   │
│  │ Final expense insurance...                              │   │
│  │                                                         │   │
│  │ Comment 'INFO' below...                                 │   │
│  │                                                         │   │
│  │ #FinalExpense #LifeInsurance #InsuranceTips             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            Characters: 512 / 600               │
└─────────────────────────────────────────────────────────────────┘

[Regenerate All ↺]          [← Back]    [Continue to Images →]
```

**Copy editing behavior:**
- All textareas are editable — user changes are saved to `state.copies` immediately
- Character counter updates live as user types; turns red when over platform limit
- "Copy" button per field: copies that field's text to clipboard (shows checkmark for 2 seconds)
- "Copy Full Post" button: copies the assembled `fullPost` string
- Hashtag pills: click `×` to remove; click `[+]` to add a new one via small inline input
- "Regenerate All ↺": re-calls `POST /api/admin/social-media-studio/generate-copy`, overwrites current copies (with a confirm dialog: "Regenerate will overwrite your edits. Continue?")

**When arriving at Step 2:**
- If `state.isGeneratingCopy === true`: show centered spinner + "Generating your social media copy for all 5 platforms..."
- When copy arrives: replace spinner with the full editor UI
- If `state.copyError` is set: show error card with retry button

---

### Step 3: Image Studio

**Purpose:** Preview branded creative images and optionally regenerate them.

**Auto-starts image generation on entering Step 3** using a `useEffect` that checks `!state.images && !state.isGeneratingImages`.

**UI layout:**

```
Image Headline (text used as overlay):
[Understanding Final Expense Insurance         ]  [Shorten ✎]
(The headline defaults to source.title; user can edit before generating)

[Use source image as background]  [Generate new AI image]  ← radio/toggle

─────────────────────────────────────────────────────

Loading state: Generating your branded creatives... (spinner)

After generation:
┌─────────────────────────────────┬───────────────────────────────┐
│        SQUARE (1:1)             │       VERTICAL (9:16)          │
│    Facebook · Instagram         │   Stories · TikTok · Reels     │
│                                 │                                 │
│    [image preview 300×300]      │  [image preview 170×300]       │
│                                 │                                 │
│    [Download 1:1]               │  [Download 9:16]               │
└─────────────────────────────────┴───────────────────────────────┘

[Regenerate Images ↺]   ← re-calls generate-images with current headline

[← Back to Copy]                              [Continue to Script →]
                                              or [Skip Script → Export]
```

**Behavior:**
- "Shorten" button: triggers a quick GPT call (inline, not a new phase) to suggest a 5-7 word version of the headline — show 3 options as clickable chips, selecting one updates the headline input
- "Use source image" vs "Generate new AI image": passes `generateNew: false` or `true` to the generate-images route
- "Regenerate Images": re-calls the route with the current `imageHeadline` and current background setting
- Download buttons: open the Cloudinary URL in a new tab (browser downloads automatically with right-click-save, or use an `<a href download>` with a proxy fetch for actual forced download)
- If `square` or `vertical` are empty (generation failed): show a gray placeholder card with "Image generation failed" and a "Retry" button

---

### Step 4: Video Script

**Purpose:** Generate and view the TikTok/Reel script. This step is optional — a "Skip to Export" button is available.

**Auto-starts script generation on entering Step 4** if `state.videoScript` is null and `state.isGeneratingScript` is false.

**UI layout:**

```
Script Duration:  ○ 30 seconds  ● 60 seconds
                  [Regenerate for selected duration ↺]

─────────────────────────────────────────────────────

Loading: Generating your video script... (spinner)

After generation:

HOOK (first 5 seconds)              [Copy Hook]
┌──────────────────────────────────────────────────────┐
│ Your family shouldn't have to worry about...         │
└──────────────────────────────────────────────────────┘

FULL SCRIPT                         [Copy Full Script]
┌──────────────────────────────────────────────────────┐
│ [0:00–0:05] Your family shouldn't have to worry...   │
│                                                      │
│ [0:05–0:20] Most people don't realize that funeral   │
│ costs average $12,000 — and that's money your...     │
│ ...                                                  │
└──────────────────────────────────────────────────────┘

ON-SCREEN TEXT SUGGESTIONS
• HOOK: 'Average Funeral Cost: $12,000'
• PROBLEM: '56% of Americans have no life insurance'
• CTA: 'Comment FINAL for a free quote'

B-ROLL IDEAS
• Close-up of hands holding insurance documents
• Text notification showing '$12,000' on a phone
• Elderly couple sitting peacefully on a porch

DELIVERY TIPS
Pause for 1 second after 'grieving' in the hook. Slow
down when saying '$12,000' for emphasis.

SUGGESTED CAPTION               [Copy Caption]
┌──────────────────────────────────────────────────────┐
│ Don't let your family face this alone. Comment       │
│ 'FINAL' for a free quote. #FinalExpense #Insurance   │
└──────────────────────────────────────────────────────┘

[← Back]              [Skip to Export]    [Continue to Export →]
```

**Duration toggle behavior:**
- Switching duration does NOT auto-regenerate — user must click "Regenerate for selected duration" to explicitly regenerate with the new duration
- This prevents accidental overwrites and unnecessary API calls

---

### Step 5: Export + Save

**Purpose:** Final step where all assets are available for copy-pasting into Metricool or downloading. Optionally save the package to Sanity for history.

**UI layout:**

```
✅ Your social media package is ready!

SOURCE: Understanding Final Expense Insurance  [Blog Post]

─────────── PLATFORM COPY ───────────────────────────────

Platform tabs: [Facebook] [Instagram] [TikTok] [Threads] [Google Business]
Language:      [EN] [ES]

[Full post text shown read-only]         [Copy for Metricool]

─────────────────────────────────────────────────────────

IMAGES
┌───────────────────────┬───────────────────────┐
│  Square (1:1)         │  Vertical (9:16)       │
│  [preview thumbnail]  │  [preview thumbnail]   │
│  [Download]           │  [Download]            │
└───────────────────────┴───────────────────────┘

─────────────────────────────────────────────────────────

VIDEO SCRIPT                          [Copy Script]
[Hook only, truncated — click to expand]

─────────────────────────────────────────────────────────

SAVE TO SANITY (optional)
Status: ○ Save as Draft   ● Mark as Published
Tags:   [_______________] + add tag

[Save to Sanity →]

─────────────────────────────────────────────────────────

[Generate Another Post]    [← Back to Script]
```

**"Copy for Metricool" button:**
- Copies the `fullPost` string for the selected platform + locale
- Shows a green checkmark toast: "Copied! Paste directly into Metricool"

**Download images:**
- `<a href={imageUrl} target="_blank" rel="noopener">Download</a>` — opens in new tab; user saves from browser
- For mobile-friendly download: fetch the image server-side and return as blob (optional enhancement)

**Save to Sanity:**
- Calls `POST /api/admin/social-media-studio/publish` (Phase 7)
- On success: show a success banner with a link to the Sanity Studio record
- On failure: show inline error, keep the form so user can retry

**"Generate Another Post":**
- Resets state to `{ step: "source" }` — clears everything and returns to Step 1

---

### Step Indicator

```tsx
const STEPS: Array<{ key: StudioStep; label: string }> = [
  { key: "source",  label: "Source"  },
  { key: "copy",    label: "Copy"    },
  { key: "images",  label: "Images"  },
  { key: "script",  label: "Script"  },
  { key: "export",  label: "Export"  },
];

function StepIndicator({ currentStep }: { currentStep: StudioStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className={cn(
            "flex items-center gap-1.5 text-sm font-medium",
            i < currentIndex  && "text-green-600",
            i === currentIndex && "text-blue-600",
            i > currentIndex  && "text-gray-400"
          )}>
            <span className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border",
              i < currentIndex  && "bg-green-100 border-green-500 text-green-700",
              i === currentIndex && "bg-blue-100 border-blue-500 text-blue-700",
              i > currentIndex  && "bg-gray-100 border-gray-300 text-gray-500"
            )}>
              {i < currentIndex ? "✓" : i + 1}
            </span>
            {step.label}
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("flex-1 h-px", i < currentIndex ? "bg-green-400" : "bg-gray-200")} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
```

---

### Shared UI Patterns

- **Loading states:** Centered spinner with descriptive text (e.g., "Generating copy for 5 platforms in EN + ES..."). Same spinner component used throughout.
- **Error display:** Red alert card below the triggering button with the error message and a "Retry" button. Does not navigate away.
- **Copy button feedback:** After copying to clipboard, button text changes to "Copied!" with a checkmark icon for 2 seconds, then reverts.
- **Back navigation:** Each step has a "← Back" button that returns to the previous step WITHOUT clearing that step's data.
- **cn() utility:** Use existing `cn()` from `lib/utils.ts` for conditional class names.
- **shadcn/ui components:** Use `Button`, `Input`, `Textarea`, `Badge`, `Card`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `components/ui/`.

---

### Route Registration in Middleware

The `/admin/social-media-studio` path must be protected by Clerk middleware. Verify that the existing middleware.ts already protects all `/admin/*` routes. If it only protects specific admin paths, add `/en/admin/social-media-studio` and `/es/admin/social-media-studio` to the protected routes list.

---

### File Structure After Phase 6

```
app/
  [locale]/
    admin/
      social-media-studio/
        page.tsx          ← NEW (single file, all step components inline)
      blog-generator/
        page.tsx          ← unchanged (reference for UI patterns)
      lead-magnet-generator/
        page.tsx          ← unchanged (reference for state management patterns)
```

No new API routes. No new files in `components/` (keep everything in the page file).

---

### Success Criteria

Phase 6 is complete when:

1. Navigating to `/en/admin/social-media-studio` (authenticated) renders the Source Picker step
2. Searching for a blog post in the search box returns results (debounced)
3. Clicking "Select →" on a blog post triggers copy generation and advances to Step 2 showing a spinner
4. When copy arrives, Step 2 shows all 5 platform tabs with EN/ES toggle — copy is editable
5. "Copy Full Post" for Facebook EN copies the correct assembled text to clipboard
6. Advancing to Step 3 auto-triggers image generation — spinner shows, then both image previews appear
7. Both image URLs are valid Cloudinary URLs that load correctly in the browser
8. "Regenerate Images" re-calls the image API with the current headline
9. Advancing to Step 4 auto-triggers script generation — 30s script appears by default
10. Duration toggle to 60s → "Regenerate" → returns a longer script
11. Step 5 shows all generated assets, "Copy for Metricool" copies the correct text
12. An unauthenticated visit redirects to sign-in
13. `pnpm tsc --noEmit` passes

---

## References

**Files to read before implementing:**
- `app/[locale]/admin/lead-magnet-generator/page.tsx` — the primary reference: state management pattern (`useState<GeneratorState>`), step rendering, auto-triggering effects, error handling, spinner components
- `app/[locale]/admin/blog-generator/page.tsx` — secondary reference for step indicator and overall layout
- `lib/social-media-studio/types.ts` — all types used in the wizard: `SocialPostSource`, `SocialPostCopy`, `SocialCreativeImages`, `VideoScript`, `PublishedSocialPost`
- `components/ui/` — existing shadcn/ui components: `Button`, `Input`, `Textarea`, `Card`, `Tabs`, `Badge`
- `lib/utils.ts` — `cn()` utility for conditional class names
- `middleware.ts` — verify `/admin` protection coverage; add social-media-studio path if needed
