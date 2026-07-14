/**
 * Lead Backup: inject a manually-entered lead (from a screenshot upload) into the SAME
 * Leads-the-Way pipeline the email path uses. We build a canonical email-template `rawText`
 * from the reviewed fields so `parseLeadEmail` re-parses it deterministically, then enqueue +
 * process exactly like the webhook. Nothing in the email pipeline is modified.
 */

import type { ParsedLead } from "@/lib/leads-the-way/parse";
import { deriveLeadKey, toE164 } from "@/lib/leads-the-way/parse";
import { enqueueLead, getProcessedLead } from "@/lib/leads-the-way/store";
import { processLeadJobById, type LeadProcessResult } from "@/lib/leads-the-way/process";
import type { LeadsTheWayLogger } from "@/lib/leads-the-way/log";

export const BACKUP_FROM = "screenshot-backup";
export const BACKUP_SUBJECT = "Lead Backup";

/**
 * Render the reviewed fields into the exact Senior Life email layout that `parseLeadEmail`
 * understands (LEAD INFORMATION block + labeled PURCHASE INFORMATION fields). Only present
 * fields are emitted.
 */
export function buildLeadRawText(parsed: ParsedLead): string {
  const name = [parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim();
  const cityLine =
    parsed.city && parsed.state && parsed.postalCode
      ? `${parsed.city}, ${parsed.state} ${parsed.postalCode}`
      : parsed.city && parsed.postalCode
        ? `${parsed.city}, ${parsed.postalCode}`
        : null;

  const leadBlock = [name, parsed.phone, parsed.email, parsed.address1, cityLine].filter(
    (l): l is string => Boolean(l && l.trim())
  );

  const purchaseBlock = [
    parsed.leadType ? `Lead Type: ${parsed.leadType}` : null,
    parsed.purchaseDate ? `Purchase Date: ${parsed.purchaseDate}` : null,
    parsed.purchasePrice ? `Purchase Price: $${parsed.purchasePrice.replace(/^\$/, "")}` : null,
    parsed.leadId ? `Lead Id: ${parsed.leadId}` : null,
    parsed.dateOfBirth ? `Date of Birth: ${parsed.dateOfBirth}` : null,
  ].filter((l): l is string => Boolean(l));

  return ["LEAD INFORMATION", ...leadBlock, "PURCHASE INFORMATION", ...purchaseBlock].join("\n");
}

export type InjectBackupResult = {
  leadKey: string;
  queued: boolean;
  alreadyProcessed: boolean;
  existingStatus?: string;
  result?: LeadProcessResult;
};

/**
 * Enqueue + process a backup lead inline (immediate feedback for the admin). Dedup-aware: if the
 * lead was already completed (e.g. the email arrived after all), we don't reprocess.
 */
export async function injectBackupLead(
  parsed: ParsedLead,
  log: LeadsTheWayLogger
): Promise<InjectBackupResult> {
  const rawText = buildLeadRawText(parsed);
  const ctx = { from: BACKUP_FROM, subject: BACKUP_SUBJECT, rawText };
  const leadKey = deriveLeadKey(parsed, ctx);

  const existing = await getProcessedLead(leadKey, log);
  if (existing?.status === "completed" || existing?.status === "skipped") {
    return { leadKey, queued: false, alreadyProcessed: true, existingStatus: existing.status };
  }

  const enq = await enqueueLead(
    {
      leadKey,
      phone: toE164(parsed.phone),
      email: parsed.email ?? null,
      leadId: parsed.leadId ?? null,
      jobState: {
        step: "parse",
        rawText,
        from: BACKUP_FROM,
        subject: BACKUP_SUBJECT,
        parsed: { ...parsed },
      },
    },
    log
  );

  // Process inline so the admin sees the result now; the daily reconcile cron is the retry net.
  const result = await processLeadJobById(leadKey, log);

  return { leadKey, queued: enq.queued, alreadyProcessed: false, result };
}
