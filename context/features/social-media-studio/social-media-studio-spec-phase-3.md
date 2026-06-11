# Social Media Content Studio — Phase 3 Spec

## Context

Phases 1–2 established the data model and the content source API (fetching blog posts and lead magnets from Sanity).

**Phase 3 (this doc):** AI Copy Generation — GPT-4o receives the normalized `SocialPostSource` and returns 10 `SocialPostCopy` objects (5 platforms × 2 locales), each with a platform-optimized hook, body copy, CTA, and hashtag set. This is the core AI phase and the highest-value output of the entire feature.

**Remaining phases:** Phase 4 (AI images), Phase 5 (video scripts), Phase 6 (admin UI), Phase 7 (publish + history).

---

## Phase 3: AI Copy Generation

### Goal

Build the GPT-4o copy generation service that:
- Takes a `SocialPostSource` and returns 10 `SocialPostCopy` objects (all platforms × locales)
- Each copy is uniquely shaped for its platform's culture, character limits, and best practices
- Spanish copy is written as native Latin American Spanish — not a word-for-word translation of English
- The service wraps one GPT-4o call in JSON mode — all 10 copies are generated in a single request

### What to Build

1. **`lib/social-media-studio/prompts.ts`** — system prompt + per-platform specs + user prompt builder
2. **`lib/social-media-studio/copy-generator.ts`** — GPT-4o service function
3. **`app/api/admin/social-media-studio/generate-copy/route.ts`** — Clerk-authenticated POST route

---

### Platform Specifications

Each platform requires a distinct content shape:

| Platform | Char target | Tone | Hashtags | Special requirements |
|---|---|---|---|---|
| Facebook | 400–600 | Personal, story-driven | 3–5 | Paragraph breaks; end with engagement question; storytelling works best |
| Instagram | 150–300 body + tags | Aspirational, visual-first | 5–8 on new line | First sentence is the hook (visible before "more"); line breaks for readability |
| TikTok | 80–150 | Casual, punchy | 3–5 | Caption supports the video; short and bold; not the full story |
| Threads | 200–400 | Conversational, opinion-driven | None | No hashtags; feels like a hot take or thought starter; end with a question |
| Google Business | 200–350 | Professional, local | None | No hashtags; include CTA with phone or website; local business tone |

**CTA styles by platform:**
- **Facebook:** "Comment 'INFO' below and I'll send you the details personally" or "DM me the word QUOTE for a free comparison"
- **Instagram:** "Link in bio → free guide" or "DM me 'GUIDE' to get the free download"
- **TikTok:** "Follow for more insurance tips" or "Drop your question in the comments"
- **Threads:** "What's your biggest question about [topic]? I'll answer every reply"
- **Google Business:** "Call us at {NEXT_PUBLIC_PHONE_NUMBER}" or "Book your free consultation at isaacplans.com"

---

### Prompts (`lib/social-media-studio/prompts.ts`)

#### System prompt

```ts
export const COPY_GENERATION_SYSTEM_PROMPT = `
You are an expert social media content strategist and copywriter for Isaac Plans, an independent insurance agency that serves English and Spanish-speaking clients across the United States. Isaac is a licensed insurance agent who positions himself as a trusted advisor — knowledgeable, approachable, and focused on education over sales.

Your job is to generate social media post copy that:
1. Is authentic and conversational — never corporate or pushy
2. Educates the audience first, then invites action
3. Complies with insurance marketing regulations: no guaranteed-outcome claims, no specific premium promises without a disclaimer, no misleading benefit statements
4. Converts readers into warm leads by making them want to learn more or reach out
5. Is perfectly adapted to each platform's format, culture, and algorithm

Isaac Plans brand voice:
- Warm, knowledgeable, and human — Isaac feels like a friend who happens to know everything about insurance
- "Here's what you need to know" not "Buy this now"
- Everyday language — define any insurance terms you use
- Bilingual: English and Spanish must both feel like original writing

