/**
 * The intake field DSL, generalized.
 *
 * ACA, IUL and Final Expense each carry their own private copy of this vocabulary plus a ~35-file
 * vertical around it. Those three stay exactly as they are — they run real money and there is no
 * reason to touch them — but every line of business added from here on is described by data in
 * `lib/intake-configs/<lob>.ts` and driven by this engine.
 *
 * Ported from `lib/aca-intake/fields.ts` (the richest of the three: repeaters, per-row `showIf`,
 * per-row file uploads). The only structural change is that nothing is baked in — the sections,
 * the CRM slugs, the device cookie and the tags all arrive from an `IntakeLobConfig`.
 *
 * Client-safe: no `server-only`, no DB. The form component imports this from the browser bundle.
 */

import type { LobSlug } from "@/lib/lob/registry";

/** GHL contact fields that exist natively, so they don't need a custom field. */
export type NativeContactField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "dateOfBirth"
  | "address1"
  | "city"
  | "state"
  | "postalCode";

/**
 * Where a field's value is written in the CRM. Custom slugs are plain strings here rather than a
 * per-LOB union — the id lookup happens at runtime against the generated map, and an unprovisioned
 * slug is reported through `skippedSlugs` instead of failing the sync.
 */
export type CrmTarget =
  | { kind: "native"; field: NativeContactField }
  | { kind: "custom"; slug: string };

export type IntakeFieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "dob"
  | "zip"
  | "select"
  | "ssn"
  | "number"
  | "money"
  | "address"
  | "textarea"
  | "repeater"
  | "file";

/** A file stored in the CRM media library and referenced on a FILE_UPLOAD custom field. */
export type FileRef = {
  url: string;
  name: string;
  fileId?: string;
};

export type IntakeOption = {
  value: string;
  labelEn: string;
  labelEs: string;
  /** Hidden from clients; only the admin (owner) filling the form sees this option. */
  ownerOnly?: boolean;
};

/** Where an `address` field writes the resolved city/state/zip/county from autocomplete. */
export type AddressTargets = {
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
};

/** One row of a repeater. File sub-fields hold FileRef[]; everything else is a string. */
export type RepeaterRow = Record<string, string | FileRef[] | undefined>;

export type IntakeField = {
  key: string;
  labelEn: string;
  labelEs: string;
  type: IntakeFieldType;
  required?: boolean;
  sensitive?: boolean;
  /** Hidden from clients; only the admin (owner) sees/fills this field. */
  ownerOnly?: boolean;
  /** Restrict input to digits only (kept as a string to preserve leading zeros). */
  digitsOnly?: boolean;
  /** Maximum number of characters accepted. */
  maxLength?: number;
  /** For `address` fields: sibling field keys to populate from autocomplete. */
  addressTargets?: AddressTargets;
  /** For `address` fields: store the whole formatted address in this one field. */
  fullAddress?: boolean;
  /** Where this value is written in the CRM. Omit for DB-only fields. */
  crm?: CrmTarget;
  /**
   * Name to give this field in the CRM, when `labelEn` would make a poor one — client-facing
   * labels are questions ("Who is paying?"). Falls back to `labelEn`.
   */
  crmLabel?: string;
  options?: IntakeOption[];
  placeholderEn?: string;
  placeholderEs?: string;
  /**
   * Show this field only when another field equals one of these values. Inside a `repeater`
   * the referenced field is resolved against the ROW, not the top-level form data.
   */
  showIf?: { field: string; equals: string | string[] };
  /** Hint rendered under the input. */
  helpEn?: string;
  helpEs?: string;
  // ── `repeater` only ──
  /** Sub-fields rendered for each row. */
  rowFields?: IntakeField[];
  /** Rows always present and never removable (default 1). */
  minRows?: number;
  /** Hard cap on rows. */
  maxRows?: number;
  /** Singular noun for the row header — "Dependent 2". */
  rowLabelEn?: string;
  rowLabelEs?: string;
  /**
   * One CRM custom-field slug per row, e.g. `["stm_dependent_1", … "stm_dependent_6"]`. A GHL
   * contact has no concept of a nested list, so each row flattens into its own text field.
   * Mutually exclusive with `crm` on a repeater (which collapses every row into one field).
   */
  crmSlots?: string[];
  /**
   * Override how one row is flattened for the CRM. Defaults to `label: value` pairs joined by
   * " | ", which is unambiguous but verbose — set this when a terser line reads better.
   */
  rowFormat?: (row: RepeaterRow, index: number) => string;
};

export type IntakeSection = {
  key: string;
  titleEn: string;
  titleEs: string;
  descriptionEn?: string;
  descriptionEs?: string;
  /** Hidden from clients; only the admin (owner) sees this whole section. */
  ownerOnly?: boolean;
  fields: IntakeField[];
};

/** Everything the engine needs to run one line of business's intake. */
export type IntakeLobConfig = {
  lob: LobSlug;
  /** English display name — dashboard headings, CRM folder, note titles. */
  label: string;
  /**
   * Heading at the top of the client form. Per line rather than one shared string, because
   * "Health Insurance Application" over a life or dental application reads as the wrong form and
   * costs completions.
   */
  formTitle: Record<"en" | "es", string>;
  /**
   * Prefix for this line's CRM custom-field slugs, e.g. `"stm"` → `stm_intake_link`. Keeps two
   * lines of business from ever writing to the same custom field on a shared contact.
   */
  slugPrefix: string;
  /** httpOnly cookie that binds a session to the browser that claimed it. Unique per line. */
  cookieName: string;
  /**
   * Env var holding the Clerk id of the agent who owns self-started sessions. Falls back to
   * `INTAKE_DEFAULT_OWNER_USER_ID` so a new line of business works without a new secret.
   */
  ownerEnvVar: string;
  /** Localized `/<lob>/intake` path segments, mirroring i18n/routing.ts, for the share link. */
  intakeSlug: Record<"en" | "es", string>;
  sections: IntakeSection[];
};

/** Client-safe DTOs. */
export type IntakeStatus = "draft" | "in_progress" | "completed";

export type IntakeData = Record<string, unknown>;

/** Summary row for the agent dashboard list. */
export type IntakeSummary = {
  id: string;
  lob: LobSlug;
  token: string;
  status: IntakeStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  crmContactId: string | null;
  /** Admin granted the client edit access after submission (re-locks on re-submit). */
  reopenedForClient: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
};

/** Full session payload returned to an authorized caller (sensitive fields decrypted or masked). */
export type IntakeSession = IntakeSummary & {
  data: IntakeData;
  locale: string;
  /** "owner" (agent) or "client" — controls sensitive reveal and owner-only sections. */
  role: "owner" | "client";
};
