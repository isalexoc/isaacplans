/**
 * Is a given Clerk user (not necessarily the caller) one of Isaac's admins? Server-only.
 *
 * `role` lives in Clerk `publicMetadata`, which is not in the session token, so this asks Clerk's
 * API and caches the answer for a minute, like middleware's `userIsAdmin`. A user Clerk doesn't know
 * is cached as "no". Any other failure (no key on this deployment, network, rate limit) is `null`:
 * the caller decides which way that fails, and it is never cached.
 *
 * `platformAdmin` is the CRM's question: an admin who is not an agent. An admin who carries the
 * agent marker (`publicMetadata.agentId`) is not one, and neither is an admin whose account is
 * linked to an `agents` row (a marker that never stuck, then the role given by mistake): that one
 * lookup can only take the answer away, and when it fails the answer is "not a platform admin"
 * (not cached). The agent-linking flow (lib/tenancy/agent-accounts.ts) sets the marker on every
 * linked account and refuses to link an admin, so an agent made admin by mistake later still never
 * gets Isaac's CRM through this check.
 */

import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { hasAdminRole, isPlatformAdminMetadata } from "./agent-linking";
import { lookupAgentByClerkUserId } from "./agents";

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
  let metadata: unknown;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(id);
    metadata = user.publicMetadata ?? {};
  } catch (error) {
    if ((error as { status?: unknown })?.status === 404) return remember(id, NOT_ADMIN);
    console.warn("[tenancy] Clerk admin lookup failed:", error instanceof Error ? error.message : error);
    return null;
  }
  const admin = hasAdminRole(metadata);
  if (!isPlatformAdminMetadata(metadata)) return remember(id, { admin, platformAdmin: false });
  // The admin role and no marker: still not Isaac's side if the account is linked to an agent row.
  const found = await lookupAgentByClerkUserId(id);
  if (found.kind === "unknown") return { admin, platformAdmin: false };
  if (found.kind === "agent") {
    console.error(`[tenancy] the Clerk account linked to agent ${found.agent.id} has the admin role; it gets no CRM. Remove the role in Clerk.`);
  }
  return remember(id, { admin, platformAdmin: found.kind === "none" });
}
