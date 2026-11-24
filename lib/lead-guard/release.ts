import "server-only";

import { createContactCore, type CreateContactContext } from "@/lib/create-contact/core";
import { processLeadMagnetDownload } from "@/lib/lead-magnets/download";
import { processPartnerLead } from "@/lib/referral-partners/public-lead";

import { parseGuardPseudoId } from "./pseudo-id";
import { leadGuardSiteBaseUrl } from "./site-url";
import {
  claimLeadHoldForRelease,
  deleteLeadHoldAppends,
  discardLeadHold,
  failLeadHoldRelease,
  getLeadHoldDetail,
  listAppendsAfter,
  markLeadHoldReleased,
  recordLeadHoldReleaseWarnings,
} from "./store";
import { WEB_RELEASED_TAG, WEB_VERIFIED_TAG } from "./tags";

/**
 * Isaac's "Release": replay a held lead exactly as it arrived, in-process, so the normal flow runs
 * (contact, tags, workflows — also when the contact already existed — and CAPI with the original
 * event time, consent recorded at the original submit time), then replay any step-2 data the funnel
 * filed with the hold against the real contact.
 *
 * One click wins: the hold is claimed atomically. A release whose CRM step did not complete stays
 * held with the error, so it can be retried and nothing is lost. Once the CRM step succeeded the
 * hold is marked released BEFORE the step-2 drain: a funnel save arriving after that is forwarded
 * live to the real contact, and the drain picks up everything filed before it.
 */

/** Meta deduplicates a server event with the browser Pixel only within ~48 h of the original. */
const CAPI_DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_DRAIN_ROUNDS = 5;

export type ReleaseResult =
  | { ok: true; contactId: string | null; warnings: string[] }
  | { ok: false; error: string };

type Released = NonNullable<CreateContactContext["released"]>;

async function replay(
  route: string,
  body: Record<string, unknown>,
  visitor: { ip?: string; ua?: string } | null,
  released: Released
): Promise<{ ok: boolean; contactId: string | null; error: string | null }> {
  if (route === "/api/create-contact") {
    const result = await createContactCore(body, {
      visitor,
      extraTags: [WEB_VERIFIED_TAG, WEB_RELEASED_TAG],
      released,
    });
    const contactId = typeof result.body.contactId === "string" ? result.body.contactId : null;
    // A 502 means the contact exists but the merge itself failed (nothing of the lead was written):
    // keep it held and retryable.
    const ok = Boolean(contactId) && result.status < 400;
    return { ok, contactId, error: ok ? null : `create-contact ${result.status}: ${String(result.body.error ?? "")}` };
  }
  if (route === "/api/partners/lead") {
    // The referral row is stored before the CRM push, so the lead is never lost here.
    const result = await processPartnerLead(body, visitor, released);
    const ok = result.status < 400;
    return { ok, contactId: null, error: ok ? null : `partners ${result.status}: ${String(result.body.error ?? "")}` };
  }
  if (route === "/api/lead-magnets/download") {
    const result = await processLeadMagnetDownload(body, { visitor, leadAllowed: true, released });
    // A 200 always serves the PDF; the CRM step is what matters for a release.
    const crmFailed = result.crm ? result.crm.status >= 400 || !result.crm.contactId : false;
    const ok = result.status < 400 && !crmFailed;
    return {
      ok,
      contactId: result.crm?.contactId ?? null,
      error: ok ? null : `lead magnet ${result.status}${result.crm ? `, CRM ${result.crm.status}` : ""}`,
    };
  }
  return { ok: false, contactId: null, error: `unknown route ${route}` };
}

export async function releaseLeadHold(holdId: string, adminUserId: string): Promise<ReleaseResult> {
  const claimed = await claimLeadHoldForRelease(holdId);
  if (!claimed) return { ok: false, error: "Already released, discarded or being released." };

  const detail = await getLeadHoldDetail(holdId);
  if (!detail?.payload) {
    await failLeadHoldRelease(holdId, "The held data is unreadable.");
    return { ok: false, error: "The held data is unreadable." };
  }

  const body = { ...detail.payload.body };
  if (Date.now() - claimed.createdAt.getTime() > CAPI_DEDUP_WINDOW_MS && body.meta && typeof body.meta === "object") {
    // Past the dedup window a replayed CAPI Lead would count twice; the Pixel already reported it.
    const { eventId: _drop, ...rest } = body.meta as Record<string, unknown>;
    body.meta = rest;
  }

  let contactId: string | null = null;
  try {
    const result = await replay(claimed.route, body, detail.payload.ctx ?? null, {
      holdId,
      by: adminUserId,
      submittedAt: claimed.createdAt.toISOString(),
      reasons: (claimed.reasons ?? []) as string[],
    });
    if (!result.ok) {
      await failLeadHoldRelease(holdId, result.error ?? "Release failed.");
      return { ok: false, error: result.error ?? "Release failed." };
    }
    // Never "release" into a stand-in id: that would mark the lead done while it is nowhere.
    if (result.contactId && parseGuardPseudoId(result.contactId)) {
      await failLeadHoldRelease(holdId, "The CRM step returned a stand-in id, not a contact.");
      return { ok: false, error: "The CRM step returned a stand-in id, not a contact." };
    }
    contactId = result.contactId;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await failLeadHoldRelease(holdId, error);
    return { ok: false, error };
  }

  await markLeadHoldReleased(holdId, { contactId, by: adminUserId });

  // Step-2 drain: what was filed before, then anything filed until the hold turned "released".
  const warnings: string[] = [];
  const seen: string[] = [];
  let pending: Array<{ id: string; route: string; body: Record<string, unknown> }> = detail.appends;
  for (let round = 0; round < MAX_DRAIN_ROUNDS; round++) {
    for (const a of pending) {
      seen.push(a.id);
      if (!contactId) {
        warnings.push(`${a.route} skipped: no contact id came back.`);
        continue;
      }
      try {
        const res = await fetch(`${leadGuardSiteBaseUrl()}${a.route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...a.body, contactId }),
          cache: "no-store",
        });
        if (!res.ok) warnings.push(`${a.route} answered ${res.status}`);
      } catch (err) {
        warnings.push(`${a.route}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    pending = await listAppendsAfter(holdId, seen);
    if (pending.length === 0) break;
  }

  await deleteLeadHoldAppends(seen);
  if (warnings.length > 0) await recordLeadHoldReleaseWarnings(holdId, warnings.join("; ").slice(0, 500));
  return { ok: true, contactId, warnings };
}

export async function discardHeldLead(holdId: string, adminUserId: string): Promise<boolean> {
  return discardLeadHold(holdId, adminUserId);
}
