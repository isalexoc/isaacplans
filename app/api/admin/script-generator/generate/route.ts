import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { synthesizeScript } from "@/lib/script-generator/script-synthesizer";
import { translateScript } from "@/lib/script-generator/translator";
import {
  isLineOfBusiness,
  primaryLanguage,
  type VideoDistillation,
} from "@/lib/script-generator/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let distillations: unknown;
  let lineOfBusiness: unknown;
  try {
    const body = await request.json();
    distillations = body?.distillations;
    lineOfBusiness = body?.lineOfBusiness;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(distillations) || distillations.length === 0) {
    return NextResponse.json(
      { success: false, error: "At least one video distillation is required" },
      { status: 400 }
    );
  }
  if (!isLineOfBusiness(lineOfBusiness)) {
    return NextResponse.json({ success: false, error: "Invalid lineOfBusiness" }, { status: 400 });
  }

  try {
    const videos = distillations as VideoDistillation[];
    // Write the script FIRST in the language of the source videos (preserves real
    // phrasing), then translate to the other language.
    const sourceLang = primaryLanguage(videos);
    const targetLang = sourceLang === "en" ? "es" : "en";

    const source = await synthesizeScript(videos, lineOfBusiness, sourceLang);
    const translated = await translateScript(source, sourceLang, targetLang);

    const en = sourceLang === "en" ? source : translated;
    const es = sourceLang === "es" ? source : translated;

    return NextResponse.json({ success: true, data: { en, es, sourceLanguage: sourceLang } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during generation";
    console.error("[script-generator/generate]", err);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
