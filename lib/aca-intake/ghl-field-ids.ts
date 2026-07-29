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
  gender: "hO6z0O3G5aDTsYSh4Wjs",
  ssn: "nnIGA1Nxp0UFY3hZQvol",
  marital_status: "oNzNbQSGCYGAmxpqJIBO",
  middle_name: "134oVqiqwcaNy0kRkuGl",
  alt_phone: "kdWfuvx1BpwnXBx6u038",
  payment_method: "OTt72Bfh4JKxkUnZXW99",
  payor_same_as: "rzFTMSBkuCkTuYrlWXs8",
  bank_name: "et7FKl16X6ZTJkMYF7AO",
  routing_number: "bEZ6RN2pDZRYK6YPzND2",
  account_number: "kDA4CXufIrJiKT3bVukO",
  account_type: "MeQwaq2tWFcG1uw9IXTB",
  county: "4MEYNuOjgdstrs70llDJ",
  mailing_address: "m6lRccxwpB11MZThhZls",
  expected_annual_household_income: "WEl0fDrDy5iYy0YQGq00",
  has_doctors: "MyVFETs6HEWQ4OIWVGy8",
  doctors_list: "8iwHVduQsKhU2yOGJK5a",
  has_prescriptions: "dT48zunzKso0NKh49qrV",
  prescriptions_list: "fV9TP5MLjksOVeh7hdef",
  interested_dental: "TJI3ycoOp5ogJQcEOXpQ",
  interested_vision: "njYGzsKDLQKuDkSjzIUi",
  additional_questions: "IYImP600Z5VT20VbVZVn",
  cardholder_name: "t9jiEcOfXK1SvITwccF4",
  card_number: "EMoo8x2rdnlK4G9SK0Mf",
  card_expiration: "yYnF1A5FAoNeuzZmzFEM",
  card_cvv: "XTiIIQjQoerAV9KovL1R",
  card_billing_zip: "CpQDrr8KKpXas05VtJ3v",
  payor_name: "jEFimHvLwbAI7pqcx2Es",
  payor_relationship: "HRprl33vljGs40WCoO3a",
  aca_member_1: "1dJaFTgguatxjD4xctns",
  aca_member_2: "NwAnN9v5XMrJHORpMGh1",
  aca_member_3: "JRxxeI91vxLj4nNAFkKC",
  aca_member_4: "2FxqKW37Yed0geABUstb",
  aca_member_5: "L7Ooayfbriw0y9Wkwcqk",
  aca_member_6: "SQ3MWBrDQa7Kn6ov8o9x",
  aca_member_7: "e6ea57Vro5afSCHdINNU",
  aca_member_8: "AhIesf33VLCh7FJt0pZQ",
  aca_doc_citizenship: "JykFnbKHeMFeDg6g9Wj0",
  aca_doc_legal_front: "kyZ67ik2FEGohUt9e5yh",
  aca_doc_legal_back: "0Gc6nX6oDGHtrRojqZcf",
  doc_photo_id: "ZaEBFJ2Ip7gsyotdcK33",
  doc_ssn_card: "VlDToYatZm0uVL3iXGrj",
  doc_proof_of_income: "gR5l1US0Fv8ajyBJtQF9",
  doc_current_insurance_card: "7nd1na8tVs7J1mz7qXJP",
  doc_other: "81P7SbnzhYuXMcOyOeCs",
  marketplace_account_exists: "21mbqjRtMn6PcMwKe3ct",
  marketplace_username: "IqByaUpmBZH228kUy7zX",
  marketplace_application_id: "CAWGu8OiVFM9XlyFDQG8",
  plan_selected: "vhzrsjYSAc0XTRsGSDKm",
  carrier_selected: "5k9JK6q6DmApsEh3ozdt",
  application_status: "YHahUTvWwhRI0q47NqIz",
  agent_notes: "xgXrayAbz9cSPF7cnZ3j",
  agent_npn: "Pl9yTADCNSyo1XT2Yj39",
  aca_intake_link: "TXoIWXjUNdvzcqeUvugE",
};
