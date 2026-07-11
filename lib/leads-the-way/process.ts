/**
 * Core processor: turn a stored Leads the Way email into a GoHighLevel (Agent CRM) contact upsert.
 * Mirrors `lib/kixie-call-processor.ts`'s claim → work → mark contract.
 *
 * The critical rule: match on PHONE FIRST and UPDATE the existing contact. On a live transfer the
 * operator's call to the CRM number already created a phone-only contact before this email arrives,
 * so we must enrich that same contact (name/email/address/DOB) rather than create a duplicate.
 */

import {
  AGENT_CRM_API_BASE,
  agentCrmAddContactTags,
  agentCrmAuthHeaders,
  agentCrmFindContactByEmail,
  agentCrmFindContactByPhone,
  agentCrmGetBaseCredentials,
  agentCrmIsDuplicateContactError,
  agentCrmJsonHeaders,
  agentCrmUpdateContact,
  type AgentCrmCreateContactErrorBody,
  type AgentCrmNativeFields,
} from "@/lib/agent-crm-contacts";
import {
  mergeCustomFieldsWithUpdates,
  resolveLeadSourceDetailsCustomField,
  type CrmCustomFieldRow,
} from "@/lib/agent-crm-contact-append";
import {
  getLeadsTheWayConfig,
  isLeadsTheWayConfigured,
  resolveLeadTags,
} from "@/lib/leads-the-way/config";
import { deriveLeadKey, parseLeadEmail, toE164, type ParsedLead } from "@/lib/leads-the-way/parse";
import { extractLeadWithOpenAI } from "@/lib/leads-the-way/extract-openai";
import {
  claimLeadByMessageId,
  findClaimableLeads,
  leadRetryBackoffMs,
  markLeadProcessed,
} from "@/lib/leads-the-way/store";
import { createLeadsTheWayLogger, type LeadsTheWayLogger } from "@/lib/leads-the-way/log";
import { publishJob } from "@/lib/qstash/client";

export const LEADS_THE_WAY_QUEUE_PATH = "/api/queue/leads-the-way";

export type LeadProcessResult = {
  processed: boolean; // did we attempt real work on a claimed job?
  ok: boolean;
  reason?: string;
  contactId?: string;
};

/** Reasons that will never succeed on retry → the queue route returns 2xx so QStash stops. */
export const LEADS_THE_WAY_PERMANENT_REASONS = new Set([
  "not_claimable",
  "no_raw_email",
  "no_phone",
  "not_found",
]);

function presentNativeFields(parsed: ParsedLead, includePhone: string | null): AgentCrmNativeFields {
  const native: AgentCrmNativeFields = {};
  if (parsed.firstName) native.firstName = parsed.firstName;
  if (parsed.lastName) native.lastName = parsed.lastName;
  if (parsed.email) native.email = parsed.email;
  if (parsed.dateOfBirth) native.dateOfBirth = parsed.dateOfBirth;
  if (parsed.address1) native.address1 = parsed.address1;
  if (parsed.city) native.city = parsed.city;
  if (parsed.state) native.state = parsed.state;
  if (parsed.postalCode) native.postalCode = parsed.postalCode;
  if (includePhone) native.phone = includePhone;
  return native;
}

