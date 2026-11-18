/**
 * What the app's own database knows about a lead's calls and purchases (`CallsPort`).
 *
 * Only enums leave this file: disposition, line of business, language and the follow-up date.
 * Never the call summary's free text, which carries health and money details; even the summary's
 * language is extracted in SQL (`->> 'language'`), so the rest of it is never loaded.
 *
 * Fail-soft: every query has its own try/catch. A failed read counts as "no call" / "not a client"
 * and is logged by contact id only.
 */

import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { CallDisposition, LineOfBusiness } from "@/lib/call-summary-structured";
import { db } from "@/lib/db";
import {
  acaConfirmations,
  acaIntakeSessions,
  callSummaryProcessed,
  feIntakeSessions,
  impactEnrollments,
  intakeSessions,
  iulIntakeSessions,
} from "@/lib/db/schema";

import { getAiSetterConfig } from "./config";
import { createAiSetterLogger } from "./log";
import type { CallSignal, CallsPort } from "./types";

const DISPOSITIONS: Record<CallDisposition, true> = {
  sale: true,
  quoted: true,
  follow_up: true,
  appointment_set: true,
  needs_info: true,
  not_interested: true,
  no_decision: true,
  service: true,
  voicemail: true,
  other: true,
};

const LINES_OF_BUSINESS: Record<LineOfBusiness, true> = {
  aca: true,
  stm: true,
  dental_vision: true,
  hospital_indemnity: true,
  iul: true,
  final_expense: true,
  other: true,
};

function logger() {
  return createAiSetterLogger(getAiSetterConfig().debug);
}

/** Error class and a short message only: never a payload. */
function errorSummary(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : "unknown error";
}

function isMember<T extends string>(members: Record<T, true>, value: string): value is T {
  return Object.prototype.hasOwnProperty.call(members, value);
}

/** A known enum value passes; anything else that is set becomes "other", so no free text leaks. */
function enumOrOther<T extends string>(members: Record<T, true>, value: string | null): T | "other" | null {
  if (value === null) return null;
  return isMember(members, value) ? value : "other";
}

async function latestCall(contactId: string): Promise<CallSignal | null> {
  const c = callSummaryProcessed;
  try {
    const rows = await db
      .select({
        disposition: c.disposition,
        lineOfBusiness: c.lineOfBusiness,
        language: sql<string | null>`${c.structuredSummary} ->> 'language'`,
        followUpDateIso: c.followUpDateIso,
        at: c.processedAt,
      })
      .from(c)
      .where(and(eq(c.contactId, contactId), eq(c.status, "completed")))
      .orderBy(desc(c.processedAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      disposition: enumOrOther(DISPOSITIONS, row.disposition),
      lineOfBusiness: enumOrOther(LINES_OF_BUSINESS, row.lineOfBusiness),
      language: row.language === "en" || row.language === "es" ? row.language : null,
      followUpDateIso: row.followUpDateIso,
      at: row.at,
    };
  } catch (error) {
    logger().warn("Latest-call read failed; treated as no call", { contactId, error: errorSummary(error) });
    return null;
  }
}

/** One "this person already bought from Isaac" signal; each resolves to at most one row. */
type ClientCheck = { name: string; find: (contactId: string) => PromiseLike<unknown[]> };

const CLIENT_CHECKS: ClientCheck[] = [
  {
    name: "call_sale",
    find: (id) =>
      db
        .select({ id: callSummaryProcessed.messageId })
        .from(callSummaryProcessed)
        .where(and(eq(callSummaryProcessed.contactId, id), eq(callSummaryProcessed.disposition, "sale")))
        .limit(1),
  },
  {
    name: "impact_enrollment",
    find: (id) =>
      db
        .select({ id: impactEnrollments.crmContactId })
        .from(impactEnrollments)
        .where(eq(impactEnrollments.crmContactId, id))
        .limit(1),
  },
  {
    name: "aca_confirmation_signed",
    find: (id) =>
      db
        .select({ id: acaConfirmations.id })
        .from(acaConfirmations)
        .where(and(eq(acaConfirmations.crmContactId, id), eq(acaConfirmations.status, "signed")))
        .limit(1),
  },
  {
    name: "iul_intake_completed",
    find: (id) =>
      db
        .select({ id: iulIntakeSessions.id })
        .from(iulIntakeSessions)
        .where(and(eq(iulIntakeSessions.crmContactId, id), eq(iulIntakeSessions.status, "completed")))
        .limit(1),
  },
  {
    name: "aca_intake_completed",
    find: (id) =>
      db
        .select({ id: acaIntakeSessions.id })
        .from(acaIntakeSessions)
        .where(and(eq(acaIntakeSessions.crmContactId, id), eq(acaIntakeSessions.status, "completed")))
        .limit(1),
  },
  {
    name: "fe_intake_completed",
    find: (id) =>
      db
        .select({ id: feIntakeSessions.id })
        .from(feIntakeSessions)
        .where(and(eq(feIntakeSessions.crmContactId, id), eq(feIntakeSessions.status, "completed")))
        .limit(1),
  },
  {
    name: "intake_completed",
    find: (id) =>
      db
        .select({ id: intakeSessions.id })
        .from(intakeSessions)
        .where(and(eq(intakeSessions.crmContactId, id), eq(intakeSessions.status, "completed")))
        .limit(1),
  },
];

async function passes(check: ClientCheck, contactId: string): Promise<boolean> {
  try {
    const rows = await check.find(contactId);
    return rows.length > 0;
  } catch (error) {
    logger().warn("Client check failed; counted as not a client", {
      check: check.name,
      contactId,
      error: errorSummary(error),
    });
    return false;
  }
}

/** Sold on a call, enrolled in Impact, signed an ACA confirmation, or completed any intake. */
async function isClient(contactId: string): Promise<boolean> {
  const results = await Promise.all(CLIENT_CHECKS.map((check) => passes(check, contactId)));
  return results.includes(true);
}

/** `CallsPort` over the app database: the latest call as enums only, and the "already a client" test. */
export const aiSetterCalls: CallsPort = { latestCall, isClient };
