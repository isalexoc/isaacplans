import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { submitSceneClip, type VeoTier } from "@/lib/social-media-studio/veo";

export const maxDuration = 60;

interface Body {
  imageUrl?: string;
  imageConcept?: string;
  tier?: VeoTier;
  durationSec?: 4 | 6 | 8;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body: Body = await req.json();
  if (!body.imageUrl) {
    return NextResponse.json({ success: false, error: "imageUrl is required" }, { status: 400 });
  }

  try {
    const { operationName } = await submitSceneClip({
      imageUrl:     body.imageUrl,
      imageConcept: body.imageConcept ?? "",
      tier:         body.tier,
      durationSec:  body.durationSec,
    });
    return NextResponse.json({ success: true, data: { operationName } });
  } catch (err) {
    console.error("[history/generate-scene-clip] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
