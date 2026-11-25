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

import type { IntakeRoute, LobSlug } from "@/lib/lob/registry";

/**
 * Every line the engine serves. The insurance lines are `LobSlug`s (they have marketing pages, apply
 * pages and Page Media); Legal Shield is not insurance and deliberately stays out of that registry
 * (see app/[locale]/legal-shield/apply/page.tsx), so the engine's own slug type is wider.
 */
export type EngineLobSlug = LobSlug | "legal-shield";

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
  | "file"
  /** Feet + inches selects, stored as `5'7"`. */
  | "height"
  /** A select of upcoming 1st-of-the-month dates, stored as ISO `YYYY-MM-01`. */
  | "monthStart"
  /** Month / day / year selects like `dob`, but with its own year range and rule. ISO value. */
  | "dateParts"
  /**
   * Impact Health Sharing plan cards (Esencial / Plus / Premium / Total) priced live for the
   * household on the form. Stores the tier key; the monthly price goes to `pairedKey`.
   */
  | "impactPlan";

/** One `showIf` condition: another field (or, in a repeater, a sibling in the row) equals a value. */
export type ShowIfCondition = { field: string; equals: string | string[] };

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
  /** A second, smaller line under the label when the select renders as cards. */
  descriptionEn?: string;
  descriptionEs?: string;
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
  /**
   * `select` only: draw every option as a tappable card, whatever the count. Without it only
   * two-option selects are cards (Yes/No, Sex); longer lists are a dropdown.
   */
  display?: "cards";
  placeholderEn?: string;
  placeholderEs?: string;
  /**
   * Show this field only when another field equals one of these values. Inside a `repeater`
   * the referenced field is resolved against the ROW, not the top-level form data. A list means
   * every condition must hold (e.g. "is a spouse" AND "the ID has an issuing state").
   */
  showIf?: ShowIfCondition | ShowIfCondition[];
  /** Hint rendered under the input. */
  helpEn?: string;
  helpEs?: string;
  /**
   * Note recomputed from the whole form on every change and rendered under the field (top-level
   * fields only). For answers that only make sense next to another one, e.g. a payment day that
   * decides when a chosen start date can actually happen.
   */
  liveNote?: (data: IntakeData, locale: "en" | "es") => IntakeNote | null;
  /**
   * Extra check that needs the rest of the form. Runs wherever format errors do (client step gate
   * and server completion), so a false here blocks completion just like a malformed email.
   */
  isValid?: (value: string, data: IntakeData) => boolean;
  // ── `monthStart` only ──
  /** How many upcoming 1sts to offer (default 6). */
  monthCount?: number;
  /**
   * After this day of the month, next month's 1st is no longer offered. Impact needs the first
   * payment by the 28th of the month before coverage starts, so on the 29th it is too late.
   */
  monthCutoffDay?: number;
  // ── `dateParts` only ──
  /** Years offered before the current one (default 100). */
  yearsBack?: number;
  /** Years offered after the current one (default 0). */
  yearsAhead?: number;
  /** `past`: not after today (an issue date). `notExpired`: today or later (an expiration date). */
  dateRule?: "past" | "notExpired";
  /**
   * `impactPlan` only: the sibling field holding the chosen plan's monthly price. The plan cards
   * fill it, so it is not drawn as an input of its own (the summary still shows it).
   */
  pairedKey?: string;
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

/** A short message shown inside the form: a live field note or a step callout. */
export type IntakeNote = {
  tone: "info" | "success" | "warning";
  title?: string;
  text: string;
};

export type IntakeSection = {
  key: string;
  titleEn: string;
  titleEs: string;
  descriptionEn?: string;
  descriptionEs?: string;
  /** Hidden from clients; only the admin (owner) sees this whole section. */
  ownerOnly?: boolean;
  /** Box shown at the top of the step, under the description. */
  callout?: {
    tone: IntakeNote["tone"];
    titleEn: string;
    titleEs: string;
    bodyEn: string;
    bodyEs: string;
  };
  fields: IntakeField[];
};

