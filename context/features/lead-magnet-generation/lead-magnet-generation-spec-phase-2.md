# Lead Magnet Generator — Phase 2 Spec

## Context

This is Phase 2 of an 8-phase feature that allows an admin user to type a prompt and generate a professional PDF guide published to Sanity CMS, with a public landing page that gates the PDF behind an email capture form.

**Phase 1 (complete):** Sanity schema + TypeScript types — `sanity/schemaTypes/leadMagnetType.ts` and `lib/lead-magnet-generator/types.ts` define the full data model.

**Phase 2 (this doc):** AI outline generation — accept a structured prompt input and produce a `LeadMagnetOutline` (title, subtitle, 6–8 sections with key points, estimated word count).

**Remaining phases:**
- Phase 3: AI section content generation
- Phase 4: AI image generation
- Phase 5: PDF generation
- Phase 6: Sanity publishing
- Phase 7: Admin generator UI
- Phase 8: Public landing page + lead capture

---

## Phase 2: AI Outline Generation

### Goal

Build the outline generation layer. Accept a `LeadMagnetPromptInput`, call OpenAI GPT, and return a `LeadMagnetOutline` that structures the guide before any section content is written. The outline drives Phase 3 (section generation) and is shown to the admin for review and editing before content generation begins.

### What to Build

1. **`lib/lead-magnet-generator/prompts.ts`** — system prompt + user prompt builder functions used by Phases 2, 3, and eventually Phase 7
2. **`lib/lead-magnet-generator/outline-generator.ts`** — OpenAI service that accepts a `LeadMagnetPromptInput` and returns a `LeadMagnetOutline`
3. **`app/api/admin/lead-magnet-generator/generate-outline/route.ts`** — `POST` endpoint, Clerk-authenticated

---

### Prompts Module (`lib/lead-magnet-generator/prompts.ts`)

Store all system and user prompts as exported constants and builder functions. Centralizing prompts here means Phases 3 and 7 import from one place and prompt changes don't require touching multiple files.

#### System prompt (outline generation)

```ts
export const LEAD_MAGNET_SYSTEM_PROMPT = `
You are a lead generation specialist and insurance educator writing for Isaac Plans Insurance, a U.S. insurance agency.

Your job is to outline comprehensive consumer guides that are genuinely the most helpful resource available on the topic — better than anything else a consumer could find online. These guides must:

1. Provide real, actionable value to readers at no cost
2. Position Isaac Plans as the trusted expert in the reader's mind
3. Lead readers naturally toward requesting a consultation (never pushy — helpful first)
4. Be accurate and factual — never fabricate statistics, dates, dollar amounts, or quotes
5. Address U.S. readers; use USD for any monetary references

Guide structure requirements:
- Title: Compelling, specific, benefit-driven (no clickbait)
- Subtitle: One sentence explaining who the guide is for and what they'll gain
- Introduction: Hook paragraph + what reader will learn + why it matters now
- Sections: 6–8 deep-dive sections that progress logically from foundational to advanced
- Each section: 800–1,200 words, ends with an "Action Step" for the reader
- Conclusion: Recaps key takeaways, positions a free consultation as the logical next step

Tone options:
- educational: Professional, clear, empathetic — like a knowledgeable friend explaining insurance
- conversational: Warm, direct, plain language — feels like talking to someone who cares
- urgent: Action-oriented, highlights consequences of waiting, still helpful not fear-based

Output JSON only — no markdown wrapper, no explanation outside the JSON object.
`;
```

#### User prompt builder (outline)

```ts
export function buildOutlinePrompt(input: LeadMagnetPromptInput): string {
  return `
Create a complete guide outline for the following:

Topic: ${input.topic}
Category: ${input.category}
Target audience: ${input.targetAudience}
Tone: ${input.tone}
Key topics that MUST be covered:
${input.keyTopics.map((t) => `- ${t}`).join("\n")}
${input.additionalContext ? `\nAdditional context:\n${input.additionalContext}` : ""}

Return a JSON object with this exact structure:
{
  "title": "...",              // compelling title, 60–80 chars, benefit-driven
  "subtitle": "...",           // one sentence, max 160 chars, who it's for + what they gain
  "targetAudience": "...",     // one sentence description of the reader
  "category": "...",           // must match input category: ${input.category}
  "keyBenefits": [             // exactly 5 "What you'll learn" bullets for the landing page
    "...",
    "...",
    "...",
    "...",
    "..."
  ],
  "sections": [                // 6–8 sections
    {
      "sectionTitle": "...",   // clear, specific H2 title (not generic like "Introduction")
      "keyPoints": [           // 4–6 bullet points of what this section covers
        "...",
        "...",
        "...",
        "..."
      ]
    }
  ],
  "estimatedWordCount": 0,     // integer, realistic total (intro + all sections + conclusion)
  "estimatedPages": 0          // integer, assuming 400 words per PDF page
}

Return only the JSON object. No markdown wrapper, no explanation.
  `.trim();
}
```

---

### Outline Generator (`lib/lead-magnet-generator/outline-generator.ts`)

#### Overview

Call OpenAI with `response_format: { type: "json_object" }` for reliable structured output. Parse and validate the response. Enforce field constraints programmatically — do not trust model output sizes.

#### OpenAI model

Use `process.env.OPENAI_MODEL`. Fall back to `"gpt-4o"` if unset. Same pattern as `lib/blog-generator/content-generator.ts`.

#### Validation and normalization

After receiving the OpenAI response:

1. Parse JSON — throw a descriptive error if parsing fails (include raw response in error)
2. Validate all required fields are present: `title`, `subtitle`, `targetAudience`, `category`, `keyBenefits`, `sections`, `estimatedWordCount`, `estimatedPages`
3. Enforce constraints:
   - Truncate `title` to 80 chars if over limit
   - Truncate `subtitle` to 160 chars if over limit
   - Ensure `category` matches the input `category` — if the model returns a different value, override with `input.category`
   - Ensure `keyBenefits` has exactly 5 items — slice to 5 if more, throw if fewer than 3
   - Ensure `sections` has 6–8 items — throw if outside range
   - Ensure each section has a non-empty `sectionTitle` and at least 3 `keyPoints`
4. Compute `estimatedWordCount` and `estimatedPages` locally as a sanity check (don't rely on model math):
   ```ts
   const estimatedWordCount = sections.length * 1000 + 700; // sections avg + intro/conclusion
   const estimatedPages = Math.ceil(estimatedWordCount / 400);
   ```

#### Error handling

- `OPENAI_API_KEY` not set → throw with message: `"OPENAI_API_KEY is not configured"`
- OpenAI API error → surface the error message with context: `"OpenAI outline generation failed: {message}"`
- JSON parse failure → include raw response: `"Failed to parse outline JSON. Raw response: {raw}"`
- Validation failure → throw with specific field: `"Outline validation failed: sections array has {n} items, expected 6–8"`

#### Function signature

```ts
export async function generateLeadMagnetOutline(
  input: LeadMagnetPromptInput
): Promise<LeadMagnetOutline>
```

---

### API Route (`app/api/admin/lead-magnet-generator/generate-outline/route.ts`)

`POST /api/admin/lead-magnet-generator/generate-outline`

**Auth:** `const { userId } = await auth()` — return 401 if missing. Identical pattern to `app/api/admin/blog-generator/generate/route.ts`.

**Request body:**
```json
{
  "promptInput": {
    "topic": "Final Expense Insurance: Everything Seniors Need to Know",
    "category": "final-expense",
    "targetAudience": "Adults aged 55–80 who have never purchased life insurance and are worried about leaving funeral costs to their family",
    "keyTopics": [
      "What final expense insurance actually covers",
      "How premiums are calculated by age and health",
      "Difference between whole life and term final expense policies",
      "Common mistakes people make when choosing a policy",
      "How to compare quotes and find the best rate"
    ],
    "tone": "educational",
    "additionalContext": "Focus on peace of mind and protecting family — not fear"
  }
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "title": "The Complete Senior's Guide to Final Expense Insurance",
    "subtitle": "Everything adults 55–80 need to know to protect their family from end-of-life costs",
    "targetAudience": "Adults aged 55–80 who want to protect their family from funeral and end-of-life expenses",
    "category": "final-expense",
    "keyBenefits": [
      "Understand exactly what final expense insurance covers — and what it doesn't",
      "Learn how your age and health affect your premium",
      "Compare whole life vs. term policies side by side",
      "Avoid the 3 most common mistakes seniors make when buying coverage",
      "Know what questions to ask an agent before signing anything"
    ],
    "sections": [
      {
        "sectionTitle": "What Is Final Expense Insurance and Why Do Seniors Need It?",
        "keyPoints": [
          "Definition and purpose — how it differs from traditional life insurance",
          "Average cost of a funeral in the U.S. ($9,000–$12,000)",
          "Why Social Security death benefit ($255) falls far short",
          "How final expense policies protect your family from unexpected debt"
        ]
      }
    ],
    "estimatedWordCount": 7700,
    "estimatedPages": 20
  }
}
```

**Error response (400/500):**
```json
{ "success": false, "error": "Outline validation failed: sections array has 5 items, expected 6–8" }
```

Set `export const maxDuration = 30` — outline generation typically takes 8–15 seconds.

---

### File Structure After Phase 2

```
lib/
  lead-magnet-generator/
    types.ts              ← Phase 1 (unchanged)
    prompts.ts            ← NEW: system prompt + user prompt builder
    outline-generator.ts  ← NEW: OpenAI service for outline generation
app/
  api/
    admin/
      lead-magnet-generator/
        generate-outline/
          route.ts        ← NEW: POST endpoint, Clerk auth guard
```

---

### Success Criteria

Phase 2 is complete when:

1. `POST /api/admin/lead-magnet-generator/generate-outline` with a valid `LeadMagnetPromptInput` returns a `LeadMagnetOutline` with all required fields
2. `sections` array always has 6–8 items
3. `keyBenefits` always has exactly 5 items
4. `category` in the response always matches `category` in the request (enforced programmatically)
5. Route returns 401 if the user is not authenticated via Clerk
6. A missing or invalid `OPENAI_API_KEY` returns `{ success: false, error: "OPENAI_API_KEY is not configured" }` — not a 500
7. `pnpm tsc --noEmit` passes — no TypeScript errors in new files

---

## References

**Files to read before implementing:**
- `lib/lead-magnet-generator/types.ts` — `LeadMagnetPromptInput`, `LeadMagnetOutline`, `LeadMagnetSection`; all types used in this phase
- `lib/blog-generator/content-generator.ts` — OpenAI call pattern, model env var fallback, `response_format: { type: "json_object" }`, error handling pattern to replicate
- `app/api/admin/blog-generator/generate/route.ts` — Clerk auth pattern (`auth()`, 401 return), `maxDuration` export pattern
- `middleware.ts` — confirm `/api/admin/lead-magnet-generator` routes are not blocked by locale middleware

**Environment variables (already in project):**
- `OPENAI_API_KEY` — used for outline generation
- `OPENAI_MODEL` — model ID (e.g. `gpt-4o`); fall back to `"gpt-4o"` if unset
