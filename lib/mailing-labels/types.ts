/**
 * Shared types for the mailing-label tool: printed name+address labels for the folders and
 * envelopes Isaac physically mails to final expense prospects.
 *
 * Two output modes, both rendered as real PDFs (see ./pdf.tsx):
 *  - "sticker"  — an Avery peel-and-stick sheet for routine mailings (recipient-focused, branded).
 *  - "shipping" — a USPS Priority Mail FROM/TO label, one recipient per page.
 */

export const MAILING_LABEL_SOURCES = [
  "manual",
  "fe_get_covered",
  "fe_intake",
  "leads_the_way",
] as const;
export type MailingLabelSource = (typeof MAILING_LABEL_SOURCES)[number];

export const MAILING_LABEL_SOURCE_LABELS: Record<MailingLabelSource, string> = {
  manual: "Added by hand",
  fe_get_covered: "Get Covered funnel",
  fe_intake: "FE intake form",
  leads_the_way: "Leads the Way",
};

export const MAILING_LABEL_STATUSES = ["pending", "printed", "archived"] as const;
export type MailingLabelStatus = (typeof MAILING_LABEL_STATUSES)[number];

export type MailingLabelLanguage = "en" | "es";

/** `prospect` = still deciding; `welcome` = they bought, so the letter welcomes them instead. */
export const LETTER_KINDS = ["prospect", "welcome"] as const;
export type LetterKind = (typeof LETTER_KINDS)[number];

/** A queued prospect, as returned by the API. */
export type MailingLabelRecord = {
  id: string;
  source: MailingLabelSource;
  sourceRef: string | null;
  /** Agent CRM contact id when known — what lets the letter read past call summaries. */
  crmContactId: string | null;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  language: MailingLabelLanguage;
  phone: string;
  email: string;
  status: MailingLabelStatus;
  printedAt: string | null;
  notes: string;
  /** Personal letter for the envelope: AI-drafted, then hand-edited. Empty until generated. */
  letterBody: string;
  letterKind: LetterKind;
  letterGeneratedAt: string | null;
  letterEditedAt: string | null;
  letterContext: string;
  createdAt: string | null;
  updatedAt: string | null;
};

/** What the admin form (or an auto-create hook) supplies. */
export type MailingLabelInput = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  language?: MailingLabelLanguage;
  phone?: string;
  email?: string;
  notes?: string;
  /** Nullable so a full record can be spread straight into a patch. */
  crmContactId?: string | null;
};

/** Return address for Priority Mail labels only — never printed on the Avery sticker. */
export type SenderAddress = {
  businessName: string;
  contactName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
};

export const EMPTY_SENDER_ADDRESS: SenderAddress = {
  businessName: "",
  contactName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  phone: "",
};

/** Per-print options. Persisted defaults live in ./settings.ts. */
export type LabelSheetOptions = {
  /** Skip N label positions so a partially used Avery sheet isn't wasted. Sticker presets only. */
  startOffset: number;
  showLogo: boolean;
  showAgentContact: boolean;
  /** Handling line, chosen per label by the label's own `language`. */
  taglines: { en: string; es: string };
};

/** Agent identity printed in the sticker footer, read from the shared leave-behind profile. */
export type LabelAgentContact = {
  name: string;
  phone: string;
};

/**
 * How the agent signs labels and letters. Blank fields fall back to the shared leave-behind
 * profile — this exists so the printed name can differ from the legal one on the profile
 * (e.g. "Isaac Orraiz" rather than "Isaac Orraiz Corrales").
 */
export type LabelAgentOverride = {
  name: string;
  phone: string;
  email: string;
};

export const EMPTY_AGENT_OVERRIDE: LabelAgentOverride = { name: "", phone: "", email: "" };

export type MailingLabelSettings = {
  sender: SenderAddress;
  agent: LabelAgentOverride;
  defaults: {
    stickerPreset: string;
    shippingPreset: string;
    showLogo: boolean;
    showAgentContact: boolean;
    taglines: { en: string; es: string };
  };
};
