/**
 * Isaac's side of the agent platform (/admin/agents): create agents, edit their profile, switch
 * them on and off, and see how far along each one is. Server-only.
 *
 * Isaac's admin role sees agent METADATA only: who they are, their status, whether a sign-in is
 * linked and the agreements accepted, and how many applications they own (a count). Never a
 * client's name, answers or anything else from an agent's applications.
 *
 * Status is Isaac's switch alone. A new agent is "invited" (not activated yet); "Activate" makes
 * them "active" whether or not they have signed in yet, "Pause" makes them "paused". Linking a
 * sign-in never changes it (lib/tenancy/agent-linking.ts).
 */

import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getIsAdmin } from "@/lib/auth/admin";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { countIntakeSessionsByOwners } from "@/lib/intake-core/server";
import { isValidAgentEmail, normalizeAgentEmail } from "./agent-linking";
import {
  agentProfileForm,
  parseAgentProfilePatch,
  profileErrorMessages,
  type AgentProfileForm,
  type ProfileErrorCodes,
  type ProfileErrors,
} from "./agent-profile-input";
import { getAgentByEmail, getAgentById, getAgentBySlug, listAgents, type AgentRow } from "./agents";
import { agreementsAcceptedByAgent } from "./agreements-store";
import { isUniqueViolationError } from "./db-errors";
import type { AgentStatus } from "./gates";
import { checkAgentSlug, type SlugCheck } from "./slugs";

/** For /api/admin/agents/**: null for an admin, else the 401/403 (middleware checked too). */
export async function requireAdminCaller(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  return null;
}

/** One agent as Isaac's list shows it. */
export type AdminAgentView = {
  id: string;
  email: string;
  slug: string;
  status: AgentStatus;
  isTest: boolean;
  /** A Clerk sign-in is linked (never which one). */
  linked: boolean;
  /** Has accepted the current terms and DPA; null when that couldn't be read. */
  agreementsAccepted: boolean | null;
  /** How many applications they own; null when that couldn't be counted. */
  applications: number | null;
  profile: AgentProfileForm;
  createdAt: string;
};

function statusOf(value: string): AgentStatus {
  return value === "active" || value === "paused" ? value : "invited";
}

