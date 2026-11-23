/**
 * The agent's profile as typed in a form (the agent's own /agent/profile, or Isaac's
 * /admin/agents), checked field by field before it is stored. Pure, so the offline tests and both
 * API routes share it.
 *
 * Only what may be printed on a public page gets through, by the same rules the public profile
 * applies when it reads the row back (lib/tenancy/profile.ts): an https photo on a public host
 * that isn't one of Isaac's (no upload in the pilot), an E.164 WhatsApp number, English and/or
 * Spanish, US state codes, the agent's own IBO number, and an Impact referral link on Impact's own
 * hosts. Here a value that wouldn't survive is refused instead of quietly dropped, with a code per
 * field (lib/tenancy/agent-profile-errors.ts words it in the form's language).
 *
 * A patch: only the keys present in the body are checked and returned. An empty string clears an
 * optional field.
 */

import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import { isValidAgentEmail, normalizeAgentEmail } from "./agent-linking";
import { profileErrorsText, type ProfileErrorCode, type ProfileErrorLocale } from "./agent-profile-errors";
import { normalizeE164, normalizeLanguages, safeImpactReferralUrl, safePhotoUrl } from "./profile";

/** The `agents` columns a profile form may write. */
export type AgentProfileColumns = {
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  whatsappE164: string | null;
  contactEmail: string | null;
  languages: string[];
  licensed: boolean;
  licensedStates: string[];
  iboNumber: string | null;
  impactReferralUrl: string | null;
  defaultLocale: "en" | "es";
  alertEmail: string | null;
};

/** The form's field names (the JSON body), mapped to the columns above. */
export const PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "photoUrl",
  "whatsapp",
  "contactEmail",
  "languages",
  "licensed",
  "licensedStates",
  "iboNumber",
  "impactReferralUrl",
  "defaultLocale",
  "alertEmail",
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

/** Why each refused field was refused, as a code (lib/tenancy/agent-profile-errors.ts words it). */
export type ProfileErrorCodes = Partial<Record<ProfileField, ProfileErrorCode>>;

/** The same, in words: what a form shows under each field. */
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export function profileErrorMessages(codes: ProfileErrorCodes, locale: ProfileErrorLocale): ProfileErrors {
  return profileErrorsText(codes, locale);
}

export type ProfilePatchResult =
  | { ok: true; patch: Partial<AgentProfileColumns> }
  | { ok: false; errors: ProfileErrorCodes };

const STATE_CODES = new Set(US_STATE_OPTIONS.map((s) => s.code));
const IBO_RE = /^[A-Za-z0-9-]{3,40}$/;
// Control characters and angle brackets: a name is printed on public pages and in images.
const UNSAFE_NAME = /[\u0000-\u001f\u007f<>]/;

const text = (value: unknown): string | null =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value == null ? "" : null;

