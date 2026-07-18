/**
 * Deterministic plain-text formatter for AI call-summary notes.
 * GoHighLevel contact notes render plain text only (no Markdown/HTML), so the
 * visual structure comes from emoji headers, Key: Value rows, and unicode
 * separators — identical layout in English and Spanish.
 */

import {
  maskSensitiveNumbers,
  type CallDisposition,
  type CallLanguage,
  type LineOfBusiness,
  type StructuredCallSummary,
} from "@/lib/call-summary-structured";

export const NOTE_SEPARATOR = "━━━━━━━━━━━━━━━";

const BOLD_CAPITAL_A = 0x1d5d4; // 𝗔
const BOLD_SMALL_A = 0x1d5ee; // 𝗮
const BOLD_DIGIT_0 = 0x1d7ec; // 𝟬

/**
 * Maps A–Z, a–z, 0–9 to Unicode bold sans-serif (𝗔…𝘇, 𝟬…𝟵) so fixed labels
 * read as bold in GHL's plain-text notes. Accented characters (á, ó, ñ…)
 * have no bold variant and pass through unchanged. Never apply to client
 * data values: bold code points break CRM text search.
 */
export function toBoldSans(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x41 && code <= 0x5a) out += String.fromCodePoint(BOLD_CAPITAL_A + code - 0x41);
    else if (code >= 0x61 && code <= 0x7a) out += String.fromCodePoint(BOLD_SMALL_A + code - 0x61);
    else if (code >= 0x30 && code <= 0x39) out += String.fromCodePoint(BOLD_DIGIT_0 + code - 0x30);
    else out += ch;
  }
  return out;
}

export const LOB_META: Record<LineOfBusiness, { emoji: string; en: string; es: string }> = {
  aca: { emoji: "🩺", en: "ACA", es: "ACA" },
  stm: { emoji: "🚑", en: "STM", es: "STM" },
  dental_vision: { emoji: "🦷", en: "Dental/Vision", es: "Dental/Visión" },
  hospital_indemnity: { emoji: "🏥", en: "Hospital Indemnity", es: "Indemnización Hosp." },
  iul: { emoji: "📈", en: "IUL", es: "IUL" },
  final_expense: { emoji: "🕊️", en: "Final Expense", es: "Gastos Finales" },
  other: { emoji: "📋", en: "General", es: "General" },
};

export const DISPOSITION_META: Record<CallDisposition, { emoji: string; en: string; es: string }> = {
  sale: { emoji: "✅", en: "Sale", es: "Venta" },
  quoted: { emoji: "💲", en: "Quoted", es: "Cotizado" },
  follow_up: { emoji: "📅", en: "Follow-up", es: "Seguimiento" },
  appointment_set: { emoji: "🗓️", en: "Appointment set", es: "Cita agendada" },
  needs_info: { emoji: "📄", en: "Needs info", es: "Falta información" },
  not_interested: { emoji: "❌", en: "Not interested", es: "No interesado" },
  no_decision: { emoji: "🤔", en: "No decision", es: "Sin decisión" },
  service: { emoji: "🛠️", en: "Service", es: "Servicio" },
  voicemail: { emoji: "📩", en: "Voicemail", es: "Buzón de voz" },
  other: { emoji: "📞", en: "Call", es: "Llamada" },
};

