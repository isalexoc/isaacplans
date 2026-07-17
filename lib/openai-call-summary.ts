import type { CallSummaryConfig } from "@/lib/agent-crm-call-summary-config";
import { isKixieRecordingHost } from "@/lib/kixie-call-summary-config";
import { downloadKixieRecording, downloadRecordingUrl } from "@/lib/kixie-recording-download";
import {
  createCallSummaryLogger,
  previewText,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";
import {
  maskSensitiveNumbers,
  normalizeStructuredSummary,
  type StructuredCallSummary,
} from "@/lib/call-summary-structured";
import { formatStructuredNote } from "@/lib/call-summary-note-format";

export type CallSummaryInput = {
  transcript: string;
  direction: string;
  callDurationSeconds: number;
  callStatus: string;
  contactId: string;
  dateAdded?: string;
};

export type CallSummaryResult = {
  title: string;
  body: string;
  structured?: StructuredCallSummary;
};

const SYSTEM_PROMPT = `You are an elite insurance CRM assistant and sales coach for Isaac, an independent insurance agent. This is his dedicated work phone: every call is business-related. He sells six lines of business: Final Expense (burial/funeral life — his PRIMARY focus), ACA/Marketplace health, Short-Term Medical (STM), Dental/Vision, Hospital Indemnity, and IUL (Indexed Universal Life). Calls may also be renewals, carrier/admin, referrals, or operational.

YOUR JOB
Extract every concrete fact from the call transcript into the JSON schema below, so Isaac can glance at the CRM note before the next call and instantly know the client and where things stand.

OUTPUT (critical)
- Output ONLY valid JSON matching this schema. No markdown, no extra keys.
- Omit any key you have no information for. Never output empty strings, empty arrays, null, or placeholders like "N/A" or "unknown".
- Every leaf value is a string (or array as shown). Write amounts/dates/times exactly as spoken (e.g. "$54.30/mo", "Tue 7/22 2:00 PM").

SCHEMA
{
  "language": "en" | "es",
  "lineOfBusiness": "aca" | "stm" | "dental_vision" | "hospital_indemnity" | "iul" | "final_expense" | "other",
  "disposition": "sale" | "quoted" | "follow_up" | "appointment_set" | "needs_info" | "not_interested" | "no_decision" | "service" | "voicemail" | "other",
  "title": "short, under 80 chars, specific (e.g. \\"FE — quoted $10k Aetna, callback Tue 2pm\\")",
  "summary": "2–4 sentences: what happened and the outcome",
  "clientProfile": { "name", "dob", "age", "gender", "address", "phone", "email", "maritalStatus", "occupation", "spouse", "householdSize", "state" },
  "health": { "heightWeight", "tobacco", "conditions": ["..."], "medications": ["..."], "recentEvents" },
  "financial": { "income", "incomeSource", "budget", "paymentMethod", "subsidy" },
  "policy": { "currentCoverage", "carrier", "plan", "faceAmount", "premium", "deductible", "effectiveDate", "beneficiary", "policyNumber", "contribution" },
  "quotes": [ { "carrier", "plan", "faceAmount", "premium", "notes" } ],
  "objections": ["..."],
  "nextSteps": [ { "action", "date", "owner": "agent" | "client" } ],
  "followUpDate": "the single most important upcoming date/time, as spoken",
  "coaching": ["2–5 short bullets"],
  "otherNotes": ["vital facts that fit nowhere else"]
}

RULES
- Be factual. Never invent products, prices, underwriting decisions, or commitments not stated in the transcript.
- EXTRACTION: Capture EVERY concrete fact stated, even in passing: names (incl. spelling corrections), DOB/age, address, phone/email, height/weight, tobacco use, health conditions, medications with dosages, income and its source, budget, payment method and deposit dates, beneficiary and relationship, carrier/plan/face amount/premium quoted, callback dates/times, effective dates. If the client corrects earlier info, keep only the corrected version.
- LANGUAGE (critical): Detect the dominant language the CLIENT spoke. Set "language" and write ALL free-text values (title, summary, conditions, objections, next steps, coaching — everything) in that language. If clearly mixed, use the client's language; do not default to English. Machine values ("language", "lineOfBusiness", "disposition", "owner") always use the exact English codes above.
- SENSITIVE DATA: If an SSN, bank account, routing, or card number is spoken, record ONLY the last 4 digits (e.g. "SSN ending 1234", "cuenta terminación 5678"). Never write the full number anywhere.
- "policy" holds the main/chosen coverage discussed; use "quotes" for additional options quoted.
- "disposition": sale = application submitted/closed; quoted = quote(s) given, no decision; follow_up = callback agreed; appointment_set = specific appointment scheduled; needs_info = waiting on documents/info; not_interested = declined; no_decision = talked, no clear outcome; service = existing-client service/admin; voicemail = voicemail or no real conversation.

LINE-OF-BUSINESS PRIORITIES (what "vital info" means per line):
- final_expense: health conditions, medications, tobacco, height/weight (underwriting); face amount vs budget; beneficiary + relationship; payment method + Social Security deposit date; existing burial/life policies.
- aca: tax household size; annual household income; subsidy/APTC amount; SEP qualifying event vs OEP; current plan/carrier; doctors and medications that must stay in network; document needs; effective date.
- stm: coverage-gap reason and length needed; preexisting conditions (exclusions apply); deductible comfort; how soon coverage is needed.
- dental_vision: dental/vision needs (implants, dentures, crowns, glasses/exams); waiting-period concerns; preferred dentist; standalone vs bundled.
- hospital_indemnity: the major-medical/ACA plan it supplements; daily benefit amount; hospitalization history; budget.
- iul: retirement goals and time horizon; monthly contribution capacity; existing 401k/IRA/retirement accounts; family protection need; income; underwriting basics.
- other (carrier/admin/personal-work calls): keep it brief — summary and nextSteps only.

COACHING (in the call's language, 2–5 short actionable bullets for Isaac's next touch):
- final_expense: coach like a top FE producer — discovery depth, underwriting questions missed or done well, face amount vs budget, carrier fit, beneficiary clarity, trial close, appointment setting, referral ask, compliance (never guarantee approval).
- Other insurance lines: professional insurance sales coaching — rapport, qualification, compliance, urgency, next-touch plan.
- Non-sales/admin calls: brief efficiency or follow-up coaching only if useful.`;

function truncateTranscript(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[Transcript truncated for length]`;
}

export async function summarizeCallTranscript(
  input: CallSummaryInput,
  config: CallSummaryConfig,
  log: CallSummaryLogger = createCallSummaryLogger(config.debug)
): Promise<CallSummaryResult> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const transcript = truncateTranscript(input.transcript.trim(), config.maxTranscriptChars);
  if (!transcript) throw new Error("Empty transcript");

  log.step("OpenAI chat completion", {
    model: config.openaiModel,
    contactId: input.contactId,
    transcript: previewText(transcript, 200),
  });
  const t0 = Date.now();

  const durationLine =
    input.callDurationSeconds > 0
      ? `Duration: ~${Math.round(input.callDurationSeconds / 60)} min`
      : null;
  const statusLine = input.callStatus ? `Call status: ${input.callStatus}` : null;
  const userContent = [
    `Direction: ${input.direction}`,
    durationLine,
    statusLine,
    input.dateAdded ? `Date: ${input.dateAdded}` : null,
    `Contact ID: ${input.contactId}`,
    "",
    "Instructions:",
    "- Extract this work call into the JSON schema for CRM.",
    "- Match the transcript language exactly (Spanish call → all Spanish free-text values; English → all English).",
    "- Fill every schema field you have information for; omit unknown fields entirely.",
    "- Include coaching; prioritize final expense coaching when this is an FE call.",
    "",
    "Transcript:",
    transcript,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.3,
      max_tokens: config.openaiMaxOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  const raw = await res.text();
  log.elapsed("OpenAI chat completion", t0, { status: res.status, ok: res.ok });
  if (!res.ok) {
    log.error("OpenAI chat failed", { status: res.status, bodyPreview: raw.slice(0, 300) });
    throw new Error(`OpenAI chat failed (${res.status}): ${raw.slice(0, 500)}`);
  }

  let parsed: { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  const choice = parsed.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");
  if (choice?.finish_reason === "length") {
    log.warn("OpenAI output hit max_tokens; summary may be truncated", {
      maxTokens: config.openaiMaxOutputTokens,
    });
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error("OpenAI summary was not valid JSON");
  }

  const structured = normalizeStructuredSummary(data);
  const title = maskSensitiveNumbers(structured.title).slice(0, 120);
  const body = formatStructuredNote(structured);
  if (!body) throw new Error("OpenAI returned empty summary body");

  log.debug("OpenAI summary parsed", {
    title,
    lineOfBusiness: structured.lineOfBusiness,
    disposition: structured.disposition,
    language: structured.language,
    bodyLength: body.length,
    bodyPreview: previewText(body, 150),
  });

  return { title, body, structured };
}

export async function transcribeRecordingWithWhisper(
  recordingUrl: string,
  config: CallSummaryConfig,
  log: CallSummaryLogger = createCallSummaryLogger(config.debug)
): Promise<string> {
  const apiKey = config.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const urlHost = (() => {
    try {
      return new URL(recordingUrl).hostname;
    } catch {
      return "invalid-url";
    }
  })();

  log.step("Whisper: download recording", { urlLength: recordingUrl.length, urlHost });
  const downloadT0 = Date.now();

  const { getKixieCallSummaryConfig } = await import("@/lib/kixie-call-summary-config");
  const kixieConfig = getKixieCallSummaryConfig();

  const downloaded = isKixieRecordingHost(urlHost)
    ? await downloadKixieRecording(recordingUrl, kixieConfig, log)
    : await downloadRecordingUrl(recordingUrl, log);

  const buffer = downloaded.buffer;
  const contentType = downloaded.contentType;
  log.elapsed("Whisper: recording downloaded", downloadT0, {
    bytes: downloaded.byteLength,
    contentType,
    authMethod: downloaded.authMethod,
  });
  const ext = contentType.includes("wav")
    ? "wav"
    : contentType.includes("mp4") || contentType.includes("m4a")
      ? "m4a"
      : "mp3";

  const blob = new Blob([buffer], { type: contentType });
  const form = new FormData();
  form.append("file", blob, `recording.${ext}`);
  form.append("model", config.whisperModel);
  form.append("response_format", "text");

  log.step("Whisper: transcribe", { model: config.whisperModel, ext });
  const whisperT0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const text = await res.text();
  log.elapsed("Whisper: transcribe", whisperT0, { status: res.status, ok: res.ok });
  if (!res.ok) {
    log.error("Whisper failed", { status: res.status, bodyPreview: text.slice(0, 300) });
    throw new Error(`Whisper failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const trimmed = text.trim();
  log.debug("Whisper transcript", previewText(trimmed, 200));
  return trimmed;
}
