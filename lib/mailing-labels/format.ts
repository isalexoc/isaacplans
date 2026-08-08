/**
 * Pure address formatting for printed labels. USPS asks for uppercase, no punctuation, and
 * `CITY ST ZIP` on the final line — that is what actually gets read cleanly by carriers and
 * sorting equipment.
 *
 * Accented characters are deliberately preserved: "RODRÍGUEZ" is the prospect's name spelled
 * correctly, USPS reads it fine, and stripping it would be worse than the marginal scanner risk.
 */

import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import type {
  MailingLabelInput,
  MailingLabelLanguage,
  MailingLabelRecord,
  SenderAddress,
} from "./types";

export const DEFAULT_TAGLINES: { en: string; es: string } = {
  en: "Personal & Confidential",
  es: "Personal y Confidencial",
};

const STATE_CODES = new Set(US_STATE_OPTIONS.map((s) => s.code));
const STATE_NAME_TO_CODE = new Map(
  US_STATE_OPTIONS.map((s) => [s.name.toUpperCase(), s.code])
);

/** Uppercase, collapse whitespace, drop the punctuation USPS doesn't want on a label line. */
export function uspsLine(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Accepts "FL", "fl", or "Florida"; returns a 2-letter code, or "" if it isn't a US state. */
export function normalizeStateCode(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (upper.length === 2) return STATE_CODES.has(upper) ? upper : "";
  return STATE_NAME_TO_CODE.get(upper) ?? "";
}

/** "33134" or "33134-1234"; "" when there aren't at least 5 digits. */
export function normalizeZip(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 5) return "";
  if (digits.length >= 9) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  return digits.slice(0, 5);
}

export type AddressBlock = {
  nameLine: string;
  line1: string;
  /** Apt/unit, already uppercased; null when there isn't one. */
  line2: string | null;
  cityStateZip: string;
};

type AddressLike = {
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
};

/** The four printable lines of a recipient (or sender) block. */
export function formatAddressBlock(input: AddressLike & { nameLine?: string }): AddressBlock {
  const nameLine = uspsLine(
    input.nameLine ?? [input.firstName, input.lastName].filter(Boolean).join(" ")
  );
  const state = normalizeStateCode(input.state) || uspsLine(input.state);
  const zip = normalizeZip(input.postalCode) || uspsLine(input.postalCode);
  const line2 = uspsLine(input.addressLine2);
  return {
    nameLine,
    line1: uspsLine(input.addressLine1),
    line2: line2 || null,
    cityStateZip: [uspsLine(input.city), state, zip].filter(Boolean).join(" "),
  };
}

/** Enough of an address to actually mail something. Auto-create hooks bail when this is false. */
export function isPrintableAddress(input: AddressLike): boolean {
  return Boolean(
    input.addressLine1?.trim() &&
      input.city?.trim() &&
      normalizeStateCode(input.state) &&
      normalizeZip(input.postalCode)
  );
}

/** Priority Mail needs a real return address, so the sender block is validated harder. */
export function isCompleteSenderAddress(sender: SenderAddress | null | undefined): boolean {
  if (!sender) return false;
  return Boolean(
    (sender.businessName.trim() || sender.contactName.trim()) && isPrintableAddress(sender)
  );
}

/** Which lines are missing, for a UI hint that beats a generic "incomplete" message. */
export function missingSenderFields(sender: SenderAddress): string[] {
  const missing: string[] = [];
  if (!sender.businessName.trim() && !sender.contactName.trim()) {
    missing.push("business or contact name");
  }
  if (!sender.addressLine1.trim()) missing.push("street address");
  if (!sender.city.trim()) missing.push("city");
  if (!normalizeStateCode(sender.state)) missing.push("state");
  if (!normalizeZip(sender.postalCode)) missing.push("ZIP code");
  return missing;
}

export function senderNameLines(sender: SenderAddress): string[] {
  return [uspsLine(sender.businessName), uspsLine(sender.contactName)].filter(Boolean);
}

/** Mixed-case name for on-screen lists (the label itself is uppercased). */
export function mailingLabelDisplayName(
  record: Pick<MailingLabelRecord, "firstName" | "lastName">
): string {
  const name = [record.firstName, record.lastName].filter(Boolean).join(" ").trim();
  return name || "(no name)";
}

export function resolveTagline(
  language: MailingLabelLanguage,
  taglines: { en: string; es: string }
): string {
  return (language === "es" ? taglines.es : taglines.en) ?? "";
}

export function normalizeLanguage(value: unknown): MailingLabelLanguage {
  return typeof value === "string" && value.toLowerCase().startsWith("es") ? "es" : "en";
}

/**
 * Clean up whatever a form or a lead parser handed us into storable columns.
 * Note this keeps the original casing — labels are uppercased at render time, so the stored
 * value stays readable in the admin list and in a CSV export later.
 */
export function normalizeMailingLabelInput(
  input: Partial<MailingLabelInput>
): MailingLabelInput | null {
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
  const candidate: MailingLabelInput = {
    firstName: clean(input.firstName),
    lastName: clean(input.lastName),
    addressLine1: clean(input.addressLine1),
    addressLine2: clean(input.addressLine2),
    city: clean(input.city),
    state: normalizeStateCode(input.state),
    postalCode: normalizeZip(input.postalCode),
    language: normalizeLanguage(input.language),
    phone: clean(input.phone),
    email: clean(input.email).toLowerCase(),
    notes: clean(input.notes),
  };
  return isPrintableAddress(candidate) ? candidate : null;
}

/** e.g. "mailing-labels-avery-5163-12-labels.pdf" */
export function mailingLabelFilename(presetId: string, count: number): string {
  const slug = presetId.replace(/_/g, "-");
  const noun = count === 1 ? "label" : "labels";
  return `mailing-labels-${slug}-${count}-${noun}.pdf`;
}
