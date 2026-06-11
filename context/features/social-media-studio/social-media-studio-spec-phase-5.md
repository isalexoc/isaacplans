# Social Media Content Studio — Phase 5 Spec

## Context

Phases 1–4 built the data model, source API, AI copy generator, and AI image generator.

**Phase 5 (this doc):** Video Script Generator — GPT-4o generates a 30–60 second TikTok/Reel script from the same source content, complete with timed scene marks, on-screen text suggestions, b-roll ideas, and delivery coaching. This is the content asset that lets Isaac record short-form video content quickly and consistently.

**Remaining phases:** Phase 6 (admin UI), Phase 7 (publish + history).

---

## Phase 5: Video Script Generator

### Goal

Build the GPT-4o script generation service that takes a `SocialPostSource` and a target duration (30 or 60 seconds) and returns a `VideoScript` object containing:
- A punchy opening hook (first 5 seconds)
- A complete timed script with `[MM:SS]` scene marks
- On-screen text suggestions per scene
- B-roll / visual suggestions for a video editor
- Delivery coaching notes
- A pre-written TikTok/Reel caption to pair with the video

The script is designed for a talking-head format where Isaac speaks directly to camera. No professional production equipment assumed — scripts should work on a phone camera.

### What to Build

1. **Extend `lib/social-media-studio/prompts.ts`** — add `VIDEO_SCRIPT_SYSTEM_PROMPT` and `buildVideoScriptPrompt()`
2. **`lib/social-media-studio/script-generator.ts`** — GPT-4o service function
3. **`app/api/admin/social-media-studio/generate-video-script/route.ts`** — Clerk-authenticated POST route

---

### Script Format Specification

**30-second script structure:**
```
[0:00–0:03] HOOK — Bold opening statement or question. Maximum 1–2 sentences.
[0:03–0:15] PROBLEM — Briefly state the problem or gap the audience faces. 2–3 sentences.
[0:15–0:25] SOLUTION — Introduce the solution or key insight. 2–3 sentences.
[0:25–0:30] CTA — Clear, single action. 1 sentence.
```

**60-second script structure:**
```
[0:00–0:05] HOOK — Bold opening hook. 1–2 sentences.
[0:05–0:20] PROBLEM — Expand on the problem with a relatable scenario or stat. 3–4 sentences.
[0:20–0:40] SOLUTION/VALUE — Teach the key insight or walk through the options. 4–5 sentences.
[0:40–0:50] PROOF/CREDIBILITY — Quick credibility point: years of experience, client win, common outcome. 2 sentences.
[0:50–0:60] CTA — Single clear action. 1–2 sentences.
```

**Hook types that perform best on short-form video:**
1. Contrarian claim: "Most people have [product] set up wrong."
2. Question: "Did you know your health insurance might not cover this?"
3. POV framing: "POV: You just turned 65 and no one told you about this."
4. Surprising stat: "47 million Americans have zero life insurance. Don't be one of them."
5. Mistake reveal: "The #1 mistake I see families make when choosing final expense insurance."

---

### Prompts Addition (`lib/social-media-studio/prompts.ts`)

Add these exports alongside the existing copy generation prompts:

```ts
export const VIDEO_SCRIPT_SYSTEM_PROMPT = `
You are a short-form video script writer for Isaac Plans, an insurance agency run by Isaac — a bilingual (English/Spanish) licensed insurance agent who records TikTok and Instagram Reel videos from his phone.

Isaac's video style:
- Talking head, direct to camera, casual but knowledgeable
- Phone camera quality — no studio production
- Uses hand gestures and natural pauses for emphasis
- Occasionally uses a simple graphic or text overlay
- Speaks in a warm, conversational tone — like explaining something to a friend

Your scripts must:
1. Open with a hook that captures attention in the first 3 seconds (before someone scrolls past)
2. Deliver real educational value — not empty hype
3. End with one clear action (follow, comment, DM, link in bio)
4. Be written exactly as Isaac would speak — natural, not scripted-sounding
5. Fit the requested duration when read at a natural, unhurried pace (roughly 130–150 words per minute)

IMPORTANT: Write the full script in English only. The [suggestedCaption] field should use the English TikTok caption generated in the copy phase — just pick or adapt the most punchy version for short-form.

Return a JSON object with a "script" key. Do not wrap in markdown code fences.
`.trim();

export function buildVideoScriptPrompt(
  source: SocialPostSource,
  duration: 30 | 60
): string {
  const wordTarget = duration === 30
    ? "65–75 words (30 seconds at natural pace)"
    : "130–150 words (60 seconds at natural pace)";

  return `