CRITICAL for Spanish copy:
- Write in natural Latin American Spanish — NOT formal Castilian Spanish and NOT a word-for-word translation
- Insurance terms: "seguro médico" (not "cobertura médica"), "seguro de vida" (not "póliza de vida"), "gastos finales" (not "seguro funerario"), "deducible" (not "franquicia")
- Tone should be warm and familial — "te" not "le", "tu familia" not "su familia" (except Google Business where slightly more formal is acceptable)
- Common relatable phrases: "¿Sabías que...?", "Muchas familias no saben que...", "Te cuento algo importante..."

Return a JSON object with a "copies" key containing an array of copy objects. Do not wrap in markdown code fences.
`.trim();
```

#### Platform specification strings

```ts
const PLATFORM_SPECS: Record<SocialPlatform, string> = {
  facebook: `
FACEBOOK:
- Target length: 400–600 characters (body text; hashtags are additional)
- Use 2–3 short paragraphs with line breaks between them
- Open with a relatable scenario, surprising stat, or a personal "did you know" moment
- Middle paragraph: the educational value — what they need to know
- End with a soft CTA and an engagement question (drives comment algorithm)
- Hashtags: 3–5, placed at the very end after a line break
- Example hook styles: "Most people don't realize their health insurance has a gap until they need it most." or "I had a client call me panicking last week because..."
  `.trim(),

  instagram: `
INSTAGRAM:
- Target length: 150–300 characters for body (before hashtags)
- The very first sentence is the hook — it must make someone stop mid-scroll
- First sentence ends before a line break so it appears before the "more" cutoff
- Body is 2–3 short lines: hook → insight → action
- Hashtags: 5–8 on a separate line at the end (mix: 2 niche + 3 broad + 2 branded)
- Suggested branded hashtags: #IsaacPlans #InsuranceAdvice
- Avoid long paragraphs — use short punchy lines
- Example hook styles: "❌ Don't skip this if you're uninsured." or "Your employer plan might be costing you thousands. Here's why."
  `.trim(),

  tiktok: `
TIKTOK:
- Target length: 80–150 characters total (very short)
- This is just a caption — the video does the storytelling
- Use 1–2 sentences maximum
- Casual, almost text-message tone
- Hashtags: 3–5 at the end
- Example styles: "POV: You finally understand your insurance options 👀" or "The one insurance mistake I see every week #insurance"
  `.trim(),

  threads: `
THREADS:
- Target length: 200–400 characters
- Feels like the start of a Twitter/X thread or a hot take someone shares with friends
- Conversational and opinion-based — "Here's what I think about X" or "Unpopular opinion: Y"
- End with an open question that invites people to share their own experience
- NO hashtags — Threads deprioritizes them
- Example styles: "The insurance industry doesn't want you to know this, but ACA plans cover way more than people think." or "I've talked to hundreds of uninsured people. Here's the #1 reason they stay uninsured (and it's not what you think)."
  `.trim(),

  google_business: `
GOOGLE BUSINESS:
- Target length: 200–350 characters
- Professional, clear, and local business tone
- Highlight a specific service, answer a common question, or share a helpful tip
- Include a strong CTA with direct contact info or website
- NO hashtags
- Slightly more formal than other platforms — use "you" not slang
- Example styles: "Are you paying too much for health insurance? We compare plans from 30+ carriers to find the right fit for your budget. Call Isaac today for a free consultation."
  `.trim(),
};
```

#### User prompt builder

```ts
export function buildCopyPrompt(
  source: SocialPostSource,
  platforms: SocialPlatform[],
  locales: SocialLocale[]
): string {
  const sourceTypeLabel = {
    blog_post:    "Blog Post",
    lead_magnet:  "Free Guide / Lead Magnet",
    direct_topic: "Topic / Idea",
  }[source.type];

  const platformSpecsText = platforms
    .map((p) => PLATFORM_SPECS[p])
    .join("\n\n---\n\n");

  return `
Generate social media post copy for the following content:

