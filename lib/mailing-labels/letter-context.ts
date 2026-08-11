import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { callSummaryProcessed, feIntakeSessions } from "@/lib/db/schema";
import { agentCrmFetchContactNotes } from "@/lib/agent-crm-notes";
import { maskSensitiveNumbers } from "@/lib/call-summary-structured";
import type { StructuredCallSummary } from "@/lib/call-summary-structured";
import type { MailingLabelRecord } from "./types";

/**
 * Gathers everything we legitimately know about a prospect so the letter can sound like it
 * remembers them rather than like a mail merge.
 *
 * Three sources, because no single one is complete:
 *  - Beneficiaries from a completed Final Expense intake. The strongest personal detail we ever
 *    have — the actual people they said they want taken care of — and it appears nowhere in the
 *    call notes.
 *  - Structured call summaries (`call_summary_processed.structured_summary`). Rich when present,
 *    but only about a third of summaries have one and the sections are often sparse.
 *  - Raw CRM note text, which every summarized call has. The dependable backbone.
 *
 * WHAT IS DELIBERATELY WITHHELD: this is a letter that travels through the mail and can be opened
 * by anyone in the household. Health conditions, medications, income, budgets, premiums, face
 * amounts, policy numbers, and dates of birth are never sent to the model, so they can never reach
 * the page. The list below is an allowlist for exactly that reason — a new field added to
 * StructuredCallSummary stays out until someone deliberately opts it in.
 */

const MAX_SUMMARIES = 5;
const MAX_NOTES = 6;
const MAX_NOTE_CHARS = 700;

