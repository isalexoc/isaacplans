/**
 * Writes a parsed Telegram lead into Agent CRM (GoHighLevel).
 *
 * Kept separate from `process.ts` on purpose: the admin review screen pushes a hand-corrected lead
 * through this exact function, so a reviewed lead gets identical contact-resolution, tagging,
 * cadence and note behaviour. (The email pipeline instead re-synthesises a fake email body and
 * re-enters its whole state machine — see `lib/leads-the-way/backup.ts`.)
 *
 * Deliberately does NOT use `/api/create-contact`: that route has no idempotency, hard-requires a
 * last name, and on its duplicate path returns before workflow enrolment.
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
  agentCrmNormalizeContactTags,
  agentCrmUpdateContact,
  type AgentCrmCreateContactErrorBody,
  type AgentCrmNativeFields,
} from "@/lib/agent-crm-contacts";
import {
  extractCrmEmail,
  getCustomFieldStringValue,
  mergeCustomFieldsWithUpdates,
  resolveLeadSourceDetailsCustomField,
  unwrapContactRecord,
  type CrmCustomFieldRow,
} from "@/lib/agent-crm-contact-append";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import { getIulStep2FieldId } from "@/lib/iul-step2-ads/ghl-field-ids";
import { resolveTimezone } from "@/lib/leads-the-way/timezone";
import {
  TELEGRAM_CADENCE_TAG,
  resolveTelegramTags,
  type TelegramLeadsConfig,
} from "@/lib/telegram/config";
import type { TelegramLogger } from "@/lib/telegram/log";
import type { ParsedTelegramLead } from "@/lib/telegram/parse";

const LOG_PREFIX = "[TELEGRAM_LEADS]";
const CONTACT_SOURCE = "telegram_empiregrowth";

export type CrmPushResult = {
  ok: boolean;
  contactId?: string;
  matchedBy?: "phone" | "email" | "created";
  tagsAdded: string[];
  cadenceStarted: boolean;
  reason?: string;
  dryRun?: boolean;
};

/** Human-readable block for the note and for `lead_source_details`. */
export function formatLeadDetails(
  parsed: ParsedTelegramLead,
  ctx: { chatId?: string | null; messageId?: string | null; receivedAt?: Date }
): string {
  const name = [parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim();
  const received = (ctx.receivedAt ?? new Date()).toISOString();
  return [
    "Empiregrowth IUL Lead (Telegram)",
    "================================",
    "",
    `  Name: ${name || "Not provided"}`,
    `  Phone: ${parsed.phoneE164 || "Not provided"}`,
    `  Email: ${parsed.email || "Not provided"}`,
    `  State: ${parsed.stateRaw || "Not provided"}${parsed.stateCode ? ` (${parsed.stateCode})` : ""}`,
    `  Goal: ${parsed.goal || "Not provided"}`,
    `  Monthly savings: ${parsed.monthlySavings || "Not provided"}`,
    `  Best time to call: ${parsed.bestCallTime || "Not provided"}`,
    `  Ad: ${parsed.adName || "Not provided"}`,
    `  Lead entered: ${parsed.enteredAtRaw || "Not provided"}`,
    `  Call note: ${parsed.localCallNote || "Not provided"}`,
    `  Language: ${parsed.language === "es" ? "Spanish" : "English"}`,
    "",
    `Received via Telegram: ${received}`,
    `Telegram message: ${ctx.chatId ?? "?"}/${ctx.messageId ?? "?"}`,
  ].join("\n");
}

function buildNativeFields(
  parsed: ParsedTelegramLead,
  opts: { includePhone: boolean; includeEmail: boolean }
): AgentCrmNativeFields {
  const native: AgentCrmNativeFields = {};
  if (parsed.firstName) native.firstName = parsed.firstName;
  if (parsed.lastName) native.lastName = parsed.lastName;
  if (opts.includeEmail && parsed.email) native.email = parsed.email;
  if (opts.includePhone && parsed.phoneE164) native.phone = parsed.phoneE164;
  if (parsed.stateCode) {
    native.state = parsed.stateCode;
    const tz = resolveTimezone(parsed.stateCode, null);
    if (tz) native.timezone = tz;
  }
  return native;
}

/** One read of the whole contact — tags, customFields and email all come from this. */
async function fetchContactRecord(
  contactId: string,
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${encodeURIComponent(contactId)}`, {
      headers: agentCrmAuthHeaders(token),
    });
    if (!res.ok) return null;
    return unwrapContactRecord(await res.json());
  } catch {
    return null;
  }
}

/**
 * Phone first, then email, then create. Phone leads because a live transfer can create a
 * phone-only contact before the lead notification arrives — matching on email first would make a
 * second contact for the same person.
 */
async function resolveOrCreateContact(
  parsed: ParsedTelegramLead,
  locationId: string,
  token: string,
  log: TelegramLogger
): Promise<{ contactId: string; matchedBy: "phone" | "email" | "created" } | null> {
  if (parsed.phoneE164) {
    const byPhone = await agentCrmFindContactByPhone(parsed.phoneE164, locationId, token, LOG_PREFIX);
    if (byPhone?.id) return { contactId: byPhone.id, matchedBy: "phone" };
  }
  if (parsed.email) {
    const byEmail = await agentCrmFindContactByEmail(parsed.email, locationId, token, LOG_PREFIX);
    if (byEmail?.id) return { contactId: byEmail.id, matchedBy: "email" };
  }

  const body: Record<string, unknown> = { locationId, source: CONTACT_SOURCE };
  if (parsed.phoneE164) body.phone = parsed.phoneE164;
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
    log.error("Create contact returned an unreadable body", { preview: text.slice(0, 200) });
    return null;
  }

  // Duplicate race: another write created the contact between our search and our POST.
  let errBody: AgentCrmCreateContactErrorBody = {};
  try {
    errBody = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (agentCrmIsDuplicateContactError(res.status, errBody)) {
    const metaId = errBody.meta?.contactId;
    if (typeof metaId === "string") return { contactId: metaId, matchedBy: "phone" };
    if (parsed.phoneE164) {
      const retry = await agentCrmFindContactByPhone(parsed.phoneE164, locationId, token, LOG_PREFIX);
      if (retry?.id) return { contactId: retry.id, matchedBy: "phone" };
    }
    if (parsed.email) {
      const retry = await agentCrmFindContactByEmail(parsed.email, locationId, token, LOG_PREFIX);
      if (retry?.id) return { contactId: retry.id, matchedBy: "email" };
    }
  }

  log.error("Create contact failed", { status: res.status, preview: text.slice(0, 300) });
  return null;
}

export async function pushLeadToCrm(
  parsed: ParsedTelegramLead,
  ctx: { chatId?: string | null; messageId?: string | null; receivedAt?: Date; rawText?: string },
  config: TelegramLeadsConfig,
  log: TelegramLogger
): Promise<CrmPushResult> {
  const creds = agentCrmGetBaseCredentials();
  if (!creds) {
    return { ok: false, reason: "no_credentials", tagsAdded: [], cadenceStarted: false };
  }
  const { token, locationId } = creds;

  if (!parsed.phoneE164) {
    return { ok: false, reason: "no_phone", tagsAdded: [], cadenceStarted: false };
  }

  const details = formatLeadDetails(parsed, ctx);
  const wantedTags = resolveTelegramTags(config);

  // ── Dry run: every READ is real, every WRITE is logged instead of sent. ──────────────
  if (config.dryRun) {
    const resolved = await resolveOrCreateContactDryRun(parsed, locationId, token, log);
    log.info("DRY RUN — would write lead to CRM", {
      matchedBy: resolved?.matchedBy ?? "would_create",
      contactId: resolved?.contactId ?? null,
      native: buildNativeFields(parsed, { includePhone: true, includeEmail: true }),
      tags: wantedTags,
      details,
    });
    return {
      ok: true,
      dryRun: true,
      contactId: resolved?.contactId,
      matchedBy: resolved?.matchedBy,
      tagsAdded: [],
      cadenceStarted: false,
    };
  }

  const resolved = await resolveOrCreateContact(parsed, locationId, token, log);
  if (!resolved) {
    return { ok: false, reason: "crm_resolve_failed", tagsAdded: [], cadenceStarted: false };
  }
  const { contactId, matchedBy } = resolved;

  // One read: tags + existing custom fields + existing email.
  const contact = await fetchContactRecord(contactId, token);
  const existingEmail = contact ? extractCrmEmail(contact) : "";
  const existingTags = new Set(
    agentCrmNormalizeContactTags(contact?.tags).map((t) => t.trim().toLowerCase())
  );

  const native = buildNativeFields(parsed, {
    // A phone-matched contact already has the number; don't rewrite it.
    includePhone: matchedBy !== "phone",
    // Never overwrite an email already on the record.
    includeEmail: !existingEmail,
  });

  // Custom fields. A GHL PUT replaces the whole array, so read-modify-write is mandatory.
  const updates: CrmCustomFieldRow[] = [];
  const pushField = (slug: Parameters<typeof getIulStep2FieldId>[0], value?: string) => {
    const v = (value ?? "").trim();
    if (!v) return;
    const id = getIulStep2FieldId(slug);
    if (!id) {
      log.warn(`Step-2 field "${slug}" not provisioned — run pnpm iul:step2-fields`);
      return;
    }
    updates.push({ id, field_value: v });
  };
  pushField("iul_s2_monthly_savings", parsed.monthlySavings);
  pushField("iul_s2_call_time", parsed.bestCallTime);

  const leadSourceField = await resolveLeadSourceDetailsCustomField(
    AGENT_CRM_API_BASE,
    locationId,
    token
  );
  if (leadSourceField?.id) {
    // Append rather than replace, so Step-1 attribution on an existing contact survives.
    const existingDetails = getCustomFieldStringValue(contact?.customFields, leadSourceField.id);
    updates.push({
      id: leadSourceField.id,
      key: leadSourceField.key,
      field_value: existingDetails ? `${existingDetails}\n\n${details}` : details,
    });
  }

  const customFields =
    updates.length > 0
      ? (mergeCustomFieldsWithUpdates(contact?.customFields, updates) as {
          id: string;
          field_value: string;
        }[])
      : undefined;

  const updated = await agentCrmUpdateContact(contactId, { native, customFields }, token, LOG_PREFIX);
  if (!updated) log.warn("Contact update returned false (non-fatal)", { contactId });

  // ── Tags. This is the ONLY thing that can start the follow-up cadence. ───────────────
  // Post only tags the contact demonstrably lacks, so an already-worked lead cannot be
  // re-enrolled — no assumption about whether GHL re-fires on a duplicate tag.
  const tagsToAdd = wantedTags.filter((t) => !existingTags.has(t.trim().toLowerCase()));
  const hadCadenceTag = existingTags.has(TELEGRAM_CADENCE_TAG.toLowerCase());

  if (tagsToAdd.length > 0) {
    const tagged = await agentCrmAddContactTags(contactId, tagsToAdd, token, LOG_PREFIX);
    if (!tagged) log.warn("Add tags returned false (non-fatal)", { contactId, tagsToAdd });
  } else {
    log.info("Contact already carries every tag — cadence deliberately not restarted", {
      contactId,
    });
  }

  const cadenceStarted =
    !hadCadenceTag && tagsToAdd.some((t) => t.toLowerCase() === TELEGRAM_CADENCE_TAG.toLowerCase());

  // Note. `createContactNote` throws on failure and the lead is already synced, so it is
  // best-effort by design.
  try {
    const body = ctx.rawText
      ? `${details}\n\n--- Mensaje original ---\n${ctx.rawText}`
      : details;
    await createContactNote({
      contactId,
      token,
      title: `Empiregrowth IUL Lead — ${parsed.leadTypeLabel || "Nuevo lead"}`,
      body,
    });
  } catch (err) {
    log.warn("Contact note failed (non-fatal)", { contactId, error: String(err) });
  }

  log.info("Lead synced to CRM", { contactId, matchedBy, tagsAdded: tagsToAdd, cadenceStarted });
  return { ok: true, contactId, matchedBy, tagsAdded: tagsToAdd, cadenceStarted };
}

/** Read-only contact resolution for dry runs — searches, but never creates. */
async function resolveOrCreateContactDryRun(
  parsed: ParsedTelegramLead,
  locationId: string,
  token: string,
  _log: TelegramLogger
): Promise<{ contactId: string; matchedBy: "phone" | "email" } | null> {
  if (parsed.phoneE164) {
    const byPhone = await agentCrmFindContactByPhone(parsed.phoneE164, locationId, token, LOG_PREFIX);
    if (byPhone?.id) return { contactId: byPhone.id, matchedBy: "phone" };
  }
  if (parsed.email) {
    const byEmail = await agentCrmFindContactByEmail(parsed.email, locationId, token, LOG_PREFIX);
    if (byEmail?.id) return { contactId: byEmail.id, matchedBy: "email" };
  }
  return null;
}
