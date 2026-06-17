import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import type { SocialPostCopy } from "@/lib/social-media-studio/types";

export const maxDuration = 30;

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}

interface UpdateBody {
  sourceTitle?: string;
  // Copies for ONE locale; merged with the other locale's existing copies.
  copies?: { locale: "en" | "es"; items: SocialPostCopy[] };
  videoScript?: {
    duration?: number;
    hookScript?: string;
    fullScript?: string;
    suggestedCaption?: string;
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: UpdateBody = await req.json();
  const sanity = getWriteClient();

  try {
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (typeof body.sourceTitle === "string") {
      set.sourceTitle = body.sourceTitle;
    }

    // Merge edited-locale copies with the other locale's existing copies.
    if (body.copies) {
      const existing = await sanity.fetch<{ generatedCopies?: (SocialPostCopy & { _key?: string })[] }>(
        `*[_type == "socialPost" && _id == $id][0]{ generatedCopies }`,
        { id }
      );
      const others = (existing?.generatedCopies ?? []).filter((c) => c.locale !== body.copies!.locale);
      const edited = body.copies.items.map((c) => ({
        _type:          "object",
        _key:           `${c.platform}_${c.locale}`,
        platform:       c.platform,
        locale:         c.locale,
        hook:           c.hook,
        body:           c.body,
        cta:            c.cta,
        hashtags:       c.hashtags,
        fullPost:       c.fullPost,
        characterCount: c.characterCount,
      }));
      set.generatedCopies = [...others, ...edited];
    }

    // Patch only the provided video-script fields (preserve the rest).
    if (body.videoScript) {
      for (const [k, v] of Object.entries(body.videoScript)) {
        if (v !== undefined) set[`videoScript.${k}`] = v;
      }
    }

    await sanity.patch(id).setIfMissing({ videoScript: {} }).set(set).commit();

    return NextResponse.json({ success: true, data: { updated: true } });
  } catch (err) {
    console.error("[history/update] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