function leadSourceDetailsText(parsed: ParsedLead): string {
  const parts = [
    parsed.leadType ? `Leads the Way — ${parsed.leadType}` : "Leads the Way",
    parsed.leadId ? `Lead ID ${parsed.leadId}` : null,
    parsed.purchaseDate ? `Purchased ${parsed.purchaseDate}` : null,
    parsed.purchasePrice ? `$${parsed.purchasePrice}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function parsedSnapshot(parsed: ParsedLead): Record<string, string | undefined> {
  return { ...parsed };
}

/** Phone-first resolve; create a new contact with the correct source only when nothing matches. */
async function resolveOrCreateContact(
  parsed: ParsedLead,
  phoneE164: string,
  locationId: string,
  token: string,
  log: LeadsTheWayLogger
): Promise<{ contactId: string; matchedBy: "phone" | "email" | "created" } | null> {
  const byPhone = await agentCrmFindContactByPhone(phoneE164, locationId, token, "[LEADS_THE_WAY]");
  if (byPhone?.id) return { contactId: byPhone.id, matchedBy: "phone" };

  if (parsed.email) {
    const byEmail = await agentCrmFindContactByEmail(parsed.email, locationId, token, "[LEADS_THE_WAY]");
    if (byEmail?.id) return { contactId: byEmail.id, matchedBy: "email" };
  }

  // Nothing matched → create with the correct Leads the Way attribution.
  const body: Record<string, unknown> = { locationId, source: "leads_the_way", phone: phoneE164 };
  if (parsed.email) body.email = parsed.email;
  if (parsed.firstName) body.firstName = parsed.firstName;
  if (parsed.lastName) body.lastName = parsed.lastName;

  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/`, {
    method: "POST",
    headers: agentCrmJsonHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.ok) {
    try {
      const data = JSON.parse(text);
      const id = data?.contact?.id ?? data?.id;
      if (typeof id === "string") return { contactId: id, matchedBy: "created" };
    } catch {
      /* fall through */
    }
  }

  // Duplicate race → resolve from the error meta or a follow-up search.
  let errBody: AgentCrmCreateContactErrorBody = {};
  try {
    errBody = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (agentCrmIsDuplicateContactError(res.status, errBody)) {
    const metaId = errBody.meta?.contactId;
    if (typeof metaId === "string") return { contactId: metaId, matchedBy: "phone" };
    const retryPhone = await agentCrmFindContactByPhone(phoneE164, locationId, token, "[LEADS_THE_WAY]");
    if (retryPhone?.id) return { contactId: retryPhone.id, matchedBy: "phone" };
    if (parsed.email) {
      const retryEmail = await agentCrmFindContactByEmail(parsed.email, locationId, token, "[LEADS_THE_WAY]");
      if (retryEmail?.id) return { contactId: retryEmail.id, matchedBy: "email" };
    }
  }

  log.error("Create contact failed", { status: res.status, body: text.slice(0, 300) });
  return null;
}

/** Read a contact's existing custom fields so a PUT doesn't wipe them (PUT replaces the array). */
async function fetchExistingCustomFields(contactId: string, token: string): Promise<unknown> {
  try {
    const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}`, {
      headers: agentCrmAuthHeaders(token),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const c = data?.contact ?? data;
    return c?.customFields ?? null;
  } catch {
    return null;
  }
}

/**
 * Process one queued lead by its key. Return contract (like the Kixie processor):
 * - processed:false          → nothing to do (not claimable) → route 2xx
 * - processed:true, ok:true  → success → route 2xx
 * - processed:true, ok:false, reason ∉ PERMANENT → transient → route 500 (QStash retries)
 */
export async function processLeadJobById(
  leadKey: string,
  log: LeadsTheWayLogger = createLeadsTheWayLogger()
): Promise<LeadProcessResult> {
  const config = getLeadsTheWayConfig();

  const claimed = await claimLeadByMessageId(leadKey, log);
  if (!claimed) return { processed: false, ok: true, reason: "not_claimable" };

  if (!isLeadsTheWayConfigured(config)) {
    // Deploy/config issue — don't burn an attempt; leave it for the daily reconcile once fixed.
    log.error("Not configured; deferring lead", { leadKey });
    await markLeadProcessed(
      { leadKey, status: "pending", errorMessage: "not_configured", jobState: claimed.jobState ?? null },
      log
    );
    return { processed: false, ok: false, reason: "not_configured" };
  }

  const creds = agentCrmGetBaseCredentials();
  if (!creds) {
    await markLeadProcessed({ leadKey, status: "pending", errorMessage: "no_credentials" }, log);
    return { processed: false, ok: false, reason: "no_credentials" };
  }
  const { token, locationId } = creds;

  const rawText = claimed.jobState?.rawText ?? "";
  if (!rawText.trim()) {
    log.warn("No raw email stored", { leadKey });
    await markLeadProcessed({ leadKey, status: "skipped", errorMessage: "no_raw_email" }, log);
    return { processed: true, ok: false, reason: "no_raw_email" };
  }

  // Parse deterministically, then fill gaps with OpenAI when we still lack a phone.
  let parsed = parseLeadEmail(rawText);
  if (!toE164(parsed.phone) && config.aiFallback) {
    log.info("Deterministic parse missing phone; trying OpenAI fallback", { leadKey });
    const ai = await extractLeadWithOpenAI(rawText, config);
    if (ai) {
      const merged: ParsedLead = { ...ai };
      for (const [k, v] of Object.entries(parsed) as [keyof ParsedLead, string | undefined][]) {
        if (v) merged[k] = v; // prefer deterministic values where present
      }
      parsed = merged;
    }
  }

  const phoneE164 = toE164(parsed.phone);
  if (!phoneE164) {
    log.warn("No usable phone in lead email", { leadKey });
    await markLeadProcessed(
      {
        leadKey,
        status: "skipped",
        errorMessage: "no_phone",
        email: parsed.email ?? null,
        leadId: parsed.leadId ?? null,
        jobState: { ...(claimed.jobState ?? {}), step: "parse", parsed: parsedSnapshot(parsed) },
      },
      log
    );
    return { processed: true, ok: false, reason: "no_phone" };
  }

  const attempt = (claimed.attemptCount ?? 0) + 1;

  try {
    // 1. Resolve the contact (phone first) or create it.
    const resolved = await resolveOrCreateContact(parsed, phoneE164, locationId, token, log);
    if (!resolved) {
      await markLeadProcessed(
        {
          leadKey,
          status: "failed",
          errorMessage: "crm_resolve_failed",
          phone: phoneE164,
          email: parsed.email ?? null,
          leadId: parsed.leadId ?? null,
          attemptCount: attempt,
          nextRetryAt: new Date(Date.now() + leadRetryBackoffMs(attempt)),
        },
        log
      );
      return { processed: true, ok: false, reason: "crm_resolve_failed" };
    }
    const { contactId, matchedBy } = resolved;

    // 2. Update native fields (only those present → never clobber existing data). Include the phone
    //    only when we matched by email (enrich a contact that may lack it); the phone-matched
    //    contact already has it.
    const native = presentNativeFields(parsed, matchedBy === "email" ? phoneE164 : null);

    // 3. Merge the lead_source_details custom field (preserve any existing custom fields).
    let customFields: CrmCustomFieldRow[] | undefined;
    const field = await resolveLeadSourceDetailsCustomField(AGENT_CRM_API_BASE, locationId, token);
    if (field?.id) {
      const existing = await fetchExistingCustomFields(contactId, token);
      customFields = mergeCustomFieldsWithUpdates(existing, [
        { id: field.id, key: field.key, field_value: leadSourceDetailsText(parsed) },
      ]);
    }

    const updated = await agentCrmUpdateContact(
      contactId,
      { native, customFields: customFields as { id: string; field_value: string }[] | undefined },
      token,
      "[LEADS_THE_WAY]"
    );
    if (!updated) log.warn("Contact update returned false (non-fatal)", { leadKey, contactId });

    // 4. Apply tags — POST fires the existing Senior Life workflows/automations.
    const tags = resolveLeadTags(config, parsed.leadType);
    const tagged = await agentCrmAddContactTags(contactId, tags, token, "[LEADS_THE_WAY]");
    if (!tagged) log.warn("Add tags returned false (non-fatal)", { leadKey, contactId, tags });

    await markLeadProcessed(
      {
        leadKey,
        status: "completed",
        contactId,
        locationId,
        phone: phoneE164,
        email: parsed.email ?? null,
        leadId: parsed.leadId ?? null,
        attemptCount: attempt,
        jobState: { step: "tag", parsed: parsedSnapshot(parsed) },
      },
      log
    );

    log.info("Lead synced to CRM", { leadKey, contactId, matchedBy, tags });
    return { processed: true, ok: true, contactId };
  } catch (err) {
    log.error("Lead processing threw", { leadKey, error: err instanceof Error ? err.message : String(err) });
    await markLeadProcessed(
      {
        leadKey,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "exception",
        phone: phoneE164,
        attemptCount: attempt,
        nextRetryAt: new Date(Date.now() + leadRetryBackoffMs(attempt)),
      },
      log
    );
    return { processed: true, ok: false, reason: "exception" };
  }
}

/**
 * Daily safety-net: reprocess any leads QStash never delivered (pending / stale / retryable-failed).
 * Called from `/api/cron/queue-reconcile`. Re-publishes to QStash when available, else processes inline.
 */
export async function reconcileLeadJobs(
  requestOrigin: string,
  log: LeadsTheWayLogger = createLeadsTheWayLogger()
): Promise<{ found: number; processed: number; republished: number }> {
  const claimable = await findClaimableLeads(25, log);
  let processed = 0;
  let republished = 0;

  for (const row of claimable) {
    const published = await publishJob({
      path: LEADS_THE_WAY_QUEUE_PATH,
      body: { messageId: row.leadKey },
      requestOrigin,
      retries: 3,
    });
    if (published) {
      republished += 1;
      continue;
    }
    // QStash disabled/failed → process inline.
    const result = await processLeadJobById(row.leadKey, log);
    if (result.ok) processed += 1;
  }

  log.info("Lead reconcile complete", { found: claimable.length, processed, republished });
  return { found: claimable.length, processed, republished };
}

// Re-export so route handlers have one import site.
export { deriveLeadKey, parseLeadEmail, toE164 };
