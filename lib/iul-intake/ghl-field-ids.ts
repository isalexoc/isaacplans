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
  | "years_with_employer"
  | "employer_street"
  | "employer_city"
  | "employer_state"
  | "employer_zip"
  | "work_phone"
  | "gross_income_current"
  | "gross_income_previous"
  | "net_worth"
  | "source_of_funds"
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
  | "attachment_other";

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
  marital_status: "2y5hOZjw0yGE3b0ImxDp",
  us_citizen: "8VRyEH5zzr72Slhywh7T",
  id_type: "CGTWfAr4z1iBKySRWfBi",
  years_in_usa: "f0B1gjRB8CIhXgyGbduT",
  birth_country: "3WhAp2n01eQYAif2cZef",
  birth_city_state: "52435uanPlkjPnhHtnZe",
  country_of_citizenship: "erGIaz8N4MfOYlH3BEEh",
  visa_type: "okmvo2SzGB0xfZg0sj6s",
  height: "PdcoL08gYjMt1wRrLH26",
  weight: "99TNLBsk0WYxdGCkgUCK",
  drivers_license: "Tv80nVftBhJnmnVrYaxX",
  dl_number: "YqsZBy2QkX2fKgrD1Lwc",
  dl_state: "hqQ2mL1rKe3eo8vgSNRf",
  tobacco: "nfzITlzaQjXpn3i1USFv",
  years_at_address: "hBQtcaBCbVNXDv1ttjMR",
  employed: "6Ujx3shtbr3o30RYWqXm",
  occupation: "7I2Yr5BUhXohyHmcYz5n",
  years_with_employer: "g3zpN3D6wHmofQbp9K6i",
  employer_street: "aelL3A6uRunRFQ88g80U",
  employer_city: "hJKHXELYlr5DZW3i24xI",
  employer_state: "THIo5FxPgWioynhtl0W5",
  employer_zip: "S1XkHEYUuiXrxUuvIZjL",
  work_phone: "PisVRPrCVlSbLn7ZpBUP",
  gross_income_current: "nt6WsGlNk2quRuG5sOTy",
  gross_income_previous: "kHtbZjUfHrl2hsdITKiJ",
  net_worth: "dn84UoiVtN2ULT7YtoTn",
  source_of_funds: "yC3QkNiECaU0fF4D9DjL",
  beneficiary_1: "qnEICxN00qC0pzCGAtgc",
  beneficiary_2: "2GE3Y0MxR5UMioeylOOA",
  beneficiary_3: "iZ4T8gZtzjP5QtKg2As4",
  beneficiary_4: "hRTk4xfOaFV1tB1vDOvI",
  payor_same_as: "ANYf4Jy74bB9TbLQZGjB",
  bank_name: "yVWylW5ZsOD54cgsqZoO",
  payment_method: "d8RHsd898sayqGlGjnQQ",
  routing_number: "clOM9awUGBWf0aNdJEug",
  account_number: "of4RnhMe9LcSy4a3Tkb3",
  account_type: "vo7aa2Cq1Aq9EfNRsOT5",
  initial_planned_premium: "1WhO9jFQ5hXX9IzzoiO8",
  med_heart_stroke_cancer: "iDfKJNty3Q7QtjdAi82V",
  med_diabetes_blood: "Kx6l0RajMVF9ovM0EnKJ",
  med_meds_diet: "DoX9yaWWsgivQBN4lgPa",
  meds_list: "AbLNN3DoKXIQkizSwxNP",
  doctor_name: "CrlPWKHmPdeBO0pJh9ek",
  doctor_address: "5GwwE9eIXtOscVctfbsU",
  doctor_phone: "wtL0CCYiO7atg0n1n8bZ",
  father_age: "RyeVS3lnGuAKiZB8GkGf",
  mother_age: "aTc3ttlHQbGHtU8sqOA5",
  father_status: "G9v98KqOEDTpVROFsmuC",
  father_age_at_death: "PiJHO9fiQ4CTDazWiNxq",
  mother_status: "LjzpU2YqdvvD4C8eClWY",
  mother_age_at_death: "gxgbBpYkOYBoXOXfWmog",
  attachment_drivers_license: "sjuLTruR7BThNtfBroqZ",
  attachment_bank_doc: "yL1gTKK1bjlYgt8m0m7d",
  attachment_other: "bCCuqnsUGsTZ0FzqZarD",
};
