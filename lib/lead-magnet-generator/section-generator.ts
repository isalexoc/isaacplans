import OpenAI from "openai";
import { textToBlocks } from "@/lib/blog-generator/portable-text";
import {
  INTRO_CONCLUSION_SYSTEM_PROMPT,
  SECTION_GENERATION_SYSTEM_PROMPT,
  buildIntroConclusionPrompt,
  buildSectionPrompt,
} from "./prompts";
import type {
  GeneratedLeadMagnet,
  LeadMagnetOutline,
  LeadMagnetSection,
  PortableTextBlock,
} from "./types";

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateSection(params: {
  outline: LeadMagnetOutline;
  sectionIndex: number;
  completedSections: LeadMagnetSection[];
}): Promise<{ content: string; contentBlocks: PortableTextBlock[]; wordCount: number }> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  let content: string;
  try {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SECTION_GENERATION_SYSTEM_PROMPT },
        { role: "user", content: buildSectionPrompt(params) },
      ],
    });
    content = (response.choices[0]?.message?.content ?? "").trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI section generation failed: ${msg}`);
  }

  if (!content) {
    throw new Error("OpenAI returned an empty response for section generation");
  }

  const wordCount = content.split(/\s+/).length;
  if (wordCount < 500) {
    throw new Error(
      `Generated section is too short (${wordCount} words). Retrying is recommended.`
    );
  }

  const contentBlocks = textToBlocks(content) as PortableTextBlock[];

  return { content, contentBlocks, wordCount };
}

export async function generateIntroConclusion(
  generatedContent: Pick<GeneratedLeadMagnet, "outline" | "sections">
): Promise<{
  introduction: string;
  conclusion: string;
  introductionBlocks: PortableTextBlock[];
  conclusionBlocks: PortableTextBlock[];
}> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  let rawContent: string;
  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INTRO_CONCLUSION_SYSTEM_PROMPT },
        { role: "user", content: buildIntroConclusionPrompt(generatedContent) },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI intro/conclusion generation failed: ${msg}`);
  }

  let parsed: { introduction: string; conclusion: string };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(
      `Failed to parse intro/conclusion JSON. Raw response: ${rawContent.slice(0, 500)}`
    );
  }

  if (!parsed.introduction?.trim()) {
    throw new Error("Intro/conclusion response is missing the 'introduction' field");
  }
  if (!parsed.conclusion?.trim()) {
    throw new Error("Intro/conclusion response is missing the 'conclusion' field");
  }

  return {
    introduction: parsed.introduction,
    conclusion: parsed.conclusion,
    introductionBlocks: textToBlocks(parsed.introduction) as PortableTextBlock[],
    conclusionBlocks: textToBlocks(parsed.conclusion) as PortableTextBlock[],
  };
}
