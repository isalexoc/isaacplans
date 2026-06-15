import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialPlatformConnections } from "@/lib/db/schema";
import { deleteConnection } from "@/lib/social-publishing/connection-manager";
import type { SocialPlatform } from "@/lib/social-publishing/types";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Query DB directly — never decrypt tokens for the list endpoint
    const rows = await db
      .select({
        id:                  socialPlatformConnections.id,
        platform:            socialPlatformConnections.platform,
        status:              socialPlatformConnections.status,
        platformUserId:      socialPlatformConnections.platformUserId,
        platformAccountName: socialPlatformConnections.platformAccountName,
        tokenExpiresAt:      socialPlatformConnections.tokenExpiresAt,
        connectedAt:         socialPlatformConnections.connectedAt,
        updatedAt:           socialPlatformConnections.updatedAt,
      })
      .from(socialPlatformConnections)
      .where(eq(socialPlatformConnections.userId, userId));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[social-publishing/connections GET]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load connections" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { platform } = await req.json() as { platform: SocialPlatform };
    if (!platform) return NextResponse.json({ error: "platform required" }, { status: 400 });

    await deleteConnection(userId, platform);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[social-publishing/connections DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to disconnect" }, { status: 500 });
  }
}