Generate a ${duration}-second TikTok/Instagram Reel script for the following content:

SOURCE TYPE: ${source.type === "blog_post" ? "Blog Post" : source.type === "lead_magnet" ? "Free Guide" : "Topic"}
TITLE: ${source.title}
${source.subtitle ? `SUBTITLE: ${source.subtitle}` : ""}
CATEGORY: ${source.category ?? "general insurance"}
${source.bodyText ? `CONTENT CONTEXT:\n${source.bodyText.slice(0, 1500)}` : ""}
${source.publicUrl ? `LINK FOR CTA: ${source.publicUrl}` : ""}

DURATION: ${duration} seconds
WORD TARGET: ${wordTarget}

Script structure to follow:
${duration === 30 ? `
[0:00–0:03] HOOK (1–2 powerful sentences)
[0:03–0:15] PROBLEM (relatable pain point or knowledge gap — 2–3 sentences)
[0:15–0:25] SOLUTION (key insight or what to do — 2–3 sentences)
[0:25–0:30] CTA (single action — 1 sentence)
` : `
[0:00–0:05] HOOK (1–2 powerful sentences)
[0:05–0:20] PROBLEM (relatable scenario or surprising stat — 3–4 sentences)
[0:20–0:40] SOLUTION/VALUE (teach the main insight — 4–5 sentences)
[0:40–0:50] PROOF/CREDIBILITY (experience point or outcome — 2 sentences)
[0:50–0:60] CTA (single clear action — 1–2 sentences)
`}

Return this exact JSON shape:
{
  "script": {
    "duration": ${duration},
    "hookScript": "The opening hook lines only (first scene)",
    "fullScript": "The complete timed script with [MM:SS–MM:SS] marks for each scene. Include all spoken words.",
    "onScreenTextSuggestions": [
      "SCENE NAME: Text to display on screen during that scene",
      "HOOK: 'Did you know...?'",
      "PROBLEM: 'The Gap: $12,000'",
      "CTA: 'Follow for more'"
    ],
    "brollSuggestions": [
      "Close-up of hands holding insurance documents",
      "Family sitting at kitchen table reviewing paperwork",
      "Text message notification on phone"
    ],
    "voiceoverTips": "Coaching note for delivery — where to pause, what to emphasize, pace notes.",
    "suggestedCaption": "The TikTok caption to post with this video (80–150 chars + 3-5 hashtags)"
  }
}
`.trim();
}
```

---

### Service: `lib/social-media-studio/script-generator.ts`

```ts
import OpenAI from "openai";
import { VIDEO_SCRIPT_SYSTEM_PROMPT, buildVideoScriptPrompt } from "./prompts";
import type { SocialPostSource, VideoScript, VideoScriptRequest } from "./types";

export async function generateVideoScript(
  req: VideoScriptRequest
): Promise<VideoScript> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model:           process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VIDEO_SCRIPT_SYSTEM_PROMPT },
      { role: "user",   content: buildVideoScriptPrompt(req.source, req.duration) },
    ],
    max_tokens:  2000,
    temperature: 0.8, // slightly more creative for script writing
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
  const s   = raw.script ?? raw; // handle if model wraps or doesn't wrap in "script"

  return validateVideoScript(s, req.duration);
}

function validateVideoScript(raw: unknown, duration: 30 | 60): VideoScript {
  const r = raw as Record<string, unknown>;

  if (!r.fullScript) throw new Error("AI returned no video script content");
  if (!r.hookScript) throw new Error("AI returned no hook script");

  return {
    duration,
    hookScript:                String(r.hookScript),
    fullScript:                String(r.fullScript),
    onScreenTextSuggestions:   Array.isArray(r.onScreenTextSuggestions)
      ? (r.onScreenTextSuggestions as string[]).map(String)
      : [],
    brollSuggestions:          Array.isArray(r.brollSuggestions)
      ? (r.brollSuggestions as string[]).map(String)
      : [],
    voiceoverTips:             String(r.voiceoverTips ?? ""),
    suggestedCaption:          String(r.suggestedCaption ?? ""),
  };
}
```

---

### API Route

