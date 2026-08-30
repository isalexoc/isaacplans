/**
 * Handing a meeting link to the CRM so a GHL workflow can text or email it.
 *
 * The same two-step shape the intake, secure-capture and document links all use, because there is
 * still no direct SMS API in this codebase: write the URL to a custom field, then toggle a tag
 * whose "tag added" trigger fires the workflow. Removing before adding is what makes a second send
 * re-fire it rather than silently doing nothing.
 *
 * Server-only (CRM credentials).
 */

import "server-only";
import {
  agentCrmAddContactTags,
  agentCrmGetBaseCredentials,
  agentCrmRemoveContactTags,
  agentCrmUpdateContact,
} from "@/lib/agent-crm-contacts";
import { ghlFieldIds } from "@/lib/iul-intake/ghl-field-ids";
import type { MeetingRow } from "./meetings";

const LOG = "[CRANKWHEEL]";

/**
 * Two tags, not one, so the two messages can differ.
 *
 * "Isaac is ready for you now — tap to join" and "here is the link for your appointment on
 * Thursday" are not the same text, and a single tag would force one workflow to guess which it
 * meant.
 */
export const MEETING_NOW_SENT_TAG = "meeting_now_sent";
export const MEETING_SCHEDULED_SENT_TAG = "meeting_scheduled_sent";

export function meetingSentTag(kind: string): string {
  return kind === "scheduled" ? MEETING_SCHEDULED_SENT_TAG : MEETING_NOW_SENT_TAG;
}

/** Write the link to the contact's `meeting_link` field. False when it could not be written. */
export async function syncMeetingLinkToCrm(row: MeetingRow): Promise<boolean> {
  if (!row.crmContactId) return false;
  const fieldId = ghlFieldIds.meeting_link;
  if (!fieldId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  try {
    return await agentCrmUpdateContact(
      row.crmContactId,
      { customFields: [{ id: fieldId, field_value: row.url }] },
      creds.token,
      LOG
    );
  } catch (e) {
    console.warn(`${LOG} Meeting link sync failed:`, e);
    return false;
  }
}

/** Toggle the trigger tag so the workflow fires, even on a repeat send. */
export async function fireMeetingWorkflow(row: MeetingRow): Promise<boolean> {
  if (!row.crmContactId) return false;
  const creds = agentCrmGetBaseCredentials();
  if (!creds) return false;
  const tag = meetingSentTag(row.kind);
  await agentCrmRemoveContactTags(row.crmContactId, [tag], creds.token, LOG);
  return agentCrmAddContactTags(row.crmContactId, [tag], creds.token, LOG);
}
