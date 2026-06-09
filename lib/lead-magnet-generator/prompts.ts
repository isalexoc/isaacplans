import type { LeadMagnetPromptInput } from "./types";

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
