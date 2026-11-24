import { isValidPhoneNumber } from "libphonenumber-js/core";
import metadata from "libphonenumber-js/metadata.max.json";

/**
 * Whether a lead's phone number can exist, per the numbering plan ("max" metadata: real area codes
 * and exchanges). The bot's random numbers fail about 43% of the time (unassigned area codes such
 * as 200/666/852); real website leads failed 0.6%, mostly test entries and typos.
 *
 * Never a reason to drop a lead: server-action forms ask the visitor to double-check (a second
 * send with the same number goes through, held), and every other caller holds. Keep the
 * libphonenumber-js dependency current: a brand-new area code missing from old metadata would be
 * held until Isaac releases it.
 *
 * The core API with the metadata passed explicitly: the "max" entry point loads its metadata with
 * a bare `require("../metadata.max.json")`, which some loaders resolve to the wrong file — and a
 * throwing check must never look like an invalid phone, or every lead would be held.
 *
 * Returns null when there is no phone to judge, or when the check itself failed.
 */
export function isValidLeadPhone(phone: string | null | undefined): boolean | null {
  const value = phone?.trim();
  if (!value) return null;
  if (!/\d{3}/.test(value)) return false;
  try {
    return isValidPhoneNumber(value, "US", metadata);
  } catch (err) {
    console.error("[lead-guard] phone check failed (treated as unknown):", err instanceof Error ? err.message : String(err));
    return null;
  }
}
