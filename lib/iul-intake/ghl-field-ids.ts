/**
 * GHL (Agent CRM) custom-field id map for IUL intake.
 *
 * - REUSED ids are confirmed against the live CRM and hardcoded here.
 * - NEW ids start empty ("") and are filled in by `scripts/create-iul-intake-fields.ts`,
 *   which creates each missing field inside the "IUL Data" folder and rewrites this file.
 *
 * `slug` keys are referenced from `lib/iul-intake/fields.ts` via `customField(slug)`.
 * An empty id means the field has not been provisioned yet; CRM sync skips it (and logs)
 * so the app still builds/runs before the script is executed.
 */

export type GhlFieldSlug =
  // Reused existing fields
  | "gender"
  | "ssn"
  | "premium_payment_mode"
  | "additional_comments"
  | "agent"
  // New fields (created by the provisioning script)
  | "marital_status"
  | "us_citizen"
  | "id_type"
  | "years_in_usa"
  | "birth_country"
  | "birth_city_state"
  | "country_of_citizenship"
  | "visa_type"
  | "height"
  | "weight"
  | "drivers_license"
  | "dl_number"
  | "dl_state"
  | "tobacco"
  | "years_at_address"
  | "employed"
  | "occupation"
  | "business_type"
  | "years_self_employed"
  | "years_with_employer"
  | "employer_street"
  | "employer_city"
  | "employer_state"
  | "employer_zip"
  | "work_phone"
  | "employment_notes"
  | "gross_income_current"
  | "gross_income_previous"
  | "net_worth"
  | "source_of_funds"
  | "source_of_funds_other"
  | "beneficiary_1"
  | "beneficiary_2"
  | "beneficiary_3"
  | "beneficiary_4"
  | "payor_same_as"
  | "bank_name"
  | "payment_method"
  | "routing_number"
  | "account_number"
  | "account_type"
  | "initial_planned_premium"
  | "med_heart_stroke_cancer"
  | "med_diabetes_blood"
  | "med_meds_diet"
  | "meds_list"
  | "doctor_name"
  | "doctor_address"
  | "doctor_phone"
  | "father_age"
  | "mother_age"
  | "father_status"
  | "father_age_at_death"
  | "mother_status"
  | "mother_age_at_death"
  // File uploads (FILE_UPLOAD)
  | "attachment_drivers_license"
  | "attachment_bank_doc"
  | "attachment_other"
  // Meta — the always-current client share link (written by the app, used by a GHL workflow)
  | "iul_intake_link"
  | "iul_secure_capture_link"
  | "iul_document_capture_link"
  // Not IUL-specific: a CrankWheel meeting can be started for any contact, from the standalone
  // launcher as well as from an intake. It lives here because this file is, in practice, the
  // project's single registry of GHL custom-field ids.
  | "meeting_link";

/** GHL custom-field folder that groups all IUL intake fields. Set by the provisioning script. */
export const iulDataFolderId = "JyCoYyStV4DiWx1U0pnv";

export const ghlFieldIds: Record<GhlFieldSlug, string> = {
  // ---- Reused existing custom fields (confirmed live) ----
  gender: "xCEiQhB6Ifo2G2XOY94f",
  ssn: "2vhHSpoBABcaVYzsoqAh",
  premium_payment_mode: "s1k2qS3K4SBUcvurfpA7",
  additional_comments: "Xk0YNhFUX0ppboTTGQOa",
  agent: "XNzcY9woAeGpYusgxihX",
  // ---- New fields (filled by scripts/create-iul-intake-fields.ts) ----
  marital_status: "",
  us_citizen: "",
  id_type: "",
  years_in_usa: "",
  birth_country: "",
  birth_city_state: "",
  country_of_citizenship: "",
  visa_type: "",
  height: "",
  weight: "",
  drivers_license: "",
  dl_number: "",
  dl_state: "hqQ2mL1rKe3eo8vgSNRf",
  tobacco: "",
  years_at_address: "",
  employed: "",
  occupation: "",
  business_type: "",
  years_self_employed: "",
  years_with_employer: "",
  employer_street: "",
  employer_city: "",
  employer_state: "",
  employer_zip: "",
  work_phone: "",
  employment_notes: "",
  gross_income_current: "",
  gross_income_previous: "",
  net_worth: "",
  source_of_funds: "",
  source_of_funds_other: "",
  beneficiary_1: "",
  beneficiary_2: "",
  beneficiary_3: "",
  beneficiary_4: "",
  payor_same_as: "",
  bank_name: "",
  payment_method: "",
  routing_number: "",
  account_number: "",
  account_type: "",
  initial_planned_premium: "",
  med_heart_stroke_cancer: "",
  med_diabetes_blood: "",
  med_meds_diet: "",
  meds_list: "",
  doctor_name: "",
  doctor_address: "",
  doctor_phone: "",
  father_age: "",
  mother_age: "",
  father_status: "",
  father_age_at_death: "",
  mother_status: "",
  mother_age_at_death: "",
  attachment_drivers_license: "",
  attachment_bank_doc: "",
  attachment_other: "",
  iul_intake_link: "HcQaJMoFZFK5ehZmZ0Fz",
  // Provisioned by `pnpm iul:fields` — empty until that runs, which the send route checks for.
  iul_secure_capture_link: "gxdgRe5RV1nCFyb6YxUe",
  /**
   * Filled in by `pnpm iul:fields`. Empty until that runs, and every caller checks it — an empty
   * id makes "send by text" report a clear error instead of writing the link nowhere.
   */
  iul_document_capture_link: "mXK3mDWhRAKvPGTW2dtC",
  /** Provisioned by `pnpm iul:fields`. Empty until then; the send route reports that clearly. */
  meeting_link: "u3VarzOq7hU7RyBTXRDD",
};
