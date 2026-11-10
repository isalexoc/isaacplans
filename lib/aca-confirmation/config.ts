/**
 * Settings for the ACA application review confirmation. Server-only: reads env.
 *
 * The agent printed on every form is Isaac (one config spot, his call). His NPN comes only from
 * `ACA_AGENT_NPN`: this repo is public and the NPN is deliberately kept out of it, same rule as the
 * IUL script files. Name, phone and email already appear across the public site, so they have
 * defaults here and env can override them.
 */

import "server-only";
import type { AcaConfirmationAgent } from "./types";

export const ACA_AGENT_NPN_ENV = "ACA_AGENT_NPN";
export const ACA_CONFIRMATION_FILE_FIELD_ENV = "ACA_CONFIRMATION_FILE_FIELD_ID";

/** Added (removed first, then re-added) when a confirmation is signed, so "tag added" automations fire. */
export const ACA_CONFIRMATION_SIGNED_TAG = "aca_confirmation_signed";

/** How long a signing link stays usable. A resend restarts the clock. */
export const ACA_CONFIRMATION_LINK_TTL_DAYS = 7;

/** nanoid length for the emailed link. Same as the IUL capture links: it travels by email/phone. */
export const ACA_CONFIRMATION_TOKEN_LENGTH = 32;

/** Title of the plain-text note posted on the contact after signing. */
export const ACA_CONFIRMATION_NOTE_TITLE = "ACA application review confirmation (CMS)";

export const ACA_AGENCY_NAME = "Isaac Plans Insurance";

/**
 * Email domains a confirmation may never be sent to. The link is the signer's only credential, so
 * it must reach the consumer's own inbox, never one the agency controls.
 */
const BLOCKED_EMAIL_DOMAINS = ["isaacplans.com"];

/** The agent for new requests, or null while `ACA_AGENT_NPN` is missing (nothing can be sent). */
export function getAcaConfirmationAgent(): AcaConfirmationAgent | null {
  const npn = process.env[ACA_AGENT_NPN_ENV]?.replace(/\s+/g, "") ?? "";
  if (!/^\d{1,10}$/.test(npn)) return null;
  return {
    name: process.env.ACA_AGENT_NAME?.trim() || "Isaac Orraiz",
    npn,
    phone: process.env.ACA_AGENT_PHONE?.trim() || "(540) 426-1804",
    email: process.env.ACA_AGENT_EMAIL?.trim() || "info@isaacplans.com",
    agency: ACA_AGENCY_NAME,
  };
}

/** The File Upload custom field the signed PDF is uploaded to (contact Documents), or null. */
export function acaConfirmationFileFieldId(): string | null {
  const id = process.env[ACA_CONFIRMATION_FILE_FIELD_ENV]?.trim();
  return id && /^[A-Za-z0-9_-]{6,64}$/.test(id) ? id : null;
}

/** Optional sender for the request email. When empty, the CRM uses its default sender. */
export function acaConfirmationEmailFrom(): string | null {
  return process.env.ACA_CONFIRMATION_EMAIL_FROM?.trim() || null;
}

export function isAgencyEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return BLOCKED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}
