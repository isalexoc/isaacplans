/**
 * Shared types for the ACA eligibility-application review confirmation (the CMS e-signature).
 *
 * Isomorphic: imported by the server, the API routes, the admin dialog and the public signing page.
 * Every API response shape lives here, so the client and the server cannot drift apart.
 */

export type AcaConfirmationLanguage = "en" | "es";

/** Stored status. `pending` past its expiry is reported as the derived state `expired`. */
export type AcaConfirmationStatus = "pending" | "signed" | "cancelled";
export type AcaConfirmationState = AcaConfirmationStatus | "expired";

export type SignatureMethod = "drawn" | "typed";

/** One point of a drawn stroke, as `signature_pad` reports it (CSS pixels, ms epoch). */
export type SignaturePoint = { x: number; y: number; time: number; pressure?: number };
/** One pen-down → pen-up stroke. Kept with the signature as forensic evidence of a hand-drawn mark. */
export type SignatureStroke = { points: SignaturePoint[] };

/** The agent printed on the form. Snapshotted onto every request so env changes never alter a record. */
export type AcaConfirmationAgent = {
  name: string;
  npn: string;
  phone: string;
  email: string;
  agency: string;
};

// ─── The signed text ─────────────────────────────────────────────────────────

/** Values that fill a form template. `reviewedAt` is null before signing ("recorded when you sign"). */
export type AcaConfirmationFormVars = {
  consumerName: string;
  consumerEmail: string;
  agent: AcaConfirmationAgent;
  reviewedAt: string | null;
};

/** One block of the rendered form. The page, the dialog preview and the PDF all render these. */
export type AcaConfirmationFormBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "fields"; rows: Array<{ label: string; value: string }> }
  | { kind: "fine"; text: string };

export type AcaConfirmationRenderedForm = {
  version: string;
  language: AcaConfirmationLanguage;
  title: string;
  blocks: AcaConfirmationFormBlock[];
  /** The checkbox the signer ticks: review confirmed + consent to sign electronically. */
  consent: string;
};

/** Exactly what the client saw and signed, frozen on the row at signing time. */
export type AcaConfirmationSnapshot = AcaConfirmationRenderedForm & {
  signedAtIso: string;
  /** `signedAt` in the agent's timezone, e.g. "Nov 9, 2026, 9:28 PM EST". */
  signedAtLocal: string;
  timeZone: string;
};

// ─── Audit trail ─────────────────────────────────────────────────────────────

export type AcaConfirmationEventType =
  | "created"
  | "email_sent"
  | "email_failed"
  | "resent"
  | "viewed"
  | "signed"
  | "cancelled"
  | "pdf_stored"
  | "crm_file_saved"
  | "note_posted"
  | "tagged"
  | "finalize_failed";

/** One row of the PDF's signature-trail page. Built by the server from the events table. */
export type AcaConfirmationTrailEntry = {
  at: string; // ISO
  type: "created" | "email_sent" | "resent" | "viewed" | "signed";
  /** Agent name for created/email_sent/resent, the consumer's name for viewed/signed. */
  who: string;
  /** Recipient, on email_sent/resent. */
  email: string | null;
  ip: string | null;
  /** "Miami, FL, US" */
  location: string | null;
  /** "Safari · iPhone" */
  device: string | null;
};

// ─── Admin API (dialog + dashboard) ──────────────────────────────────────────

/** The CRM contact as the dialog shows it. Language comes from the contact's `spanish` tag. */
export type AcaConfirmationContact = {
  contactId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  language: AcaConfirmationLanguage;
};

/** One request as the agent sees it. Never carries the signature image or the client's IP. */
export type AcaConfirmationRecord = {
  id: string;
  status: AcaConfirmationStatus;
  state: AcaConfirmationState;
  language: AcaConfirmationLanguage;
  consumerName: string;
  contactEmail: string;
  createdAt: string;
  lastSentAt: string | null;
  sendCount: number;
  expiresAt: string;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  signedAt: string | null;
  signedLanguage: AcaConfirmationLanguage | null;
  signatureMethod: SignatureMethod | null;
  /** "Miami, FL, US", or null. */
  signerLocation: string | null;
  /** "Safari · iPhone", or null. */
  signerDevice: string | null;
  /** The signer's IP matched an IP the agent used for this request (flag, shown to the agent and on the PDF). */
  signerIpMatchesAgent: boolean;
  cancelledAt: string | null;
  pdfStored: boolean;
  crmFileSaved: boolean;
  notePosted: boolean;
  tagged: boolean;
  /** The client's signing link, only while the request is pending and unexpired (for "Copy link"). */
  url: string | null;
};

/** Dashboard badge: the newest request for a contact. `at` is signedAt, else lastSentAt, else createdAt. */
export type AcaConfirmationBadge = { id: string; state: AcaConfirmationState; at: string };

export type AcaConfirmationEmailIssue = "missing" | "agency_domain" | null;

