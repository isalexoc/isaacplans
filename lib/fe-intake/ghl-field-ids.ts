/**
 * GHL (Agent CRM) custom-field id map for Final Expense intake.
 *
 * Final Expense is fully independent of the IUL/ACA intakes: every field below is its own CRM
 * field, even where the value looks identical (SSN). Nothing is shared, so writing an FE intake
 * can never overwrite what another line captured on the same contact.
 *
 * All ids start empty ("") and are filled in by `scripts/create-fe-intake-fields.ts`, which
 * creates each field inside the "FE Intake Data" folder with an "FE Intake - " name prefix and
 * rewrites this file.
 *
 * `slug` keys are referenced from `lib/fe-intake/fields.ts` via `custom(slug)`.
 * An empty id means the field has not been provisioned yet; CRM sync skips it (and logs)
 * so the app still builds/runs before the script is executed.
 *
 * NOTE: the provisioning script rewrites this file with regex string surgery — it matches the
 * folder-id declaration and each `slug: "id",` line. Keep both shapes intact, and never repeat
 * the folder-id declaration's literal text in a comment: the rewrite is line-anchored, but a
 * duplicate would still be confusing to read.
 */

export type FeFieldSlug =
  | "gender"
  | "relationship_to_insured"
  | "has_ssn"
  | "ssn"
  | "mothers_maiden_name"
  | "beneficiaries_list"
  | "physician_name"
  | "physician_city"
  | "height"
  | "weight"
  | "takes_medications"
  | "medications_list"
  // Tobacco and Nicotine
  | "tobacco_use"
  | "tobacco_10yr"
  | "tobacco_5yr"
  | "tobacco_12mo"
  // Health
  | "cancer_stroke"
  | "cancer_stroke_free_2yr"
  | "cancer_stroke_free_5yr"
  | "cancer_stroke_free_10yr"
  // Hospitalizations
  | "hospitalized_current"
  | "hospitalized_10yr"
  | "hospitalized_5yr"
  | "hospitalized_3yr"
  | "hospitalized_6mo"
  // Payment / bank draft — optional, collected on the completion screen after submitting
  | "bank_name"
  | "routing_number"
  | "account_number"
  | "account_type"
  | "first_payment_day"
  // Meta — the always-current client share link (written by the app, used by a GHL workflow)
  | "fe_intake_link";

/** GHL custom-field folder that groups all FE intake fields. Set by the provisioning script. */
export const feDataFolderId = "kzIJP3OFBQrOHcg0aStT";

export const feFieldIds: Record<FeFieldSlug, string> = {
  // ---- All filled by scripts/create-fe-intake-fields.ts (pnpm fe-intake:fields) ----
  gender: "jHHqEJAP8LBj9rauJPHB",
  relationship_to_insured: "KsJ3kIjvKDkWjn1OEK9e",
  has_ssn: "fKXfh1v2IEiCocb6dAEm",
  ssn: "USoBLT8PDc81jNYGGn61",
  mothers_maiden_name: "6NZ8UianawuQ4XuIcaRs",
  beneficiaries_list: "PvEHmVaJEN851GDOTRGS",
  physician_name: "Z4CdeiMRw1llA22JHnbU",
  physician_city: "eBKzMBpeMAbkxY0YGLcJ",
  height: "1oHgbhtu7tb3w6JioGlV",
  weight: "NEKSQZVbqtcSh006JVDo",
  takes_medications: "xhbE1A6bZTXN7NMGQj07",
  medications_list: "iWD4oBOZlPG28adHtV7P",
  tobacco_use: "BubgMRo60K2uzsEfLgX4",
  tobacco_10yr: "xrwC1g6aIsEd2BV2N2ix",
  tobacco_5yr: "IkbDGqUF2tUM3oTtzl7W",
  tobacco_12mo: "SruFOustpP17Q8wuJvWU",
  cancer_stroke: "S8OJE4kKtdsP9TYOZCi1",
  cancer_stroke_free_2yr: "F7g99wIAy7HPi1eE3H5e",
  cancer_stroke_free_5yr: "jh47P7lkAG2WupHEALPI",
  cancer_stroke_free_10yr: "D6AW28f1e83SOwR73FNR",
  hospitalized_current: "iWVYZJD8J6vGC2gUespD",
  hospitalized_10yr: "5giykFzekbOYXpn5q4yj",
  hospitalized_5yr: "odA5atsT1eWeSmer1kqi",
  hospitalized_3yr: "OCPGlXIjBKj7PMAOr6NP",
  hospitalized_6mo: "ivLiRDZYTbiUrX8ACfog",
  bank_name: "rUsY1ycx4o2tl3eZJ9Qx",
  routing_number: "AHjhvWnKf2e20hq8c0l0",
  account_number: "FfVatznNpJdj9s9eLyAY",
  account_type: "gBCcnmPSNwcNS16y6KQG",
  first_payment_day: "9DFXFsBnaIrpUyr53zTl",
  fe_intake_link: "AL76ejBuUxCSIGQN8k9V",
};