/** Check the profile fields present in `body`. Unknown keys are ignored. */
export function parseAgentProfilePatch(
  body: unknown,
  env: Record<string, string | undefined> = process.env
): ProfilePatchResult {
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const patch: Partial<AgentProfileColumns> = {};
  const errors: ProfileErrorCodes = {};
  const has = (key: ProfileField) => Object.prototype.hasOwnProperty.call(input, key);

  for (const key of ["firstName", "lastName"] as const) {
    if (!has(key)) continue;
    const value = text(input[key]);
    if (value === null || value.length > 60 || UNSAFE_NAME.test(value)) errors[key] = "name";
    else patch[key] = value || null;
  }

  if (has("photoUrl")) {
    const raw = text(input.photoUrl);
    if (raw === null) errors.photoUrl = "photo";
    else if (!raw) patch.photoUrl = null;
    else {
      const safe = safePhotoUrl(raw, env);
      if (safe) patch.photoUrl = safe;
      else errors.photoUrl = "photo";
    }
  }

  if (has("whatsapp")) {
    const raw = text(input.whatsapp);
    if (raw === null) errors.whatsapp = "whatsapp";
    else if (!raw) patch.whatsappE164 = null;
    else {
      // US numbers may be typed without the +1.
      const digits = raw.replace(/[\s().-]/g, "");
      const e164 = normalizeE164(/^\d{10}$/.test(digits) ? `+1${digits}` : raw);
      if (e164) patch.whatsappE164 = e164;
      else errors.whatsapp = "whatsapp";
    }
  }

  for (const [key, column] of [
    ["contactEmail", "contactEmail"],
    ["alertEmail", "alertEmail"],
  ] as const) {
    if (!has(key)) continue;
    const raw = typeof input[key] === "string" ? normalizeAgentEmail(input[key]) : input[key] == null ? "" : null;
    if (raw === null) errors[key] = "email";
    else if (!raw) patch[column] = null;
    else if (isValidAgentEmail(raw)) patch[column] = raw;
    else errors[key] = "email";
  }

  if (has("languages")) {
    if (!Array.isArray(input.languages)) errors.languages = "languages";
    else patch.languages = normalizeLanguages(input.languages.map((v) => (typeof v === "string" ? v : "")));
  }

  if (has("licensed")) {
    if (typeof input.licensed !== "boolean") errors.licensed = "licensed";
    else patch.licensed = input.licensed;
  }

  if (has("licensedStates")) {
    const values = Array.isArray(input.licensedStates) ? input.licensedStates : null;
    const codes = values?.map((v) => (typeof v === "string" ? v.trim().toUpperCase() : ""));
    if (!codes || codes.some((c) => !STATE_CODES.has(c))) errors.licensedStates = "states";
    else patch.licensedStates = Array.from(new Set(codes)).sort();
  }

  if (has("iboNumber")) {
    const raw = text(input.iboNumber);
    if (raw === null) errors.iboNumber = "ibo";
    else if (!raw) patch.iboNumber = null;
    else if (IBO_RE.test(raw)) patch.iboNumber = raw;
    else errors.iboNumber = "ibo";
  }

  if (has("impactReferralUrl")) {
    const raw = text(input.impactReferralUrl);
    if (raw === null) errors.impactReferralUrl = "impact";
    else if (!raw) patch.impactReferralUrl = null;
    else {
      const safe = safeImpactReferralUrl(raw);
      if (safe) patch.impactReferralUrl = safe;
      else errors.impactReferralUrl = "impact";
    }
  }

  if (has("defaultLocale")) {
    if (input.defaultLocale === "en" || input.defaultLocale === "es") patch.defaultLocale = input.defaultLocale;
    else errors.defaultLocale = "locale";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, patch };
}

/** The profile as the forms show it (the reverse of the mapping above). */
export type AgentProfileForm = {
  firstName: string;
  lastName: string;
  photoUrl: string;
  whatsapp: string;
  contactEmail: string;
  languages: ("en" | "es")[];
  licensed: boolean;
  licensedStates: string[];
  iboNumber: string;
  impactReferralUrl: string;
  defaultLocale: "en" | "es";
  alertEmail: string;
};

export function agentProfileForm(row: {
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  whatsappE164: string | null;
  contactEmail: string | null;
  languages: readonly string[] | null;
  licensed: boolean;
  licensedStates: readonly string[] | null;
  iboNumber: string | null;
  impactReferralUrl: string | null;
  defaultLocale: string;
  alertEmail: string | null;
}): AgentProfileForm {
  return {
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    photoUrl: row.photoUrl ?? "",
    whatsapp: row.whatsappE164 ?? "",
    contactEmail: row.contactEmail ?? "",
    languages: normalizeLanguages(row.languages),
    licensed: row.licensed,
    licensedStates: [...(row.licensedStates ?? [])],
    iboNumber: row.iboNumber ?? "",
    impactReferralUrl: row.impactReferralUrl ?? "",
    defaultLocale: row.defaultLocale === "es" ? "es" : "en",
    alertEmail: row.alertEmail ?? "",
  };
}