export type AcaConfirmationDetail = {
  /**
   * Null when the CRM couldn't return the contact (merged, deleted, or the CRM is down). The history
   * still loads, so signed records stay reachable for an audit; only sending is disabled.
   */
  contact: AcaConfirmationContact | null;
  /** Why `contact` is null. */
  contactError: string | null;
  /** Legal name to prefill: the intake's primary applicant when known, else the CRM name. */
  suggestedName: string;
  /** Null when ACA_AGENT_NPN is not set: nothing can be sent until it is. */
  agent: AcaConfirmationAgent | null;
  emailIssue: AcaConfirmationEmailIssue;
  config: {
    /** ACA_CONFIRMATION_FILE_FIELD_ID is set, so the PDF also lands in the contact's Documents. */
    fileFieldConfigured: boolean;
    /** Form version a new request would use, and whether it allows a typed signature. */
    formVersion: string;
    allowTypedSignature: boolean;
    linkTtlDays: number;
    /**
     * "py2028": from Aug 1, 2027 this form version is valid only for plan-year-2027 coverage (CMS
     * requires its own HHS form for plan year 2028). The dialog shows a warning; null otherwise.
     */
    formNotice: "py2028" | null;
  };
  /** Every request for this contact, newest first. */
  history: AcaConfirmationRecord[];
};

export type AcaConfirmationCreateInput = {
  consumerName: string;
  language: AcaConfirmationLanguage;
  /** `aca_intake_sessions.id` when the dialog was opened from an intake row (recorded on the request). */
  intakeSessionId?: string;
};

export type AcaConfirmationAction = "resend" | "cancel";

// ─── Public API (the client's signing page) ──────────────────────────────────

/** Everything the signing page needs. Both languages are rendered so the EN/ES toggle needs no refetch. */
export type AcaConfirmationPublicView = {
  language: AcaConfirmationLanguage;
  firstName: string;
  consumerName: string;
  form: Record<AcaConfirmationLanguage, AcaConfirmationRenderedForm>;
  allowTypedSignature: boolean;
  agent: { name: string; phone: string; email: string };
  expiresAt: string;
};

/** Why a link can't be used. The page localizes these; the server never sends display text. */
export type AcaConfirmationDeadCode = "not_found" | "signed" | "cancelled" | "expired";

export type AcaConfirmationSignInput = {
  /** The language the form was shown in when signed. */
  language: AcaConfirmationLanguage;
  agreed: true;
  method: SignatureMethod;
  /** `data:image/png;base64,…` — both methods arrive as one PNG. */
  png: string;
  /** Drawn only. */
  strokes?: SignatureStroke[];
  /** Typed only: the text the client typed. */
  typedName?: string;
};

export type AcaConfirmationSignResult = { signedAt: string; signedAtLocal: string };

// ─── HTTP response bodies (the routes and both api-clients share these) ─────

export type AcaConfirmationApiError = { success: false; error: string };

/** GET /api/admin/aca-confirmation?contactIds=a,b */
export type AcaConfirmationBadgesResponse = { success: true; badges: Record<string, AcaConfirmationBadge> };

/** GET /api/admin/aca-confirmation/[contactId]?intake=<sessionId> */
export type AcaConfirmationDetailResponse = { success: true; detail: AcaConfirmationDetail };

/**
 * POST /api/admin/aca-confirmation/[contactId]. 200 whenever the request row was created: if the
 * email then failed, `emailSent` is false and `emailError` says why. The link still works, so the
 * agent can copy it or resend.
 */
export type AcaConfirmationCreateResponse = {
  success: true;
  record: AcaConfirmationRecord;
  emailSent: boolean;
  emailError: string | null;
};

/** 409 from the create route: this contact already has a pending, unexpired request. */
export type AcaConfirmationPendingExistsResponse = {
  success: false;
  code: "pending_exists";
  error: string;
  record: AcaConfirmationRecord;
};

/** GET and POST /api/admin/aca-confirmation/requests/[id]. The email fields are set on `resend`. */
export type AcaConfirmationRecordResponse = {
  success: true;
  record: AcaConfirmationRecord;
  emailSent?: boolean;
  emailError?: string | null;
};

/** GET /api/aca-confirmation/[token] — 200. */
export type AcaConfirmationPublicViewResponse = { success: true; view: AcaConfirmationPublicView };

/**
 * GET or POST /api/aca-confirmation/[token] on a link that can't be used: 404 for `not_found`, 410
 * otherwise. The agent's name and phone let the page say who to call; null for `not_found`.
 */
export type AcaConfirmationDeadResponse = {
  success: false;
  code: AcaConfirmationDeadCode;
  agentName: string | null;
  agentPhone: string | null;
  /** When `code` is "signed": the signing time in the agent's timezone. */
  signedAtLocal: string | null;
};

/** POST /api/aca-confirmation/[token] — 200. */
export type AcaConfirmationSignResponse = { success: true; result: AcaConfirmationSignResult };

/** POST /api/aca-confirmation/[token] — 400. `issue` is the first validation message code, e.g. "signature_too_short". */
export type AcaConfirmationInvalidResponse = { success: false; code: "invalid"; issue: string | null };

/** Any public route — 500. */
export type AcaConfirmationServerErrorResponse = { success: false; code: "error" };