SOURCE TYPE: ${sourceTypeLabel}
TITLE: ${source.title}
${source.subtitle ? `SUBTITLE / EXCERPT: ${source.subtitle}` : ""}
CATEGORY: ${source.category ?? "general insurance"}
${source.bodyText ? `CONTENT SUMMARY:\n${source.bodyText}` : ""}
${source.publicUrl ? `CTA LINK (use this in appropriate CTAs): ${source.publicUrl}` : ""}

PLATFORMS TO GENERATE: ${platforms.join(", ")}
LANGUAGES TO GENERATE: ${locales.join(", ")}

PLATFORM SPECIFICATIONS:
${platformSpecsText}

INSTRUCTIONS:
- Generate exactly ${platforms.length * locales.length} copy objects — one per platform+locale combination
- For each platform, generate both EN and ES versions (unless only one locale is requested)
- Spanish versions must be original writing adapted for Latin American Spanish — not translations
- Every "fullPost" must be the complete assembled post ready to paste into a scheduling tool:
  hook + two newlines + body + two newlines + cta + (for platforms with hashtags: two newlines + hashtags joined with spaces, each prefixed with #)
- characterCount should reflect the length of fullPost

Return a JSON object with this exact shape:
{
  "copies": [
    {
      "platform": "facebook",
      "locale": "en",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "hashtags": ["InsuranceTips", "HealthInsurance"],
      "fullPost": "...",
      "characterCount": 487
    },
    ...
  ]
}
`.trim();
}
```

---

### Service: `lib/social-media-studio/copy-generator.ts`

```ts
import OpenAI from "openai";
import { COPY_GENERATION_SYSTEM_PROMPT, buildCopyPrompt } from "./prompts";
import {
  type SocialPostSource,
  type SocialPlatform,
  type SocialLocale,
  type SocialPostCopy,
  ALL_PLATFORMS,
  ALL_LOCALES,
} from "./types";

export async function generateSocialCopy(
  source: SocialPostSource,
  platforms: SocialPlatform[] = ALL_PLATFORMS,
  locales: SocialLocale[] = ALL_LOCALES
): Promise<SocialPostCopy[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: COPY_GENERATION_SYSTEM_PROMPT },
      { role: "user",   content: buildCopyPrompt(source, platforms, locales) },
    ],
    max_tokens: 6000,
    temperature: 0.75, // slightly creative but grounded
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");

  // The model returns { copies: [...] } per the prompt instructions
  const copies: unknown[] = raw.copies ?? [];

  if (!copies.length) {
    throw new Error("AI returned no copy variants. Check the prompt or try again.");
  }

  return copies.map((item, i) => validateAndNormalizeCopy(item, i));
}

function validateAndNormalizeCopy(raw: unknown, index: number): SocialPostCopy {
  const r = raw as Record<string, unknown>;

  if (!r.platform) throw new Error(`Copy at index ${index} is missing 'platform'`);
  if (!r.locale)   throw new Error(`Copy at index ${index} is missing 'locale'`);
  if (!r.hook)     throw new Error(`Copy at index ${index} is missing 'hook'`);
  if (!r.fullPost) throw new Error(`Copy at index ${index} is missing 'fullPost'`);

  // Strip '#' prefix from any hashtags that accidentally include it
  const hashtags = Array.isArray(r.hashtags)
    ? (r.hashtags as string[]).map((h) => h.replace(/^#/, ""))
    : [];

  const fullPost  = String(r.fullPost);
  const charCount = typeof r.characterCount === "number"
    ? r.characterCount
    : fullPost.length;

  return {
    platform:       String(r.platform) as SocialPlatform,
    locale:         String(r.locale) as SocialLocale,
    hook:           String(r.hook),
    body:           String(r.body ?? ""),
    cta:            String(r.cta ?? ""),
    hashtags,
    fullPost,
    characterCount: charCount,
  };
}
```

---

### API Route

**File:** `app/api/admin/social-media-studio/generate-copy/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateSocialCopy } from "@/lib/social-media-studio/copy-generator";
import type { CopyGenerationRequest, SocialStudioResponse, SocialPostCopy } from "@/lib/social-media-studio/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: CopyGenerationRequest = await req.json();

  if (!body.source?.title) {
    return NextResponse.json({ success: false, error: "source.title is required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ success: false, error: "OPENAI_API_KEY is not configured" }, { status: 400 });
  }

  try {
    const copies = await generateSocialCopy(
      body.source,
      body.platforms,
      body.locales
    );

    const response: SocialStudioResponse<{ copies: SocialPostCopy[] }> = {
      success: true,
      data: { copies },
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
    "id": "abc123",
    "title": "Understanding Final Expense Insurance",
    "subtitle": "What seniors need to know before buying",
    "bodyText": "Final expense insurance is a type of whole life...",
    "category": "final-expense",
    "imageUrl": "https://cdn.sanity.io/...",
    "publicUrl": "https://isaacplans.com/en/blog/understanding-final-expense-insurance",
    "locale": "en"
  },
  "platforms": ["facebook", "instagram", "tiktok", "threads", "google_business"],
  "locales": ["en", "es"]
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "copies": [
      {
        "platform": "facebook",
        "locale": "en",
        "hook": "Most people don't discover the gaps in their coverage until they actually need it.",
        "body": "Final expense insurance is designed for one purpose: to make sure your family never has to choose between grieving and paying bills...",
        "cta": "Comment 'INFO' below and I'll send you a free breakdown of your options.",
        "hashtags": ["FinalExpense", "LifeInsurance", "InsuranceTips"],
        "fullPost": "Most people don't discover...\n\nFinal expense insurance...\n\nComment 'INFO' below...\n\n#FinalExpense #LifeInsurance #InsuranceTips",
        "characterCount": 512
      }
    ]
  }
}
```

---

### File Structure After Phase 3

```
lib/
  social-media-studio/
    types.ts              ← Phase 1
    source-fetcher.ts     ← Phase 2
    prompts.ts            ← NEW
    copy-generator.ts     ← NEW
app/
  api/
    admin/
      social-media-studio/
        sources/...        ← Phase 2
        generate-copy/
          route.ts         ← NEW
```

---

### Success Criteria

Phase 3 is complete when:

1. `POST /api/admin/social-media-studio/generate-copy` with a valid `SocialPostSource` returns exactly 10 `SocialPostCopy` objects (5 platforms × 2 locales)
2. Each copy has non-empty `hook`, `body`, `cta`, and `fullPost`
3. `characterCount` is within ±100 of each platform's target range
4. `hashtags` array is empty for `threads` and `google_business` copies
5. Spanish copies feel like native Latin American Spanish (test manually — not translated English)
6. `fullPost` is properly assembled: hook → blank line → body → blank line → cta → blank line → hashtags
7. Route returns 401 for unauthenticated requests
8. Route returns 400 if `source.title` is missing or `OPENAI_API_KEY` is not set
9. `pnpm tsc --noEmit` passes

---

## References

**Files to read before implementing:**
- `lib/social-media-studio/types.ts` — all types: `SocialPostSource`, `SocialPostCopy`, `CopyGenerationRequest`, `SocialStudioResponse`, `ALL_PLATFORMS`, `ALL_LOCALES`
- `lib/lead-magnet-generator/prompts.ts` — system prompt + user prompt builder pattern to replicate
- `lib/lead-magnet-generator/outline-generator.ts` — OpenAI JSON mode call pattern (`response_format: { type: "json_object" }`) and validation pattern
- `app/api/admin/lead-magnet-generator/generate-outline/route.ts` — Clerk auth + `maxDuration` pattern
- `CLAUDE.md` under "Key Env Vars" — `OPENAI_API_KEY`, `OPENAI_MODEL` (use `process.env.OPENAI_MODEL ?? "gpt-4o"`)
