import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { socialPlatformConnections } from "@/lib/db/schema";
import { encryptToken, decryptToken } from "./token-crypto";
import { refreshGoogleToken } from "./oauth/google";
import { refreshTikTokToken } from "./oauth/tiktok";
import type { SocialPlatform, SocialConnection } from "./types";

function rowToConnection(row: typeof socialPlatformConnections.$inferSelect): SocialConnection {
  return {
    id:                  row.id,
    userId:              row.userId,
    platform:            row.platform as SocialPlatform,
    status:              row.status as "active" | "revoked",
    accessToken:         decryptToken(row.accessToken),
    refreshToken:        row.refreshToken ? decryptToken(row.refreshToken) : null,
    tokenExpiresAt:      row.tokenExpiresAt ?? null,
    platformUserId:      row.platformUserId ?? null,
    platformAccountName: row.platformAccountName ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    platformMetadata:    (row.platformMetadata as any) ?? null,
    connectedAt:         row.connectedAt,
    updatedAt:           row.updatedAt,
  };
}

export async function getConnection(userId: string, platform: SocialPlatform): Promise<SocialConnection | null> {
  const rows = await db
    .select()
    .from(socialPlatformConnections)
    .where(and(
      eq(socialPlatformConnections.userId, userId),
      eq(socialPlatformConnections.platform, platform),
      eq(socialPlatformConnections.status, "active"),
    ))
    .limit(1);
  return rows[0] ? rowToConnection(rows[0]) : null;
}

export async function listConnections(userId: string): Promise<SocialConnection[]> {
  const rows = await db
    .select()
    .from(socialPlatformConnections)
    .where(eq(socialPlatformConnections.userId, userId));
  return rows.map(rowToConnection);
}

export async function upsertConnection(params: {
  userId: string;
  platform: SocialPlatform;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  platformUserId?: string | null;
  platformAccountName?: string | null;
  platformMetadata?: object | null;
}): Promise<void> {
  const now = new Date();
  const encAccess  = encryptToken(params.accessToken);
  const encRefresh = params.refreshToken ? encryptToken(params.refreshToken) : null;

  await db
    .insert(socialPlatformConnections)
    .values({
      id:                  nanoid(),
      userId:              params.userId,
      platform:            params.platform,
      status:              "active",
      accessToken:         encAccess,
      refreshToken:        encRefresh,
      tokenExpiresAt:      params.tokenExpiresAt ?? null,
      platformUserId:      params.platformUserId ?? null,
      platformAccountName: params.platformAccountName ?? null,
      platformMetadata:    params.platformMetadata ?? null,
      connectedAt:         now,
      updatedAt:           now,
    })
    .onConflictDoUpdate({
      target: [socialPlatformConnections.userId, socialPlatformConnections.platform],
      set: {
        status:              "active",
        accessToken:         encAccess,
        refreshToken:        encRefresh,
        tokenExpiresAt:      params.tokenExpiresAt ?? null,
        platformUserId:      params.platformUserId ?? null,
        platformAccountName: params.platformAccountName ?? null,
        platformMetadata:    params.platformMetadata ?? null,
        updatedAt:           now,
      },
    });
}

export async function deleteConnection(userId: string, platform: SocialPlatform): Promise<void> {
  await db
    .update(socialPlatformConnections)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(
      eq(socialPlatformConnections.userId, userId),
      eq(socialPlatformConnections.platform, platform),
    ));
}

/** Refresh the access token if it expires within 10 minutes. Returns the (possibly refreshed) connection. */
export async function refreshTokenIfNeeded(conn: SocialConnection): Promise<SocialConnection> {
  if (!conn.tokenExpiresAt) return conn; // never expires (FB page tokens)

  const expiresInMs = conn.tokenExpiresAt.getTime() - Date.now();
  if (expiresInMs > 10 * 60 * 1000) return conn; // still fresh

  let newAccess: string;
  let newExpires: Date;
  let newRefresh: string | null = conn.refreshToken;

  if (conn.platform === "google_business" && conn.refreshToken) {
    const result = await refreshGoogleToken(conn.refreshToken);
    newAccess  = result.accessToken;
    newExpires = result.expiresAt;
  } else if (conn.platform === "tiktok" && conn.refreshToken) {
    const result = await refreshTikTokToken(conn.refreshToken);
    newAccess  = result.accessToken;
    newExpires = result.accessExpiresAt;
    newRefresh = result.refreshToken;
  } else {
    return conn; // can't refresh — caller will deal with the expired token
  }

  await db
    .update(socialPlatformConnections)
    .set({
      accessToken:    encryptToken(newAccess),
      refreshToken:   newRefresh ? encryptToken(newRefresh) : conn.refreshToken,
      tokenExpiresAt: newExpires,
      updatedAt:      new Date(),
    })
    .where(and(
      eq(socialPlatformConnections.userId, conn.userId),
      eq(socialPlatformConnections.platform, conn.platform),
    ));

  return { ...conn, accessToken: newAccess, refreshToken: newRefresh, tokenExpiresAt: newExpires };
}
