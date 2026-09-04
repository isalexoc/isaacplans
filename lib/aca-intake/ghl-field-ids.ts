/**
 * GHL (Agent CRM) custom-field id map for ACA intake.
 *
 * ACA is fully independent of the IUL intake: every field below is its own CRM field, even
 * where the value looks identical (SSN, banking). Nothing is shared, so writing an ACA intake
 * can never overwrite what an IUL application captured on the same contact.
 *
 * All ids start empty ("") and are filled in by `scripts/create-aca-intake-fields.ts`, which
 * creates each field inside the "ACA Data" folder with an "ACA Intake - " name prefix and
 * rewrites this file.
 *
 * `slug` keys are referenced from `lib/aca-intake/fields.ts` via `custom(slug)`.
 * An empty id means the field has not been provisioned yet; CRM sync skips it (and logs)
 * so the app still builds/runs before the script is executed.
 *
 * NOTE: the provisioning script rewrites this file with regex string surgery — it matches the
 * folder-id declaration and each `slug: "id",` line. Keep both shapes intact, and never repeat
 * the folder-id declaration's literal text in a comment: the rewrite is line-anchored, but a
 * duplicate would still be confusing to read.
 */

export type AcaFieldSlug =
  // Identity + contact
  | "gender"
  | "ssn"
  | "marital_status"
  // GHL's contact record has no native slot for these two, so they get custom fields.
  | "middle_name"
  | "alt_phone"
  | "payment_method"
  | "payor_same_as"
  | "bank_name"
  | "routing_number"
  | "account_number"
  | "account_type"
  // Residence
  | "county"
  | "mailing_address"
  // Income
  | "expected_annual_household_income"
  // Doctors / prescriptions / preferences
  | "has_doctors"
  | "doctors_list"
  | "has_prescriptions"
  | "prescriptions_list"
  | "interested_dental"
  | "interested_vision"
  | "additional_questions"
  // Payment — card block
  | "cardholder_name"
  | "card_number"
  | "card_expiration"
  | "card_cvv"
  | "card_billing_zip"
  | "payor_name"
  | "payor_relationship"
  // Household members, serialized one per slot
  | "aca_member_1"
  | "aca_member_2"
  | "aca_member_3"
  | "aca_member_4"
  | "aca_member_5"
  | "aca_member_6"
  | "aca_member_7"
  | "aca_member_8"
  // Per-member identity documents (FILE_UPLOAD, shared buckets — the filename carries the member)
  | "aca_doc_citizenship"
  | "aca_doc_legal_front"
  | "aca_doc_legal_back"
  // General documents (FILE_UPLOAD)
  | "doc_photo_id"
  | "doc_ssn_card"
  | "doc_proof_of_income"
  | "doc_current_insurance_card"
  | "doc_other"
  // Agent-only
  | "marketplace_account_exists"
  | "marketplace_username"
  | "marketplace_application_id"
  | "plan_selected"
  | "carrier_selected"
  | "application_status"
  | "agent_notes"
  | "agent_npn"
  // Meta — the always-current client share link (written by the app, used by a GHL workflow)
  | "aca_intake_link";

/** GHL custom-field folder that groups all ACA intake fields. Set by the provisioning script. */
export const acaDataFolderId = "X2ivFiEX0E6DGlAlDYsV";

export const acaFieldIds: Record<AcaFieldSlug, string> = {
  // ---- All filled by scripts/create-aca-intake-fields.ts (pnpm aca:fields) ----
  gender: "",
  ssn: "",
  marital_status: "",
  middle_name: "",
  alt_phone: "",
  payment_method: "",
  payor_same_as: "",
  bank_name: "",
  routing_number: "",
  account_number: "",
  account_type: "",
  county: "",
  mailing_address: "",
  expected_annual_household_income: "",
  has_doctors: "",
  doctors_list: "",
  has_prescriptions: "",
  prescriptions_list: "",
  interested_dental: "",
  interested_vision: "",
  additional_questions: "",
  cardholder_name: "",
  card_number: "",
  card_expiration: "",
  card_cvv: "",
  card_billing_zip: "",
  payor_name: "",
  payor_relationship: "",
  aca_member_1: "",
  aca_member_2: "",
  aca_member_3: "",
  aca_member_4: "",
  aca_member_5: "",
  aca_member_6: "",
  aca_member_7: "",
  aca_member_8: "",
  aca_doc_citizenship: "",
  aca_doc_legal_front: "",
  aca_doc_legal_back: "",
  doc_photo_id: "",
  doc_ssn_card: "",
  doc_proof_of_income: "",
  doc_current_insurance_card: "",
  doc_other: "",
  marketplace_account_exists: "",
  marketplace_username: "",
  marketplace_application_id: "",
  plan_selected: "",
  carrier_selected: "",
  application_status: "",
  agent_notes: "",
  agent_npn: "",
  aca_intake_link: "TXoIWXjUNdvzcqeUvugE",
};
