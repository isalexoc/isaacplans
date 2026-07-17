/**
 * Structured call-summary contract between the OpenAI extraction step and the
 * deterministic note formatter. All values are free-form strings so model
 * variance can never break parsing; the normalizer below never throws.
 */

export type CallLanguage = "en" | "es";

export type LineOfBusiness =
  | "aca"
  | "stm"
  | "dental_vision"
  | "hospital_indemnity"
  | "iul"
  | "final_expense"
  | "other";

export type CallDisposition =
  | "sale"
  | "quoted"
  | "follow_up"
  | "appointment_set"
  | "needs_info"
  | "not_interested"
  | "no_decision"
  | "service"
  | "voicemail"
  | "other";

export type CallNextStep = {
  action: string;
  date?: string;
  owner?: "agent" | "client";
};

export type CallQuote = {
  carrier?: string;
  plan?: string;
  faceAmount?: string;
  premium?: string;
  notes?: string;
};

export type StructuredCallSummary = {
  language: CallLanguage;
  lineOfBusiness: LineOfBusiness;
  disposition: CallDisposition;
  title: string;
  summary: string;
  clientProfile?: {
    name?: string;
    dob?: string;
    age?: string;
    gender?: string;
    address?: string;
    phone?: string;
    email?: string;
    maritalStatus?: string;
    occupation?: string;
    spouse?: string;
    householdSize?: string;
    state?: string;
  };
  health?: {
    heightWeight?: string;
    tobacco?: string;
    conditions?: string[];
    medications?: string[];
    recentEvents?: string;
  };
  financial?: {
    income?: string;
    incomeSource?: string;
    budget?: string;
    paymentMethod?: string;
    subsidy?: string;
  };
  policy?: {
    currentCoverage?: string;
    carrier?: string;
    plan?: string;
    faceAmount?: string;
    premium?: string;
    deductible?: string;
    effectiveDate?: string;
    beneficiary?: string;
    policyNumber?: string;
    contribution?: string;
  };
  quotes?: CallQuote[];
  objections?: string[];
  nextSteps?: CallNextStep[];
  followUpDate?: string;
  coaching?: string[];
  otherNotes?: string[];
};

const EMPTY_PLACEHOLDERS = new Set(["n/a", "na", "none", "unknown", "null", "undefined", "-", "no data", "not provided"]);

function asString(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || EMPTY_PLACEHOLDERS.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

function asStringArray(value: unknown): string[] | undefined {
  const source = Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [];
  const items = source
    .map((item) =>
      typeof item === "object" && item !== null
        ? asString(Object.values(item as Record<string, unknown>).map(asString).filter(Boolean).join(" — "))
        : asString(item)
    )
    .filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Keeps an object only when at least one field survived normalization. */
function compact<T extends Record<string, unknown>>(obj: T): T | undefined {
  return Object.values(obj).some((v) => v !== undefined) ? obj : undefined;
}

const LOB_ALIASES: Record<string, LineOfBusiness> = {
  aca: "aca",
  marketplace: "aca",
  obamacare: "aca",
  health: "aca",
  stm: "stm",
  short_term: "stm",
  short_term_medical: "stm",
  dental: "dental_vision",
  vision: "dental_vision",
  dental_vision: "dental_vision",
  hospital: "hospital_indemnity",
  hospital_indemnity: "hospital_indemnity",
  iul: "iul",
  indexed_universal_life: "iul",
  final_expense: "final_expense",
  fe: "final_expense",
  burial: "final_expense",
  life: "final_expense",
  other: "other",
};

const DISPOSITION_VALUES: CallDisposition[] = [
  "sale",
  "quoted",
  "follow_up",
  "appointment_set",
  "needs_info",
  "not_interested",
  "no_decision",
  "service",
  "voicemail",
  "other",
];

function normalizeEnumKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "") : "";
}

function normalizeLob(value: unknown): LineOfBusiness {
  return LOB_ALIASES[normalizeEnumKey(value)] ?? "other";
}

function normalizeDisposition(value: unknown): CallDisposition {
  const key = normalizeEnumKey(value);
  return DISPOSITION_VALUES.find((d) => d === key) ?? "other";
}

const SPANISH_STOPWORDS = /\b(el|la|los|las|que|para|con|una|pero|porque|usted|está|señora?|gracias|llamada|cliente|póliza|seguro)\b/gi;

function detectLanguage(value: unknown, sampleText: string): CallLanguage {
  const key = normalizeEnumKey(value);
  if (key === "es" || key.startsWith("spanish") || key.startsWith("espa")) return "es";
  if (key === "en" || key.startsWith("english") || key.startsWith("ingl")) return "en";
  const matches = sampleText.match(SPANISH_STOPWORDS);
  return matches && matches.length >= 3 ? "es" : "en";
}

function normalizeNextSteps(value: unknown): CallNextStep[] | undefined {
  if (!Array.isArray(value)) {
    const single = asString(value);
    return single ? [{ action: single }] : undefined;
  }
  const steps = value
    .map((item): CallNextStep | undefined => {
      if (typeof item === "string") {
        const action = asString(item);
        return action ? { action } : undefined;
      }
      const record = asRecord(item);
      const action = asString(record.action) ?? asString(record.task) ?? asString(record.step);
      if (!action) return undefined;
      const ownerKey = normalizeEnumKey(record.owner);
      return {
        action,
        date: asString(record.date) ?? asString(record.when),
        owner: ownerKey === "agent" || ownerKey === "client" ? ownerKey : undefined,
      };
    })
    .filter((step): step is CallNextStep => Boolean(step));
  return steps.length > 0 ? steps : undefined;
}

