import { NextRequest, NextResponse } from "next/server";
import { eq, and, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialOauthStates } from "@/lib/db/schema";
import { upsertConnection } from "@/lib/social-publishing/connection-manager";
import {
  exchangeMetaCode,
  getPageToken,
  getInstagramUserId,
} from "@/lib/social-publishing/oauth/meta";
import { exchangeThreadsCode } from "@/lib/social-publishing/oauth/threads";
import { exchangeGoogleCode, getGbpLocation } from "@/lib/social-publishing/oauth/google";
import {
  exchangeTikTokCode,
  getTikTokDisplayName,
} from "@/lib/social-publishing/oauth/tiktok";
import { encryptToken } from "@/lib/social-publishing/token-crypto";
import type { SocialPlatform } from "@/lib/social-publishing/types";

const ADMIN_REDIRECT = "/en/admin/social-publishing/connections";

function errRedirect(msg: string) {
  return NextResponse.redirect(
    new URL(`${ADMIN_REDIRECT}?error=${encodeURIComponent(msg)}`, process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com")
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return errRedirect(`OAuth error: ${oauthError}`);
  if (!code || !state) return errRedirect("Missing code or state");

  // Validate state row
  const rows = await db
    .select()
    .from(socialOauthStates)
    .where(eq(socialOauthStates.state, state))
    .limit(1);

  const stateRow = rows[0];
  if (!stateRow) return errRedirect("Invalid OAuth state");
  if (stateRow.expiresAt < new Date()) return errRedirect("OAuth state expired");
  if (stateRow.platform !== platform) return errRedirect("Platform mismatch");

  // Delete used state row
  await db.delete(socialOauthStates).where(eq(socialOauthStates.state, state));
  // Also clean up expired rows
  await db.delete(socialOauthStates).where(lt(socialOauthStates.expiresAt, new Date()));

  const userId = stateRow.userId;

  try {
    if (platform === "facebook" || platform === "instagram") {
      const { userAccessToken, expiresAt } = await exchangeMetaCode(code);
      const page = await getPageToken(userAccessToken);

      // Always upsert Facebook connection
      await upsertConnection({
        userId,
        platform: "facebook",
        accessToken:         page.pageAccessToken,
        refreshToken:        null,
        tokenExpiresAt:      null, // page tokens never expire
        platformUserId:      page.pageId,
        platformAccountName: page.pageName,
        platformMetadata: {
          pageId:          page.pageId,
          pageName:        page.pageName,
          pageAccessToken: encryptToken(page.pageAccessToken),
        },
      });

      // If we got here via the "instagram" button, also derive the IG account
      const ig = await getInstagramUserId(page.pageId, page.pageAccessToken);
      if (ig) {
        await upsertConnection({
          userId,
          platform:            "instagram",
          accessToken:         page.pageAccessToken,
          refreshToken:        null,
          tokenExpiresAt:      null,
          platformUserId:      ig.igUserId,
          platformAccountName: ig.igUsername,
          platformMetadata:    { igUserId: ig.igUserId, igUsername: ig.igUsername },
        });
      }

      void userAccessToken; // suppress unused-var lint
      void expiresAt;

    } else if (platform === "threads") {
      const { accessToken, threadsUserId } = await exchangeThreadsCode(code);
      await upsertConnection({
        userId,
        platform:            "threads",
        accessToken,
        refreshToken:        null,
        tokenExpiresAt:      null,
        platformUserId:      threadsUserId,
        platformAccountName: threadsUserId,
        platformMetadata:    { threadsUserId },
      });

    } else if (platform === "google_business") {
      const { accessToken, refreshToken, expiresAt } = await exchangeGoogleCode(code);

      // GBP Account Management API has a very low QPM quota; if it fails here
      // the location will be resolved lazily on the first publish attempt.
      let loc: Awaited<ReturnType<typeof getGbpLocation>> | null = null;
      try {
        loc = await getGbpLocation(accessToken);
      } catch (err) {
        console.warn("[GBP] Location lookup failed during OAuth — will resolve at publish time:", (err as Error)?.message);
      }

      await upsertConnection({
        userId,
        platform:            "google_business",
        accessToken,
        refreshToken,
        tokenExpiresAt:      expiresAt,
        platformUserId:      loc?.locationId   ?? "pending",
        platformAccountName: loc?.locationName ?? "Google Business Profile",
        platformMetadata:    loc ?? { locationPending: true },
      });

    } else if (platform === "tiktok") {
      const codeVerifier = stateRow.codeVerifier;
      if (!codeVerifier) return errRedirect("Missing PKCE verifier");
      const { accessToken, refreshToken, openId, accessExpiresAt } =
        await exchangeTikTokCode(code, codeVerifier);
      const displayName = await getTikTokDisplayName(accessToken, openId);
      await upsertConnection({
        userId,
        platform:            "tiktok",
        accessToken,
        refreshToken,
        tokenExpiresAt:      accessExpiresAt,
        platformUserId:      openId,
        platformAccountName: displayName,
        platformMetadata:    { openId, displayName },
      });

    } else {
      return errRedirect(`Unknown platform: ${platform}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth exchange failed";
    console.error(`[social-publishing/oauth/callback/${platform}] Error for userId=${userId}:`, err);
    return errRedirect(msg);
  }

  return NextResponse.redirect(
    new URL(`${ADMIN_REDIRECT}?connected=${platform}`, process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com")
  );
}
