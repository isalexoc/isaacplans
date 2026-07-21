import {
  createCallSummaryLogger,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";
import { getMissedCallDraftsConfig, isMissedCallDraftsConfigured } from "@/lib/missed-call-drafts/config";
import {
  claimMissedCallDraft,
  completeMissedCallDraft,
  failMissedCallDraft,
  bumpMissedCallDraftAttempt,
  missedCallDraftKey,
} from "@/lib/missed-call-drafts/store";
import { generateMissedCallDrafts } from "@/lib/missed-call-drafts/openai";
import { formatMissedCallDraftNote } from "@/lib/missed-call-drafts/note-format";
import { localCalendarDateKey } from "@/lib/timezone";
import { agentCrmGetContactNative, agentCrmFetchContactById } from "@/lib/agent-crm-contacts";
import { getMostRecentCompletedCall } from "@/lib/call-dashboard";
import type { CallLanguage, LineOfBusiness, StructuredCallSummary } from "@/lib/call-summary-structured";

export type MissedCallDraftInput = {
  contactId: string;
  locationId: string;
  reason: string;
  dateAdded?: string;
  source: "ghl" | "kixie";
};

export type MissedCallDraftOutcome = { ok: boolean; reason?: string; noteId?: string | null };

function inferLanguageFromTags(tags: string[]): CallLanguage {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => t.includes("spanish"))) return "es";
  if (lower.some((t) => t.includes("english"))) return "en";
  return "es"; // confirmed default when no signal exists
}

function buildPolicySummary(structured: StructuredCallSummary | null): string | undefined {
  const policy = structured?.policy;
  if (policy && (policy.carrier || policy.faceAmount || policy.premium)) {
    return [policy.carrier, policy.faceAmount, policy.premium].filter(Boolean).join(" — ");
  }
  const quote = structured?.quotes?.[0];
  if (quote && (quote.carrier || quote.faceAmount || quote.premium)) {
    return [quote.carrier, quote.faceAmount, quote.premium].filter(Boolean).join(" — ");
  }
  return undefined;
}

/**
 * Called when a call goes unanswered/busy/failed (GHL or Kixie). Generates two
 * follow-up drafts (SMS + WhatsApp) and posts them as a CRM note for Isaac to
 * review — never auto-sent. Collapses to one draft per contact per local
 * calendar day so triple-dialing doesn't spam three notes. Never throws.
 */
export async function maybeGenerateMissedCallDraft(
  input: MissedCallDraftInput,
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<MissedCallDraftOutcome> {
  try {
    const config = getMissedCallDraftsConfig();
    if (!isMissedCallDraftsConfigured(config)) {
      return { ok: false, reason: "not_configured" };
    }

    if (input.dateAdded) {
      const callTime = new Date(input.dateAdded).getTime();
      if (Number.isFinite(callTime) && Date.now() - callTime > config.maxAgeMs) {
        log.info("Missed-call draft skipped: call too old", { contactId: input.contactId, dateAdded: input.dateAdded });
        return { ok: false, reason: "call_too_old" };
      }
    }

    const dayKey = localCalendarDateKey(new Date(), config.timezone);
    const draftKey = missedCallDraftKey(input.contactId, dayKey);

    const claim = await claimMissedCallDraft(
      { draftKey, contactId: input.contactId, locationId: input.locationId, reason: input.reason, source: input.source },
      log
    );
    if (!claim.claimed) {
      await bumpMissedCallDraftAttempt(draftKey, log);
      return { ok: false, reason: "already_drafted_today", noteId: claim.existing?.noteId ?? null };
    }

    const token = config.callSummary.piToken!;

    const [contact, priorCall] = await Promise.all([
      agentCrmGetContactNative(input.contactId, token),
      getMostRecentCompletedCall(input.contactId),
    ]);

    let language: CallLanguage;
    let lineOfBusiness: LineOfBusiness;
    let priorContext: { summary?: string; policySummary?: string } | undefined;

    if (priorCall?.structuredSummary) {
      language = priorCall.structuredSummary.language;
      lineOfBusiness = priorCall.lineOfBusiness;
      priorContext = {
        summary: priorCall.structuredSummary.summary || undefined,
        policySummary: buildPolicySummary(priorCall.structuredSummary),
      };
    } else {
      const crmContact = await agentCrmFetchContactById(input.contactId, input.locationId, token);
      language = inferLanguageFromTags(crmContact?.tags ?? []);
      lineOfBusiness = "final_expense";
      priorContext = undefined;
    }

    const drafts = await generateMissedCallDrafts(
      { contactFirstName: contact?.firstName || null, language, lineOfBusiness, priorContext },
      config,
      log
    );

    const body = formatMissedCallDraftNote(drafts, language, { dateAdded: input.dateAdded, reason: input.reason });

    const { createContactNote } = await import("@/lib/agent-crm-call-summary");
    const noteId = await createContactNote({ contactId: input.contactId, token, title: config.notePrefix, body }, log);

    await completeMissedCallDraft(
      draftKey,
      { noteId, smsDraft: drafts.sms, whatsappDraft: drafts.whatsapp, lineOfBusiness, language },
      log
    );

    log.info("Missed-call draft note created", { contactId: input.contactId, noteId, source: input.source });
    return { ok: true, noteId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Missed-call draft generation failed", { contactId: input.contactId, error: message });
    try {
      const config = getMissedCallDraftsConfig();
      const dayKey = localCalendarDateKey(new Date(), config.timezone);
      await failMissedCallDraft(missedCallDraftKey(input.contactId, dayKey), message, log);
    } catch {
      // best-effort only — never let cleanup failure mask the original error
    }
    return { ok: false, reason: message };
  }
}