/** Everything the engine needs to run one line of business's intake. */
export type IntakeLobConfig = {
  lob: EngineLobSlug;
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
  /** Show the Impact Health Sharing post-sale welcome button on this line's dashboard. */
  impactEnrollment?: boolean;
  /** Partner logo above the client form's title and on its thank-you screen. A file in /public. */
  brandLogo?: { src: string; alt: string; width: number; height: number };
  /**
   * The agent's form gets the CrankWheel meeting panel and a button that opens the Impact sales
   * presentation (`/health-alternative/intake/[token]/presentation`) in a new tab.
   */
  impactPresentation?: boolean;
  /**
   * Numbers a client may type on their own phone through a one-time secure link instead of reading
   * them out on the call. The agent's panel offers these groups; see lib/intake-core/secure-capture.ts.
   */
  secureCapture?: { groups: SecureCaptureGroup[] };

  // ── Options for lines that don't work like Isaac's insurance lines. Absent = today's behavior. ──

  /**
   * The agent dashboard's route key. Defaults to `LOBS[lob].intakeRoute`; a line outside the
   * insurance registry (Legal Shield) must set it.
   */
  intakeRoute?: IntakeRoute;
  /**
   * The agent's form gets the meeting panel and a card that opens this line's sales deck in a new
   * tab. Generic version of `impactPresentation` (which also turns on Impact's quote panel and
   * quote image, so it stays Impact's).
   */
  presentation?: IntakePresentationConfig;
  /**
   * How the agent hands links to the client. `whatsapp`: Copy + WhatsApp buttons that open the
   * agent's own phone (nothing is sent through Isaac's CRM). Default: the CRM "send by text" tags.
   */
  linkDelivery?: { kind: "whatsapp"; agentName: string; product: Record<"en" | "es", string> };
  /** `false`: no public self-start (`/api/intake/<lob>/start` 404s). Default true. */
  selfStart?: boolean;
  /**
   * `ownerEnvVar` must be set: a self-started session never falls back to
   * `INTAKE_DEFAULT_OWNER_USER_ID` (Isaac). Legal Shield's belong to Ysmael or to nobody.
   */
  ownerEnvRequired?: boolean;
  /**
   * Answers a public start link may preset (`/api/intake/<lob>/start?key=value`), each with its
   * allowed values; anything else in the URL is ignored. Legal Shield: the billing the client
   * picked on the public presentation.
   */
  selfStartPresets?: Record<string, readonly string[]>;
  /** Where a failed public start sends the client back to, for a line outside the LOB registry. */
  selfStartFallbackPath?: Record<"en" | "es", string>;
  /**
   * An admin (Isaac) acts as the owner on every session of this line, including another agent's:
   * sees the list, opens the form, summary and deck. Never claims the client's link.
   */
  adminOversight?: boolean;
  /** Extra tags on a contact this line creates (beside the language tag). */
  contactTags?: string[];
  /**
   * A non-admin operator's contact search and start-from-contact only see contacts carrying one of
   * these tags. Unset = admins only (the search covers the whole CRM location).
   */
  contactSearchTags?: string[];
  /**
   * `autosave` (default): native fields sync to the contact on every save. `completion-fill-blanks`:
   * only at completion, and only into fields that are empty on the contact (never overwrites).
   */
  crmSync?: "autosave" | "completion-fill-blanks";
  /** `false`: `pnpm intake:fields` refuses this line and `--all` skips it (no GHL custom fields). */
  crmCustomFields?: boolean;
  /**
   * Keep sensitive answers after completion even when INTAKE_PURGE_AFTER_SYNC is on: this line's
   * numbers never go to the CRM, so the database holds the only copy the agent enrolls from.
   */
  keepSensitiveAfterSync?: boolean;
  /** Path segments of this line's secure link (default `secure` / `seguro`). */
  secureSlug?: Record<"en" | "es", string>;
  /** Every session and link of this line is in this language. */
  fixedLocale?: "en" | "es";
  /** The agent has no CRM login: buttons and messages never mention "the CRM". */
  noCrmWording?: boolean;
  /** Email the session's owner (their Clerk address) when a client finishes the form or a secure link. */
  notifyOwnerByEmail?: boolean;
  /** How the agent's summary shows and copies dates: `mdy` = MM/DD/YYYY. Default ISO. */
  summaryDateFormat?: "iso" | "mdy";
  /** Answers every new session starts with (non-sensitive keys only). */
  initialData?: IntakeData;
};

/** A switch in the agent's presentation bar that writes one answer, e.g. "IDShield included". */
export type PresentationToggle = {
  fieldKey: string;
  onValue: string;
  offValue: string;
  labelEn: string;
  labelEs: string;
  hintEn?: string;
  hintEs?: string;
};

export type IntakePresentationConfig = {
  /** next-intl pathname of the deck, with `[token]`. */
  pathname: string;
  query?: Record<string, string>;
  /** Show the CrankWheel meeting panel (default true). */
  meetings?: boolean;
  /** The bar's card copy. */
  titleEn: string;
  titleEs: string;
  bodyEn: string;
  bodyEs: string;
  joinedEn: string;
  joinedEs: string;
  openEn: string;
  openEs: string;
  /** Switches only the agent sees (their tab is not the one being shared). */
  agentToggles?: PresentationToggle[];
};

/** One thing a secure link can ask the client for: "SSN or ITIN", "ID number", "Bank account". */
export type SecureCaptureGroup = {
  key: string;
  labelEn: string;
  labelEs: string;
  /** Field keys the link may write for this group. Frozen into each link when it is issued. */
  fieldKeys: string[];
  /**
   * A non-sensitive field that must be answered first (the SSN-or-ITIN choice, the ID type). Its
   * answer tells the client's page which number it is asking for.
   */
  requires?: string;
  /**
   * The `requires` answer must also be one of these (e.g. the card group only when the payment
   * method is "Tarjeta"). Without it any answer will do.
   */
  requiresEquals?: string | string[];
  /** Steps where the agent's panel shows, with this group pre-selected. */
  sections: string[];
};

/** Client-safe DTOs. */
export type IntakeStatus = "draft" | "in_progress" | "completed";

export type IntakeData = Record<string, unknown>;

/** Summary row for the agent dashboard list. */
export type IntakeSummary = {
  id: string;
  lob: EngineLobSlug;
  /** Only on an admin's oversight list: who owns the session (and is it the caller). */
  ownerUserId?: string;
  ownerName?: string | null;
  ownedByCaller?: boolean;
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
