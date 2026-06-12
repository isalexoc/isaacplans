import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateSocialCopy } from "@/lib/social-media-studio/copy-generator";
import type {
  CopyGenerationRequest,
  SocialStudioResponse,
  SocialPostCopy,
} from "@/lib/social-media-studio/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body: CopyGenerationRequest = await req.json();

  if (!body.source?.title) {
    return NextResponse.json(
      { success: false, error: "source.title is required" },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY is not configured" },
      { status: 400 }
    );
  }

  try {
    const locales = body.locales ?? (body.source.locale ? [body.source.locale] : ["en"]);
    const copies = await generateSocialCopy(
      body.source,
      body.platforms,
      locales
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
