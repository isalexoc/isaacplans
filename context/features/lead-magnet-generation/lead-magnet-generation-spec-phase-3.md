# Lead Magnet Generator — Phase 3 Spec

## Context

This is Phase 3 of an 8-phase feature that generates professional PDF guides and publishes them behind an email-gated landing page.

**Phase 1 (complete):** Sanity schema + TypeScript types.
**Phase 2 (complete):** AI outline generation — `lib/lead-magnet-generator/outline-generator.ts` returns a `LeadMagnetOutline` with 6–8 sections and key points.

**Phase 3 (this doc):** AI section content generation — generate full prose content for each section sequentially, then generate the introduction and conclusion.

**Remaining phases:**
- Phase 4: AI image generation
- Phase 5: PDF generation
- Phase 6: Sanity publishing
- Phase 7: Admin generator UI
- Phase 8: Public landing page + lead capture

---

## Phase 3: AI Section Content Generation

### Goal

Build the section-by-section content generation layer. Each section call receives the full outline plus all previously generated sections as context, ensuring coherence and no repetition across the guide. A separate route generates the introduction and conclusion after all sections are complete. The admin UI (Phase 7) drives these calls in a loop — this phase only provides the service and routes.

### What to Build

1. **`lib/lead-magnet-generator/section-generator.ts`** — per-section and intro/conclusion OpenAI services
2. **New prompt builders** added to `lib/lead-magnet-generator/prompts.ts` (extends Phase 2)
3. **`app/api/admin/lead-magnet-generator/generate-section/route.ts`** — generates one section at a time
4. **`app/api/admin/lead-magnet-generator/generate-intro-conclusion/route.ts`** — generates introduction + conclusion after all sections are done

---

### New Prompt Builders (add to `lib/lead-magnet-generator/prompts.ts`)

#### Section generation system prompt

```ts
export const SECTION_GENERATION_SYSTEM_PROMPT = `
You are a lead generation specialist and insurance educator writing for Isaac Plans Insurance.
You are writing one section of a comprehensive consumer guide.

Section writing rules:
- Length: 800–1,200 words for this section
- Open with 1–2 sentences that connect to the previous section (or to the intro if this is the first section)
- Use ## for the section title (H2), ### for sub-headings (H3)
- Use bullet lists (- item) for key items — never numbered lists, never tables
- Include 1–2 relatable real-world examples or scenarios (fictional but realistic)
- End EVERY section with a callout block formatted exactly as:
  > **Action Step:** [specific, concrete action the reader can take today]
- Facts only — no fabricated statistics, specific dollar amounts, or external quotes unless they were provided in the outline key points
- Tone must match the guide's specified tone
- Do NOT summarize what was covered — move the reader forward

Output format: markdown only. No JSON wrapper. No preamble.
`;
```

#### Section generation user prompt builder

```ts
export function buildSectionPrompt(params: {
  outline: LeadMagnetOutline;
  sectionIndex: number;
  completedSections: LeadMagnetSection[];
}): string {
  const { outline, sectionIndex, completedSections } = params;
  const section = outline.sections[sectionIndex];
  const isFirst = sectionIndex === 0;
  const prevSectionTitle = isFirst
    ? null
    : outline.sections[sectionIndex - 1].sectionTitle;

  return `
