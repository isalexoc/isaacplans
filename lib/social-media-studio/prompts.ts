import type { SocialLocale, SocialPlatform, SocialPostSource } from "./types";

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

// ─── Video Script Prompts ─────────────────────────────────────────────────────

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

  const structureBlock = duration === 30 ? `
[0:00–0:03] HOOK (1–2 powerful sentences)
[0:03–0:15] PROBLEM (relatable pain point or knowledge gap — 2–3 sentences)
[0:15–0:25] SOLUTION (key insight or what to do — 2–3 sentences)
[0:25–0:30] CTA (single action — 1 sentence)
`.trim() : `
[0:00–0:05] HOOK (1–2 powerful sentences)
[0:05–0:20] PROBLEM (relatable scenario or surprising stat — 3–4 sentences)
[0:20–0:40] SOLUTION/VALUE (teach the main insight — 4–5 sentences)
[0:40–0:50] PROOF/CREDIBILITY (experience point or outcome — 2 sentences)
[0:50–0:60] CTA (single clear action — 1–2 sentences)
`.trim();

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
${structureBlock}

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
