import { NextRequest, NextResponse } from "next/server";
import { lte, and, inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialPlatformConnections } from "@/lib/db/schema";
import { decryptToken, encryptToken } from "@/lib/social-publishing/token-crypto";
import { refreshGoogleToken } from "@/lib/social-publishing/oauth/google";
import { refreshTikTokToken } from "@/lib/social-publishing/oauth/tiktok";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Find tokens expiring within 7 days
  const expiring = await db
    .select()
    .from(socialPlatformConnections)
    .where(
      and(
        inArray(socialPlatformConnections.platform, ["google_business", "tiktok"] as string[]),
        lte(socialPlatformConnections.tokenExpiresAt, sevenDaysFromNow),
        inArray(socialPlatformConnections.status, ["active"] as string[]),
      )
    );

  const results: { id: string; platform: string; success: boolean; error?: string }[] = [];

  for (const conn of expiring) {
    if (!conn.refreshToken) {
      results.push({ id: conn.id, platform: conn.platform, success: false, error: "No refresh token" });
      continue;
    }

    try {
      const refreshToken = decryptToken(conn.refreshToken);
      let newAccessToken: string;
      let newExpiresAt: Date;
      let newRefreshToken: string | null = null;

      if (conn.platform === "google_business") {
        const result = await refreshGoogleToken(refreshToken);
        newAccessToken = result.accessToken;
        newExpiresAt   = result.expiresAt;
      } else {
        const result = await refreshTikTokToken(refreshToken);
        newAccessToken = result.accessToken;
        newExpiresAt   = result.accessExpiresAt;
        newRefreshToken = result.refreshToken;
      }

      await db
        .update(socialPlatformConnections)
        .set({
          accessToken:    encryptToken(newAccessToken),
          ...(newRefreshToken ? { refreshToken: encryptToken(newRefreshToken) } : {}),
          tokenExpiresAt: newExpiresAt,
          updatedAt:      new Date(),
        })
        .where(eq(socialPlatformConnections.id, conn.id));

      results.push({ id: conn.id, platform: conn.platform, success: true });
    } catch (err) {
      results.push({
        id:       conn.id,
        platform: conn.platform,
        success:  false,
        error:    err instanceof Error ? err.message : "Refresh failed",
      });
    }
  }

  return NextResponse.json({ refreshed: results.filter((r) => r.success).length, results });
}