Guide title: ${outline.title}
Target audience: ${outline.targetAudience}
Tone: (match the guide's tone — educational, helpful, not salesy)
Total sections: ${outline.sections.length}
Current section: ${sectionIndex + 1} of ${outline.sections.length}

Section to write:
Title: ${section.sectionTitle}
Key points to cover:
${section.keyPoints.map((p) => `- ${p}`).join("\n")}

${prevSectionTitle ? `Previous section was: "${prevSectionTitle}"` : "This is the first section — no previous section to connect to."}

${
  completedSections.length > 0
    ? `Topics already covered in prior sections (do not repeat):\n${completedSections
        .map((s) => `- ${s.sectionTitle}: ${s.keyPoints.slice(0, 2).join("; ")}`)
        .join("\n")}`
    : ""
}

Write the full section content now. Start directly with the ## heading — no preamble.
  `.trim();
}
```

#### Intro/conclusion system prompt

```ts
export const INTRO_CONCLUSION_SYSTEM_PROMPT = `
You are a lead generation specialist and insurance educator writing for Isaac Plans Insurance.
You are writing the introduction and conclusion for a completed consumer guide.

Introduction rules:
- 300–400 words
- Open with a compelling hook: a relatable scenario or a surprising (but factual) question
- Explain who this guide is for and what they will learn
- Why this information matters right now
- Do NOT summarize the sections — build anticipation instead
- No ## heading — the intro flows directly before the first section

Conclusion rules:
- 400–500 words
- Recap 3–5 key takeaways from the guide (brief, bullet-style)
- Acknowledge that every situation is different
- Soft CTA: position a free consultation with Isaac Plans as the natural next step
  - Mention consultation, not a sale — "get your questions answered", "understand your options"
  - Never say "buy now" or use urgent scarcity language
- End with a warm, encouraging close

Output format: Return a JSON object with two fields:
{
  "introduction": "full markdown text of the introduction",
  "conclusion": "full markdown text of the conclusion"
}
`;
```

#### Intro/conclusion user prompt builder

```ts
export function buildIntroConclusionPrompt(content: GeneratedLeadMagnet): string {
  return `
Guide title: ${content.outline.title}
Target audience: ${content.outline.targetAudience}
Category: ${content.outline.category}

Sections covered in this guide:
${content.sections.map((s, i) => `${i + 1}. ${s.sectionTitle}`).join("\n")}

Key benefits promised to the reader:
${content.outline.keyBenefits.map((b) => `- ${b}`).join("\n")}

Write the introduction and conclusion now. Return JSON only.
  `.trim();
}
```

---

### Section Generator (`lib/lead-magnet-generator/section-generator.ts`)

#### `generateSection()`

```ts
export async function generateSection(params: {
  outline: LeadMagnetOutline;
  sectionIndex: number;
  completedSections: LeadMagnetSection[];
}): Promise<{ content: string; contentBlocks: PortableTextBlock[]; wordCount: number }>
```

Implementation:
1. Build prompt using `buildSectionPrompt(params)`
2. Call OpenAI with the section system prompt — use streaming if available, otherwise standard completion
3. Model: `process.env.OPENAI_MODEL ?? "gpt-4o"`, `max_tokens: 2000`
4. Convert markdown response to Portable Text blocks using `textToBlocks()` from `lib/blog-generator/portable-text.ts`
5. Count words: `content.split(/\s+/).length`
6. Enforce minimum length: if `wordCount < 500`, throw with message: `"Generated section is too short ({wordCount} words). Retrying is recommended."`
7. Return `{ content, contentBlocks, wordCount }`

#### `generateIntroConclusion()`

```ts
export async function generateIntroConclusion(
  generatedContent: GeneratedLeadMagnet
): Promise<{
  introduction: string;
  conclusion: string;
  introductionBlocks: PortableTextBlock[];
  conclusionBlocks: PortableTextBlock[];
}>
```

Implementation:
1. Build prompt using `buildIntroConclusionPrompt(generatedContent)`
2. Call OpenAI with `response_format: { type: "json_object" }` and the intro/conclusion system prompt
3. Parse JSON response
4. Convert both markdown strings to Portable Text blocks using `textToBlocks()`
5. Return all four fields

#### Reuse

Import `textToBlocks()` from `lib/blog-generator/portable-text.ts` — the same Markdown-to-Portable-Text converter used by the blog generator works identically for lead magnet content.

---

### Section API Route (`app/api/admin/lead-magnet-generator/generate-section/route.ts`)

`POST /api/admin/lead-magnet-generator/generate-section`

**Auth:** Clerk `auth()` — 401 if missing.

**Request body:**
```json
{
  "outline": { ... },
  "sectionIndex": 2,
  "completedSections": [
    {
      "sectionTitle": "What Is Final Expense Insurance and Why Do Seniors Need It?",
      "keyPoints": ["..."],
      "content": "## What Is Final Expense...",
      "wordCount": 987
    },
    {
      "sectionTitle": "How Much Does Final Expense Insurance Cost?",
      "keyPoints": ["..."],
      "content": "## How Much Does...",
      "wordCount": 1043
    }
  ]
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "content": "## Understanding the Application Process...\n\nFor many seniors...",
    "contentBlocks": [...],
    "wordCount": 1012
  }
}
```

**Error response (400/500):**
```json
{ "success": false, "error": "Generated section is too short (312 words). Retrying is recommended." }
```

Set `export const maxDuration = 60` — section generation takes 15–30 seconds.

---

### Intro/Conclusion API Route (`app/api/admin/lead-magnet-generator/generate-intro-conclusion/route.ts`)

`POST /api/admin/lead-magnet-generator/generate-intro-conclusion`

**Auth:** Clerk `auth()` — 401 if missing.

**Request body:**
```json
{
  "generatedContent": {
    "outline": { ... },
    "sections": [ ... ]
  }
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "introduction": "Every year, thousands of families...",
    "conclusion": "You've now covered everything you need...",
    "introductionBlocks": [...],
    "conclusionBlocks": [...]
  }
}
```

Set `export const maxDuration = 60`.

---

### File Structure After Phase 3

```
lib/
  lead-magnet-generator/
    types.ts               ← Phase 1 (unchanged)
    prompts.ts             ← updated: add section + intro/conclusion builders
    outline-generator.ts   ← Phase 2 (unchanged)
    section-generator.ts   ← NEW: generateSection() + generateIntroConclusion()
app/
  api/
    admin/
      lead-magnet-generator/
        generate-outline/
          route.ts         ← Phase 2 (unchanged)
        generate-section/
          route.ts         ← NEW
        generate-intro-conclusion/
          route.ts         ← NEW
```

---

### Success Criteria

Phase 3 is complete when:

1. `POST /api/admin/lead-magnet-generator/generate-section` with valid `outline`, `sectionIndex: 0`, and `completedSections: []` returns section content with `wordCount >= 500`
2. Each subsequent call with `completedSections` populated does not repeat topics from earlier sections (verifiable by reading generated content)
3. `POST /api/admin/lead-magnet-generator/generate-intro-conclusion` with all 7 sections populated returns both `introduction` and `conclusion` as non-empty strings with `introductionBlocks` and `conclusionBlocks` arrays
4. `contentBlocks` from both routes are valid Portable Text — each block has `_type`, `_key`, `style`, and `children`
5. Both routes return 401 if unauthenticated
6. `pnpm tsc --noEmit` passes
7. Calling `generate-section` for each section of the outline (6–8 calls) + `generate-intro-conclusion` produces a fully populated `GeneratedLeadMagnet` ready for Phase 4

---

## References

**Files to read before implementing:**
- `lib/lead-magnet-generator/types.ts` — `LeadMagnetOutline`, `LeadMagnetSection`, `GeneratedLeadMagnet`; all input/output types
- `lib/lead-magnet-generator/prompts.ts` — existing Phase 2 prompts to extend (add builders to same file)
- `lib/blog-generator/portable-text.ts` — `textToBlocks()` function to import and reuse; do NOT duplicate the logic
- `lib/blog-generator/content-generator.ts` — OpenAI call pattern to replicate (model env var, error handling)
- `app/api/admin/lead-magnet-generator/generate-outline/route.ts` — auth + maxDuration pattern to replicate

**Environment variables (already in project):**
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
