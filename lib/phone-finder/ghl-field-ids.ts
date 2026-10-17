/**
 * GHL (Agent CRM) custom fields used by Phone Finder.
 *
 *  - trigger: "Find More Phones" (CHECKBOX, one option). Created by `pnpm phone-finder:fields`.
 *    The server never writes it: the GHL workflow's "Clear field data" step unticks it.
 *  - results: "Additional Possible Phones" (LARGE_TEXT, key contact.additional_possible_phones_multiline).
 *    Isaac created it by hand. There is a SINGLE-LINE field with the same display name
 *    (contact.additional_possible_phones) that he is deleting, so the script resolves by fieldKey,
 *    never by name.
 *
 * `pnpm phone-finder:fields` verifies both and rewrites the ids below. Env overrides win.
 */

export type PhoneFinderFieldSlug = "trigger" | "results";

export const PHONE_FINDER_RESULTS_FIELD_KEY = "contact.additional_possible_phones_multiline";
export const PHONE_FINDER_TRIGGER_FIELD_NAME = "Find More Phones";
/** The single option of the trigger checkbox; the workflow filter matches on it. */
export const PHONE_FINDER_TRIGGER_OPTION = "Search";

/** Folder that holds both fields. Set by the provisioning script. */
export const phoneFinderFolderId = "DsGH63eYWm2TB4aIaNS6";

export const phoneFinderFieldIds: Record<PhoneFinderFieldSlug, string> = {
  trigger: "Iarh5XQk5wCCRjfYKn9r",
  results: "AgQ9ETAfJCGtq6770XXE",
};

const ENV_OVERRIDES: Record<PhoneFinderFieldSlug, string | undefined> = {
  trigger: process.env.AGENT_CRM_CUSTOM_FIELD_PHONE_FINDER_TRIGGER_ID,
  results: process.env.AGENT_CRM_CUSTOM_FIELD_ADDITIONAL_POSSIBLE_PHONES_ID,
};

/** Env override first, then the provisioned id. "" means not provisioned. */
export function getPhoneFinderFieldId(slug: PhoneFinderFieldSlug): string {
  const fromEnv = ENV_OVERRIDES[slug]?.trim();
  if (fromEnv) return fromEnv;
  return phoneFinderFieldIds[slug] || "";
}