export type LetterContext = {
  /** Short factual lines the model may draw on. */
  facts: string[];
  /** Narrative snippets from past calls, newest first. */
  conversations: string[];
  /** Human-readable provenance, stored on the label and shown in the UI. */
  label: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * Strip currency figures out of free-text notes.
 *
 * The structured fields are allowlisted, but raw call notes are not — and they routinely carry the
 * quote that was given ("Senior Life Bronce — $3,000 — $27.33"). Telling the model not to mention
 * money while handing it the numbers is not a control, so the numbers don't go in the prompt at
 * all. Coverage amounts and prices belong in a conversation, not in a letter anyone can open.
 */
export function redactAmounts(text: string): string {
  return text
    .replace(/\$\s?\d[\d,]*(?:\.\d{1,2})?/g, "[amount]")
    .replace(/\b\d[\d,]*(?:\.\d{1,2})?\s*(?:dolares|dólares|dollars|usd)\b/gi, "[amount]");
}

/** "Maria Rodriguez (daughter)" from an intake beneficiary row. */
function describeBeneficiary(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const r = row as Record<string, unknown>;
  const name = [clean(r.firstName), clean(r.lastName)].filter(Boolean).join(" ");
  if (!name) return "";
  const relationship = clean(r.relationship).toLowerCase();
  return relationship ? `${name} (${relationship})` : name;
}

/** Beneficiaries a client named on the intake form. Not encrypted, and survives purge. */
async function beneficiariesFromIntake(record: MailingLabelRecord): Promise<string[]> {
  if (record.source !== "fe_intake" || !record.sourceRef) return [];
  try {
    const rows = await db
      .select({ data: feIntakeSessions.data })
      .from(feIntakeSessions)
      .where(eq(feIntakeSessions.token, record.sourceRef))
      .limit(1);

    const raw = (rows[0]?.data ?? {}) as Record<string, unknown>;
    const list = raw.beneficiaries;
    if (!Array.isArray(list)) return [];
    return list.map(describeBeneficiary).filter(Boolean).slice(0, 4);
  } catch (error) {
    console.warn("[mailing-labels] Could not read intake beneficiaries:", error);
    return [];
  }
}

/** The allowlisted slice of a structured summary. Everything not named here is dropped. */
function factsFromSummary(summary: StructuredCallSummary): {
  facts: string[];
  narrative: string;
} {
  const facts: string[] = [];
  const profile = summary.clientProfile ?? {};
  const policy = summary.policy ?? {};

  const beneficiary = clean(policy.beneficiary);
  if (beneficiary) facts.push(`Who they want taken care of: ${beneficiary}`);

  const spouse = clean(profile.spouse);
  if (spouse) facts.push(`Spouse: ${spouse}`);

  const marital = clean(profile.maritalStatus);
  if (marital && !spouse) facts.push(`Marital status: ${marital}`);

  const household = clean(profile.householdSize);
  if (household) facts.push(`Household size: ${household}`);

  const occupation = clean(profile.occupation);
  if (occupation) facts.push(`Occupation: ${occupation}`);

  // Existing coverage is useful context ("something already in place"), but never the amounts.
  const currentCoverage = clean(policy.currentCoverage);
  const carrier = clean(policy.carrier);
  if (currentCoverage || carrier) {
    facts.push(
      `Already has some coverage in place${carrier ? ` (through ${carrier})` : ""} — do not quote or compare it`
    );
  }

  const objections = (summary.objections ?? []).map(clean).filter(Boolean);
  if (objections.length > 0) {
    facts.push(`Concerns they raised: ${objections.slice(0, 3).join("; ")}`);
  }

  const nextSteps = (summary.nextSteps ?? [])
    .map((step) => clean(typeof step === "string" ? step : (step as { description?: string })?.description))
    .filter(Boolean);
  if (nextSteps.length > 0) {
    facts.push(`What was agreed last time: ${nextSteps.slice(0, 2).join("; ")}`);
  }

  return { facts, narrative: clean(summary.summary) };
}

async function structuredForContact(contactId: string): Promise<StructuredCallSummary[]> {
  try {
    const rows = await db
      .select({ summary: callSummaryProcessed.structuredSummary })
      .from(callSummaryProcessed)
      .where(
        and(
          eq(callSummaryProcessed.contactId, contactId),
          isNotNull(callSummaryProcessed.structuredSummary)
        )
      )
      .orderBy(desc(callSummaryProcessed.processedAt))
      .limit(MAX_SUMMARIES);
    return rows.map((r) => r.summary).filter((s): s is StructuredCallSummary => Boolean(s));
  } catch (error) {
    console.warn("[mailing-labels] Could not read structured summaries:", error);
    return [];
  }
}

export async function buildLetterContext(record: MailingLabelRecord): Promise<LetterContext> {
  const facts: string[] = [];
  const conversations: string[] = [];
  const provenance: string[] = [];

  const beneficiaries = await beneficiariesFromIntake(record);
  if (beneficiaries.length > 0) {
    facts.push(`People they named to be taken care of: ${beneficiaries.join(", ")}`);
    provenance.push(
      `${beneficiaries.length} beneficiar${beneficiaries.length === 1 ? "y" : "ies"} from their form`
    );
  }

  if (record.crmContactId) {
    const summaries = await structuredForContact(record.crmContactId);
    let structuredFacts = 0;
    for (const summary of summaries) {
      const { facts: f, narrative } = factsFromSummary(summary);
      for (const fact of f) {
        if (!facts.includes(fact)) {
          facts.push(fact);
          structuredFacts += 1;
        }
      }
      if (narrative) conversations.push(narrative);
    }
    if (structuredFacts > 0) provenance.push(`${structuredFacts} details from past calls`);

    // Raw notes fill the gap when the structured extraction is thin, which it often is.
    if (conversations.length < 2) {
      const notes = await agentCrmFetchContactNotes(record.crmContactId);
      for (const note of notes.slice(0, MAX_NOTES)) {
        conversations.push(note.body.slice(0, MAX_NOTE_CHARS));
      }
      if (notes.length > 0) {
        provenance.push(`${notes.length} call note${notes.length === 1 ? "" : "s"}`);
      }
    }
  }

  // Card/account digits, then currency figures — both before anything leaves for the model.
  const maskedConversations = conversations
    .map((c) => redactAmounts(maskSensitiveNumbers(c)).trim())
    .filter(Boolean)
    .slice(0, MAX_SUMMARIES);

  const label =
    provenance.length > 0
      ? `Personalized from ${provenance.join(" · ")}`
      : record.crmContactId
        ? "No call history on this contact yet — general letter"
        : "Not linked to a CRM contact — general letter";

  return { facts, conversations: maskedConversations, label };
}
