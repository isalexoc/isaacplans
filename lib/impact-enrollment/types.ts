/** Client-safe DTOs for the Impact enrollment dialog and its API. */

import type { ImpactLanguage } from "./format";

/** The CRM contact the welcome goes to, as the dialog shows it. */
export type ImpactContact = {
  contactId: string;
  firstName: string;
  lastName: string;
  name: string;
  /** Also the client's Impact portal username, so it must be the email used at enrollment. */
  email: string;
  phone: string;
  /** `spanish` tag → es, otherwise en: the rule the GHL workflow's language branch uses. */
  language: ImpactLanguage;
};

/** What was last sent to a contact. */
export type ImpactEnrollmentRecord = {
  contactId: string;
  memberId: string;
  startDate: string;
  monthlyAmountCents: number;
  paymentDay: number;
  language: ImpactLanguage;
  /** The ID card last sent, in the CRM media library. A resend can reuse it. */
  cardPdfUrl: string | null;
  cardImageUrl: string | null;
  sendCount: number;
  lastSentAt: string | null;
};

/** For the "Sent" badge on dashboard rows. */
export type ImpactEnrollmentStatus = {
  sendCount: number;
  lastSentAt: string | null;
};

export type ImpactEnrollmentDetail = {
  contact: ImpactContact;
  enrollment: ImpactEnrollmentRecord | null;
  /** IMPACT_WELCOME_WEBHOOK_URL is set, so the texts/WhatsApp workflow can be started. */
  webhookConfigured: boolean;
  /** IMPACT_TEMP_PASSWORD is set, so the welcome email can be sent. */
  emailConfigured: boolean;
};

export type ImpactSendResult = {
  enrollment: ImpactEnrollmentRecord;
  /** False when the messages went out but the summary note could not be written to the contact. */
  notePosted: boolean;
  emailSent: boolean;
  workflowStarted: boolean;
  /** The email went out but the texts/WhatsApp workflow refused: resend with only that box ticked. */
  workflowFailed: boolean;
};