const LABELS = {
  en: {
    summary: "SUMMARY",
    clientInfo: "CLIENT INFO",
    health: "HEALTH",
    financial: "FINANCIAL",
    policy: "QUOTE / POLICY",
    objections: "OBJECTIONS",
    nextSteps: "NEXT STEPS",
    otherNotes: "OTHER NOTES",
    coaching: "COACHING",
    followUp: "Follow-up",
    name: "Name",
    dob: "DOB",
    age: "Age",
    gender: "Gender",
    maritalStatus: "Marital status",
    spouse: "Spouse",
    occupation: "Occupation",
    householdSize: "Household size",
    address: "Address",
    state: "State",
    phone: "Phone",
    email: "Email",
    heightWeight: "Height/Weight",
    tobacco: "Tobacco",
    conditions: "Conditions",
    medications: "Medications",
    recentEvents: "Recent",
    income: "Income",
    incomeSource: "Income source",
    budget: "Budget",
    paymentMethod: "Payment",
    subsidy: "Subsidy",
    currentCoverage: "Current coverage",
    carrier: "Carrier",
    plan: "Plan",
    faceAmount: "Face amount",
    premium: "Premium",
    deductible: "Deductible",
    effectiveDate: "Effective",
    beneficiary: "Beneficiary",
    policyNumber: "Policy #",
    contribution: "Contribution",
    quotesGiven: "Quotes given",
    agent: "agent",
    client: "client",
  },
  es: {
    summary: "RESUMEN",
    clientInfo: "DATOS DEL CLIENTE",
    health: "SALUD",
    financial: "FINANZAS",
    policy: "COTIZACIÓN / PÓLIZA",
    objections: "OBJECIONES",
    nextSteps: "PRÓXIMOS PASOS",
    otherNotes: "OTRAS NOTAS",
    coaching: "COACHING",
    followUp: "Seguimiento",
    name: "Nombre",
    dob: "Fecha de nac.",
    age: "Edad",
    gender: "Género",
    maritalStatus: "Estado civil",
    spouse: "Cónyuge",
    occupation: "Ocupación",
    householdSize: "Tamaño del hogar",
    address: "Dirección",
    state: "Estado",
    phone: "Teléfono",
    email: "Email",
    heightWeight: "Estatura/Peso",
    tobacco: "Tabaco",
    conditions: "Padecimientos",
    medications: "Medicamentos",
    recentEvents: "Reciente",
    income: "Ingresos",
    incomeSource: "Fuente de ingresos",
    budget: "Presupuesto",
    paymentMethod: "Pago",
    subsidy: "Subsidio",
    currentCoverage: "Cobertura actual",
    carrier: "Aseguradora",
    plan: "Plan",
    faceAmount: "Suma asegurada",
    premium: "Prima",
    deductible: "Deducible",
    effectiveDate: "Vigencia",
    beneficiary: "Beneficiario",
    policyNumber: "Póliza #",
    contribution: "Aportación",
    quotesGiven: "Cotizaciones",
    agent: "agente",
    client: "cliente",
  },
} satisfies Record<CallLanguage, Record<string, string>>;

function row(label: string, value?: string): string | null {
  return value ? `${toBoldSans(label)}: ${value}` : null;
}

/** Returns the section lines (header + rows + trailing blank) or [] when empty. */
function section(emoji: string, title: string, lines: Array<string | null>): string[] {
  const content = lines.filter((line): line is string => Boolean(line));
  if (content.length === 0) return [];
  return [`${emoji} ${toBoldSans(title)}`, ...content, ""];
}

/** At-a-glance first line: `🕊️ Final Expense | 💲 Quoted | 📅 Follow-up: Tue 7/22 2 PM` */
export function buildStatusLine(s: StructuredCallSummary): string {
  const t = LABELS[s.language];
  const lob = LOB_META[s.lineOfBusiness];
  const disposition = DISPOSITION_META[s.disposition];
  const parts = [`${lob.emoji} ${toBoldSans(lob[s.language])}`];
  // A follow_up disposition would just duplicate the follow-up chip after it.
  if (!(s.disposition === "follow_up" && s.followUpDate)) {
    parts.push(`${disposition.emoji} ${toBoldSans(disposition[s.language])}`);
  }
  if (s.followUpDate) parts.push(`📅 ${toBoldSans(t.followUp)}: ${s.followUpDate}`);
  return parts.join(" | ");
}

/**
 * ⭐ line under the status line: the single most important money fact —
 * the main policy quote, else the first additional quote. Values stay
 * plain text so they remain searchable.
 */
function buildKeyFactLine(s: StructuredCallSummary): string | null {
  const policy = s.policy ?? {};
  if (policy.premium) {
    const parts = [
      [policy.carrier, policy.plan].filter(Boolean).join(" "),
      policy.faceAmount,
      policy.premium,
    ].filter(Boolean);
    return `⭐ ${parts.join(" — ")}`;
  }
  const quote = s.quotes?.[0];
  if (quote?.premium) {
    const parts = [
      [quote.carrier, quote.plan].filter(Boolean).join(" "),
      quote.faceAmount,
      quote.premium,
    ].filter(Boolean);
    return `⭐ ${parts.join(" — ")}`;
  }
  return null;
}

