import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { socialOauthStates } from "@/lib/db/schema";
import { buildMetaAuthUrl } from "@/lib/social-publishing/oauth/meta";
import { buildThreadsAuthUrl } from "@/lib/social-publishing/oauth/threads";
import { buildGoogleAuthUrl } from "@/lib/social-publishing/oauth/google";
import { buildTikTokAuthUrl, generatePkce } from "@/lib/social-publishing/oauth/tiktok";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform } = await params;
  const state = nanoid(21);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  let codeVerifier: string | null = null;
  let url: string;

  if (platform === "facebook" || platform === "instagram") {
    url = buildMetaAuthUrl(state);
  } else if (platform === "threads") {
    url = buildThreadsAuthUrl(state);
  } else if (platform === "google_business") {
    url = buildGoogleAuthUrl(state);
  } else if (platform === "tiktok") {
    const pkce = generatePkce();
    codeVerifier = pkce.codeVerifier;
    url = buildTikTokAuthUrl(state, pkce.codeChallenge);
  } else {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
  }

  await db.insert(socialOauthStates).values({
    state,
    userId,
    platform,
    codeVerifier,
    expiresAt,
  });

  return NextResponse.json({ url });
}
