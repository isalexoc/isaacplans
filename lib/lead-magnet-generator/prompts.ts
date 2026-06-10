import type {
  GeneratedLeadMagnet,
  LeadMagnetOutline,
  LeadMagnetPromptInput,
  LeadMagnetSection,
} from "./types";

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
- Sections: EXACTLY 6 to 8 sections — no more, no fewer. Merge related topics if needed.
- Each section: 800–1,200 words, ends with an "Action Step" for the reader
- Conclusion: Recaps key takeaways, positions a free consultation as the logical next step

CRITICAL: The sections array must contain between 6 and 8 objects. If you have more than 8 key topics, combine the most closely related ones into a single section. Never return 9 or 10 sections.

Tone options:
- educational: Professional, clear, empathetic — like a knowledgeable friend explaining insurance
- conversational: Warm, direct, plain language — feels like talking to someone who cares
- urgent: Action-oriented, highlights consequences of waiting, still helpful not fear-based

Output JSON only — no markdown wrapper, no explanation outside the JSON object.
`;

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
  "sections": [                // EXACTLY 6–8 sections — never 9 or 10
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

// ─── Section Generation ───────────────────────────────────────────────────────

export const SECTION_GENERATION_SYSTEM_PROMPT = `
You are a lead generation specialist and insurance educator writing for Isaac Plans Insurance.
You are writing one section of a comprehensive consumer guide.

Section writing rules:
- Length: 900–1,200 words. Write fully — do not stop early.
- Open with 1–2 sentences that smoothly connect to the previous section (or to the intro for section 1)
- Use ## for the section title (H2), ### for sub-headings (H3) — use 2–3 sub-headings per section
- Use bullet lists (- item) for 3–5 item groupings. No numbered lists, no tables.
- Include at least one relatable real-world scenario (fictional family or individual, realistic situation)
- Be specific: name real product types, real processes, real questions consumers actually ask
- NEVER repeat content or examples from prior sections — each section must deliver new value
- End EVERY section with this callout block formatted exactly as:
  > **Action Step:** [specific, concrete action the reader can take today — not vague advice]
- Facts only — never fabricate statistics, specific dollar amounts, or external quotes unless they were provided in the outline key points
- Tone must match the guide's specified tone throughout — no tonal drift
- Do NOT summarize what was covered — move the reader forward toward the next idea

Output format: markdown only. No JSON wrapper. No preamble. Start directly with the ## heading.
`;

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

// ─── Intro / Conclusion ───────────────────────────────────────────────────────

export const INTRO_CONCLUSION_SYSTEM_PROMPT = `
You are a lead generation specialist and insurance educator writing for Isaac Plans Insurance.
You are writing the introduction and conclusion for a completed consumer guide.

Introduction rules:
- 350–450 words
- Open with a vivid, emotionally resonant hook: a relatable scenario (a real family moment, a worry most readers have had), or a surprising but factual question that reframes how they see the topic
- Name the reader's pain point clearly — show you understand why they're reading this
- State concisely who this guide is for and what they will walk away knowing
- Build anticipation for what's ahead — do NOT preview section titles or summarize content
- Close the intro with a single sentence that transitions naturally into the first section
- No ## heading — the intro flows directly before the first section

Conclusion rules:
- 450–550 words
- Begin with a brief acknowledgment that the reader has now covered a lot of ground
- Recap 4–5 key takeaways as a clean bullet list (each takeaway: one powerful sentence)
- Acknowledge that insurance is personal — every situation is different, every family is different
- Soft, confident CTA: frame a free consultation with Isaac Plans as the logical next step — not a sales call, but a conversation to get questions answered and understand their specific options
  - Use language like: "get clarity", "understand your options", "find the right fit", "no pressure, no obligation"
  - Never say "buy now", "limited time", or use fear/scarcity language
- End with a warm, forward-looking close that leaves the reader feeling empowered, not pressured

Output format: Return a JSON object with two fields:
{
  "introduction": "full markdown text of the introduction",
  "conclusion": "full markdown text of the conclusion"
}
`;

export function buildIntroConclusionPrompt(
  content: Pick<GeneratedLeadMagnet, "outline" | "sections">
): string {
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