function normalizeQuotes(value: unknown): CallQuote[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const quotes = value
    .map((item): CallQuote | undefined => {
      if (typeof item === "string") {
        const notes = asString(item);
        return notes ? { notes } : undefined;
      }
      const record = asRecord(item);
      return compact({
        carrier: asString(record.carrier),
        plan: asString(record.plan),
        faceAmount: asString(record.faceAmount ?? record.face_amount),
        premium: asString(record.premium),
        notes: asString(record.notes),
      });
    })
    .filter((quote): quote is CallQuote => Boolean(quote));
  return quotes.length > 0 ? quotes : undefined;
}

/**
 * Coerces whatever the model returned into a usable StructuredCallSummary.
 * Never throws: unknown enum values become "other", malformed shapes are
 * dropped, and the worst case degrades to a title + summary-only note.
 */
export function normalizeStructuredSummary(raw: unknown): StructuredCallSummary {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    const fallback = asString(raw) ?? "";
    return {
      language: detectLanguage(undefined, fallback),
      lineOfBusiness: "other",
      disposition: "other",
      title: "Call summary",
      summary: fallback,
    };
  }

  const record = raw as Record<string, unknown>;
  const title = asString(record.title) ?? "Call summary";
  const summary = asString(record.summary) ?? asString(record.body) ?? "";
  const profile = asRecord(record.clientProfile ?? record.client_profile ?? record.client);
  const health = asRecord(record.health);
  const financial = asRecord(record.financial);
  const policy = asRecord(record.policy);

  return {
    language: detectLanguage(record.language, `${summary} ${title}`),
    lineOfBusiness: normalizeLob(record.lineOfBusiness ?? record.line_of_business ?? record.callType),
    disposition: normalizeDisposition(record.disposition ?? record.outcome),
    title,
    summary,
    clientProfile: compact({
      name: asString(profile.name),
      dob: asString(profile.dob ?? profile.dateOfBirth ?? profile.date_of_birth),
      age: asString(profile.age),
      gender: asString(profile.gender),
      address: asString(profile.address),
      phone: asString(profile.phone),
      email: asString(profile.email),
      maritalStatus: asString(profile.maritalStatus ?? profile.marital_status),
      occupation: asString(profile.occupation),
      spouse: asString(profile.spouse),
      householdSize: asString(profile.householdSize ?? profile.household_size),
      state: asString(profile.state),
    }),
    health: compact({
      heightWeight: asString(health.heightWeight ?? health.height_weight),
      tobacco: asString(health.tobacco ?? health.smoker),
      conditions: asStringArray(health.conditions),
      medications: asStringArray(health.medications),
      recentEvents: asString(health.recentEvents ?? health.recent_events),
    }),
    financial: compact({
      income: asString(financial.income),
      incomeSource: asString(financial.incomeSource ?? financial.income_source),
      budget: asString(financial.budget),
      paymentMethod: asString(financial.paymentMethod ?? financial.payment_method),
      subsidy: asString(financial.subsidy),
    }),
    policy: compact({
      currentCoverage: asString(policy.currentCoverage ?? policy.current_coverage),
      carrier: asString(policy.carrier),
      plan: asString(policy.plan),
      faceAmount: asString(policy.faceAmount ?? policy.face_amount),
      premium: asString(policy.premium),
      deductible: asString(policy.deductible),
      effectiveDate: asString(policy.effectiveDate ?? policy.effective_date),
      beneficiary: asString(policy.beneficiary),
      policyNumber: asString(policy.policyNumber ?? policy.policy_number),
      contribution: asString(policy.contribution),
    }),
    quotes: normalizeQuotes(record.quotes),
    objections: asStringArray(record.objections),
    nextSteps: normalizeNextSteps(record.nextSteps ?? record.next_steps),
    followUpDate: asString(record.followUpDate ?? record.follow_up_date),
    coaching: asStringArray(record.coaching),
    otherNotes: asStringArray(record.otherNotes ?? record.other_notes),
  };
}

const SSN_PATTERN = /\b(\d{3})[- ](\d{2})[- ](\d{4})\b/g;
const CARD_PATTERN = /\b\d(?:[ -]?\d){12,18}\b/g;
const TRIGGER_PATTERN =
  /\b(ssn|social security(?: number)?|seguro social|routing|account(?: number)?|cuenta|tarjeta|card(?: number)?|acct)\b([^0-9]{0,40})(\d(?:[ -]?\d){7,11})\b(?![ -]?\d)/gi;

/**
 * Compliance backstop: masks SSNs, card numbers, and trigger-word-adjacent
 * account numbers down to their last 4 digits. Phone numbers are untouched
 * (they lack separators of SSN shape, 13+ digits, or trigger proximity).
 */
export function maskSensitiveNumbers(text: string): string {
  return text
    .replace(SSN_PATTERN, (_m, _a, _b, last4: string) => `•••-••-${last4}`)
    .replace(TRIGGER_PATTERN, (_m, trigger: string, gap: string, digits: string) => {
      const clean = digits.replace(/[^0-9]/g, "");
      return `${trigger}${gap}•••${clean.slice(-4)}`;
    })
    .replace(CARD_PATTERN, (match) => {
      const clean = match.replace(/[^0-9]/g, "");
      if (clean.length < 13 || clean.length > 19) return match;
      return `•••• ${clean.slice(-4)}`;
    });
}