**File:** `app/api/admin/social-media-studio/generate-video-script/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateVideoScript } from "@/lib/social-media-studio/script-generator";
import type {
  VideoScriptRequest,
  VideoScript,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: VideoScriptRequest = await req.json();

  if (!body.source?.title) {
    return NextResponse.json({ success: false, error: "source.title is required" }, { status: 400 });
  }

  if (body.duration !== 30 && body.duration !== 60) {
    return NextResponse.json(
      { success: false, error: "duration must be 30 or 60" },
      { status: 400 }
    );
  }

  try {
    const script = await generateVideoScript(body);
    const response: SocialStudioResponse<{ script: VideoScript }> = {
      success: true,
      data:    { script },
    };
    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
```

**Request body:**
```json
{
  "source": {
    "type": "blog_post",
    "title": "Understanding Final Expense Insurance",
    "subtitle": "What seniors need to know before buying",
    "bodyText": "Final expense insurance is...",
    "category": "final-expense",
    "publicUrl": "https://isaacplans.com/en/blog/understanding-final-expense-insurance"
  },
  "duration": 30
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "script": {
      "duration": 30,
      "hookScript": "Your family shouldn't have to worry about funeral costs while they're grieving.",
      "fullScript": "[0:00–0:03] Your family shouldn't have to worry about funeral costs while they're grieving.\n\n[0:03–0:15] Most people don't realize that funeral costs average $12,000 — and that's money your family has to come up with in days, not months. If you're over 50 and you don't have a plan, this is a conversation you need to have today.\n\n[0:15–0:25] Final expense insurance solves exactly this problem. It's a small, affordable policy that pays out immediately to cover funeral and burial costs — no medical exam required, no waiting period for most plans.\n\n[0:25–0:30] Drop 'FINAL' in the comments and I'll send you a free quote comparison.",
      "onScreenTextSuggestions": [
        "HOOK: 'Average Funeral Cost: $12,000'",
        "PROBLEM: '56% of Americans have no life insurance'",
        "SOLUTION: 'Final Expense Insurance'",
        "CTA: 'Comment FINAL for a free quote'"
      ],
      "brollSuggestions": [
        "Close-up of hands holding a printed insurance document",
        "Text notification showing '$12,000' on a phone screen",
        "Elderly couple sitting peacefully on a porch"
      ],
      "voiceoverTips": "Pause for 1 second after 'grieving' in the hook. Slow down slightly when saying '$12,000' for emphasis. The CTA should be upbeat and direct, not somber.",
      "suggestedCaption": "Don't let your family face this alone. Comment 'FINAL' for a free quote. #FinalExpense #LifeInsurance #InsuranceTips"
    }
  }
}
```

---

### File Structure After Phase 5

```
lib/
  social-media-studio/
    types.ts                ← Phase 1
    source-fetcher.ts       ← Phase 2
    prompts.ts              ← Phase 3 + EXTENDED in Phase 5
    copy-generator.ts       ← Phase 3
    image-generator.ts      ← Phase 4
    script-generator.ts     ← NEW
app/
  api/
    admin/
      social-media-studio/
        sources/...          ← Phase 2
        generate-copy/...    ← Phase 3
        generate-images/...  ← Phase 4
        generate-video-script/
          route.ts           ← NEW
```

---

### Success Criteria

Phase 5 is complete when:

1. `POST /api/admin/social-media-studio/generate-video-script` with a valid source and `duration: 30` returns a `VideoScript` with non-empty `fullScript` and `hookScript`
2. The 30-second script's `fullScript` has `[0:00`, `[0:03`, `[0:15`, `[0:25` scene marks
3. The 60-second script's `fullScript` has `[0:00`, `[0:05`, `[0:20`, `[0:40`, `[0:50` scene marks
4. `onScreenTextSuggestions` has at least 3 entries
5. `brollSuggestions` has at least 3 entries
6. `voiceoverTips` is non-empty
7. `suggestedCaption` is non-empty and within TikTok's 150-character limit
8. Route returns 401 for unauthenticated requests
9. Route returns 400 for invalid `duration` values
10. `pnpm tsc --noEmit` passes

---

## References

**Files to read before implementing:**
- `lib/social-media-studio/types.ts` — `VideoScript`, `VideoScriptRequest`, `SocialStudioResponse`
- `lib/social-media-studio/prompts.ts` — add the two new exports to the existing file; do not replace what's there
- `lib/lead-magnet-generator/section-generator.ts` — GPT-4o JSON mode pattern with validation to replicate
- `lib/social-media-studio/copy-generator.ts` — validation pattern for normalizing AI response to typed interface