export function adminAgentView(
  row: AgentRow,
  extra: { applications: number | null; agreementsAccepted: boolean | null }
): AdminAgentView {
  return {
    id: row.id,
    email: row.email,
    slug: row.slug,
    status: statusOf(row.status),
    isTest: row.isTest,
    linked: Boolean(row.clerkUserId),
    agreementsAccepted: extra.agreementsAccepted,
    applications: extra.applications,
    profile: agentProfileForm(row),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAgentsForAdmin(): Promise<AdminAgentView[]> {
  const rows = await listAgents();
  const owners = rows.map((row) => row.clerkUserId).filter((id): id is string => Boolean(id));
  let counts: Map<string, number> | null = null;
  let agreements: Map<string, boolean> | null = null;
  try {
    counts = await countIntakeSessionsByOwners(owners);
  } catch (error) {
    console.warn("[admin/agents] application counts failed:", error instanceof Error ? error.message : error);
  }
  try {
    agreements = await agreementsAcceptedByAgent(rows.map((row) => row.id));
  } catch (error) {
    console.warn("[admin/agents] agreements read failed:", error instanceof Error ? error.message : error);
  }
  return rows.map((row) =>
    adminAgentView(row, {
      applications: row.clerkUserId ? (counts ? counts.get(row.clerkUserId) ?? 0 : null) : 0,
      agreementsAccepted: agreements ? agreements.get(row.id) ?? false : null,
    })
  );
}

/** One agent's view, after a change (the same counts as the list). */
export async function adminAgentViewOf(row: AgentRow): Promise<AdminAgentView> {
  const [applications, agreementsAccepted] = await Promise.all([
    row.clerkUserId
      ? countIntakeSessionsByOwners([row.clerkUserId]).then(
          (counts) => counts.get(row.clerkUserId as string) ?? 0,
          () => null
        )
      : Promise.resolve(0),
    agreementsAcceptedByAgent([row.id]).then(
      (map) => map.get(row.id) ?? false,
      () => null
    ),
  ]);
  return adminAgentView(row, { applications, agreementsAccepted });
}

/**
 * A change's outcome. `fields`: why each refused profile field was refused, in English words for
 * Isaac's /admin/agents, as codes for the agent's own form (which words them in its language).
 */
export type AdminResult<T, Fields = ProfileErrors> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 409; error: string; fields?: Fields };

const SLUG_MESSAGES: Record<Exclude<SlugCheck, { ok: true }>["reason"], string> = {
  format: "3 to 40 lowercase letters, numbers and single hyphens, starting and ending with a letter or number.",
  reserved: "That address is one of the site's own pages. Pick another.",
  provider_name: "An agent's address can't contain a provider's name (ACN P&P §III.6(e)).",
};

async function checkEmailFree(email: string, selfId: string | null): Promise<string | null> {
  if (!isValidAgentEmail(email)) return "Enter a valid email address.";
  const other = await getAgentByEmail(email);
  return other && other.id !== selfId ? "Another agent already uses this email." : null;
}

async function checkSlugFree(input: unknown, selfId: string | null): Promise<{ slug: string } | { error: string }> {
  const check = checkAgentSlug(input);
  if (!check.ok) return { error: SLUG_MESSAGES[check.reason] };
  const other = await getAgentBySlug(check.slug);
  return other && other.id !== selfId ? { error: "Another agent already uses this address." } : { slug: check.slug };
}

export async function createAgent(body: Record<string, unknown>): Promise<AdminResult<AgentRow>> {
  const email = normalizeAgentEmail(body.email);
  const emailError = await checkEmailFree(email, null);
  if (emailError) return { ok: false, status: emailError.startsWith("Another") ? 409 : 400, error: emailError };
  const slug = await checkSlugFree(body.slug, null);
  if ("error" in slug) return { ok: false, status: slug.error.startsWith("Another") ? 409 : 400, error: slug.error };
  const names = parseAgentProfilePatch({
    firstName: body.firstName ?? "",
    lastName: body.lastName ?? "",
    ...(body.defaultLocale !== undefined ? { defaultLocale: body.defaultLocale } : {}),
  });
  if (!names.ok) return { ok: false, status: 400, error: "Check the highlighted fields.", fields: profileErrorMessages(names.errors, "en") };
  // A test agent unless Isaac says otherwise: until ACN answers in writing, only test agents with
  // fake data may work (lib/tenancy/gates.ts).
  const isTest = body.isTest === false ? false : true;
  try {
    const now = new Date();
    const [row] = await db
      .insert(agents)
      .values({
        id: nanoid(),
        email,
        slug: slug.slug,
        status: "invited",
        isTest,
        firstName: names.patch.firstName ?? null,
        lastName: names.patch.lastName ?? null,
        defaultLocale: names.patch.defaultLocale ?? "en",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return { ok: true, value: row };
  } catch (error) {
    if (isUniqueViolationError(error)) return { ok: false, status: 409, error: "That email or address is already taken." };
    throw error;
  }
}

/**
 * Isaac's edit: the profile fields (same rules as the agent's own form), the test flag, the
 * address, and the login email while no sign-in is linked (after that the email is the account's).
 */
export async function updateAgentAsAdmin(id: string, body: Record<string, unknown>): Promise<AdminResult<AgentRow>> {
  const current = await getAgentById(id);
  if (!current) return { ok: false, status: 404, error: "No such agent." };
  const profile = parseAgentProfilePatch(body);
  if (!profile.ok) {
    return { ok: false, status: 400, error: "Check the highlighted fields.", fields: profileErrorMessages(profile.errors, "en") };
  }
  const set: Partial<typeof agents.$inferInsert> = { ...profile.patch };

  if (body.isTest !== undefined) {
    if (typeof body.isTest !== "boolean") return { ok: false, status: 400, error: "Test agent: yes or no." };
    set.isTest = body.isTest;
  }
  if (body.slug !== undefined && body.slug !== current.slug) {
    const slug = await checkSlugFree(body.slug, current.id);
    if ("error" in slug) return { ok: false, status: slug.error.startsWith("Another") ? 409 : 400, error: slug.error };
    set.slug = slug.slug;
  }
  if (body.email !== undefined) {
    const email = normalizeAgentEmail(body.email);
    if (email !== current.email) {
      if (current.clerkUserId) {
        return { ok: false, status: 400, error: "The email can't change once a sign-in is linked." };
      }
      const emailError = await checkEmailFree(email, current.id);
      if (emailError) return { ok: false, status: emailError.startsWith("Another") ? 409 : 400, error: emailError };
      set.email = email;
    }
  }
  if (Object.keys(set).length === 0) return { ok: true, value: current };
  try {
    const [row] = await db
      .update(agents)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(agents.id, current.id))
      .returning();
    return row ? { ok: true, value: row } : { ok: false, status: 404, error: "No such agent." };
  } catch (error) {
    if (isUniqueViolationError(error)) return { ok: false, status: 409, error: "That email or address is already taken." };
    throw error;
  }
}

/** Isaac's switch: "active" or "paused". */
export async function setAgentStatus(id: string, status: unknown): Promise<AdminResult<AgentRow>> {
  if (status !== "active" && status !== "paused") return { ok: false, status: 400, error: "Status is active or paused." };
  const [row] = await db
    .update(agents)
    .set({ status, updatedAt: new Date() })
    .where(eq(agents.id, id.trim()))
    .returning();
  return row ? { ok: true, value: row } : { ok: false, status: 404, error: "No such agent." };
}

/** The agent's own profile edit (/agent/profile): the profile fields only. Refusals as codes. */
export async function updateAgentProfile(agent: AgentRow, body: unknown): Promise<AdminResult<AgentRow, ProfileErrorCodes>> {
  const profile = parseAgentProfilePatch(body);
  if (!profile.ok) return { ok: false, status: 400, error: "Check the highlighted fields.", fields: profile.errors };
  if (Object.keys(profile.patch).length === 0) return { ok: true, value: agent };
  const [row] = await db
    .update(agents)
    .set({ ...profile.patch, updatedAt: new Date() })
    .where(eq(agents.id, agent.id))
    .returning();
  return row ? { ok: true, value: row } : { ok: false, status: 404, error: "No such agent." };
}
