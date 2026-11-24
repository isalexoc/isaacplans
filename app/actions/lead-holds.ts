"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { getIsAdmin } from "@/lib/auth/admin";
import { GUARD_RECORD_ID_RE } from "@/lib/lead-guard/pseudo-id";
import { discardHeldLead, releaseLeadHold } from "@/lib/lead-guard/release";

/**
 * Admin buttons on /admin/lead-holds (Lead Guard). Both are idempotent: the hold is claimed with a
 * conditional update, so a double click or a second tab does nothing the second time.
 */

export async function releaseLeadHoldAction(
  holdId: string
): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) return { ok: false, error: "Not authorized." };
  if (!GUARD_RECORD_ID_RE.test(holdId)) return { ok: false, error: "Invalid hold." };

  const result = await releaseLeadHold(holdId, userId);
  revalidatePath("/[locale]/admin/lead-holds", "page");
  return result.ok ? { ok: true, warnings: result.warnings } : { ok: false, error: result.error };
}

export async function discardLeadHoldAction(holdId: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) return { ok: false, error: "Not authorized." };
  if (!GUARD_RECORD_ID_RE.test(holdId)) return { ok: false, error: "Invalid hold." };

  const ok = await discardHeldLead(holdId, userId);
  revalidatePath("/[locale]/admin/lead-holds", "page");
  return ok ? { ok: true } : { ok: false, error: "Already released or discarded." };
}
