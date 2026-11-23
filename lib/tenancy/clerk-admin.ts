/**
 * Is a given Clerk user (not necessarily the caller) one of Isaac's admins? Server-only.
 *
 * `role` lives in Clerk `publicMetadata`, which is not in the session token, so this asks Clerk's
 * API and caches the answer for a minute, like middleware's `userIsAdmin`. A user Clerk doesn't know
 * is cached as "no". Any other failure (no key on this deployment, network, rate limit) is `null`:
 * the caller decides which way that fails, and it is never cached.
 *
 * `platformAdmin` is the CRM's question: an admin who also carries an agent marker
 * (`publicMetadata.agentId`) is not one. Nothing writes that marker yet: the agent-linking flow (a
 * later chunk) is to set it, so that an agent made admin by mistake still never gets Isaac's CRM
 * through this check. Until then the protection is the rule that agents are never Clerk admins.
 */

import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

export type ClerkAdminStatus = { admin: boolean; platformAdmin: boolean };

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { status: ClerkAdminStatus; expires: number }>();

function remember(userId: string, status: ClerkAdminStatus): ClerkAdminStatus {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(userId, { status, expires: Date.now() + TTL_MS });
  return status;
}

const NOT_ADMIN: ClerkAdminStatus = { admin: false, platformAdmin: false };

export async function clerkAdminStatus(userId: string): Promise<ClerkAdminStatus | null> {
  const id = userId.trim();
  if (!id) return NOT_ADMIN;
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.status;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(id);
    const metadata = (user.publicMetadata ?? {}) as Record<string, unknown>;
    const admin = metadata.role === "admin";
    const agentMarked = typeof metadata.agentId === "string" && metadata.agentId.trim() !== "";
    return remember(id, { admin, platformAdmin: admin && !agentMarked });
  } catch (error) {
    if ((error as { status?: unknown })?.status === 404) return remember(id, NOT_ADMIN);
    console.warn("[tenancy] Clerk admin lookup failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
