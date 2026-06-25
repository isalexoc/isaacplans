import { createClient } from "next-sanity";
import { textToBlocks } from "@/lib/blog-generator/portable-text";
import {
  SECTION_KEYS,
  type GeneratedScript,
  type LineOfBusiness,
  type ScriptPublishResult,
} from "./types";

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token: process.env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });
}

interface PublishScriptInput {
  en: GeneratedScript;
  es: GeneratedScript;
  lineOfBusiness: LineOfBusiness;
  title: string;
  description: string;
  status: "draft" | "published";
}

export async function publishScript(input: PublishScriptInput): Promise<ScriptPublishResult> {
  const { en, es, lineOfBusiness, title, description, status } = input;
  const client = getWriteClient();

  const sectionFields = SECTION_KEYS.reduce((acc, key) => {
    acc[key] = {
      contentEn: textToBlocks(en.sections[key].content),
      contentEs: textToBlocks(es.sections[key].content),
      tipsEn: textToBlocks(en.sections[key].tips),
      tipsEs: textToBlocks(es.sections[key].tips),
    };
    return acc;
  }, {} as Record<string, unknown>);

  const doc = {
    _type: "presentationScript",
    lineOfBusiness,
    title: title.trim() || en.title,
    description: description.trim(),
    status,
    updatedAt: new Date().toISOString(),
    completeScript: {
      contentEn: textToBlocks(en.completeScript),
      contentEs: textToBlocks(es.completeScript),
    },
    ...sectionFields,
  };

  const created = await client.create(doc);

  // Intent links open a document by id regardless of the Studio structure layout.
  const studioUrl = `/studio/intent/edit/id=${encodeURIComponent(created._id)};type=presentationScript`;

  return { _id: created._id, studioUrl };
}