export function formatLocalizedDate(iso: string | undefined, language: CallLanguage): string {
  const date = iso ? new Date(iso) : new Date();
  const valid = Number.isNaN(date.getTime()) ? new Date() : date;
  return valid.toLocaleString(language === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDobRow(t: (typeof LABELS)["en"], profile: NonNullable<StructuredCallSummary["clientProfile"]>): string | null {
  if (profile.dob) {
    return row(t.dob, profile.age ? `${profile.dob} (${t.age.toLowerCase()} ${profile.age})` : profile.dob);
  }
  return row(t.age, profile.age);
}

function formatQuoteBullet(quote: NonNullable<StructuredCallSummary["quotes"]>[number]): string {
  const main = [
    [quote.carrier, quote.plan].filter(Boolean).join(" "),
    quote.faceAmount,
    quote.premium,
  ]
    .filter(Boolean)
    .join(" — ");
  const text = main || quote.notes || "";
  return `• ${main && quote.notes ? `${main} (${quote.notes})` : text}`;
}

function formatNextStepBullet(t: (typeof LABELS)["en"], step: NonNullable<StructuredCallSummary["nextSteps"]>[number]): string {
  const date = step.date ? `[${step.date}] ` : "";
  const owner = step.owner ? ` — ${t[step.owner]}` : "";
  return `• ${date}${step.action}${owner}`;
}

/**
 * Builds the full note body (between the [prefix] header line and the
 * "Generated from…" footer, both added by formatNoteBody in
 * lib/agent-crm-call-summary.ts). Empty sections are omitted entirely.
 */
export function formatStructuredNote(s: StructuredCallSummary): string {
  const t = LABELS[s.language];
  const profile = s.clientProfile ?? {};
  const health = s.health ?? {};
  const financial = s.financial ?? {};
  const policy = s.policy ?? {};

  const lines: string[] = [buildStatusLine(s)];
  const keyFact = buildKeyFactLine(s);
  if (keyFact) lines.push(keyFact);
  lines.push(NOTE_SEPARATOR);

  lines.push(...section("📝", t.summary, [s.summary || null]));

  lines.push(
    ...section("👤", t.clientInfo, [
      row(t.name, profile.name),
      formatDobRow(t, profile),
      row(t.gender, profile.gender),
      row(t.maritalStatus, profile.maritalStatus),
      row(t.spouse, profile.spouse),
      row(t.occupation, profile.occupation),
      row(t.householdSize, profile.householdSize),
      row(t.address, profile.address),
      profile.address ? null : row(t.state, profile.state),
      row(t.phone, profile.phone),
      row(t.email, profile.email),
    ])
  );

  lines.push(
    ...section("🏥", t.health, [
      row(t.heightWeight, health.heightWeight),
      row(t.tobacco, health.tobacco),
      row(t.conditions, health.conditions?.join(", ")),
      row(t.medications, health.medications?.join(", ")),
      row(t.recentEvents, health.recentEvents),
    ])
  );

  lines.push(
    ...section("💰", t.financial, [
      row(t.income, financial.income),
      row(t.incomeSource, financial.incomeSource),
      row(t.budget, financial.budget),
      row(t.paymentMethod, financial.paymentMethod),
      row(t.subsidy, financial.subsidy),
    ])
  );

  const quoteBullets = s.quotes?.map(formatQuoteBullet) ?? [];
  lines.push(
    ...section("📋", t.policy, [
      row(t.currentCoverage, policy.currentCoverage),
      row(t.carrier, policy.carrier),
      row(t.plan, policy.plan),
      row(t.faceAmount, policy.faceAmount),
      row(t.premium, policy.premium),
      row(t.deductible, policy.deductible),
      row(t.contribution, policy.contribution),
      row(t.effectiveDate, policy.effectiveDate),
      row(t.beneficiary, policy.beneficiary),
      row(t.policyNumber, policy.policyNumber),
      ...(quoteBullets.length > 0 ? [`${toBoldSans(t.quotesGiven)}:`, ...quoteBullets] : []),
    ])
  );

  lines.push(...section("⚠️", t.objections, s.objections?.map((o) => `• ${o}`) ?? []));

  lines.push(
    ...section("✅", t.nextSteps, s.nextSteps?.map((step) => formatNextStepBullet(t, step)) ?? [])
  );

  lines.push(...section("📌", t.otherNotes, s.otherNotes?.map((n) => `• ${n}`) ?? []));

  lines.push(...section("💡", t.coaching, s.coaching?.map((c) => `• ${c}`) ?? []));

  // Drop the trailing blank line left by the last section.
  while (lines[lines.length - 1] === "") lines.pop();

  return maskSensitiveNumbers(lines.join("\n"));
}
