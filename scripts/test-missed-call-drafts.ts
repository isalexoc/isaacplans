/**
 * Test harness for the missed-call SMS/WhatsApp draft generator. Never posts CRM notes.
 *
 * Formatter-only (deterministic, no API calls):
 *   pnpm test:missed-call-drafts --formatter-only
 *
 * Live OpenAI run (needs OPENAI_API_KEY in .env), prints both drafts:
 *   pnpm test:missed-call-drafts en     (also: es)
 *
 * Dedup logic against the real DB (needs DATABASE_URL), cleans up after itself:
 *   pnpm test:missed-call-drafts --dedup-live
 */
import "dotenv/config";
import { formatMissedCallDraftNote } from "../lib/missed-call-drafts/note-format";
import { generateMissedCallDrafts } from "../lib/missed-call-drafts/openai";
import { getMissedCallDraftsConfig } from "../lib/missed-call-drafts/config";
import {
  claimMissedCallDraft,
  bumpMissedCallDraftAttempt,
  missedCallDraftKey,
} from "../lib/missed-call-drafts/store";
import { localCalendarDateKey } from "../lib/timezone";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

function assertCompliance(label: string, text: string, language: "en" | "es"): void {
  const bannedEn = /\b(insurance|insured|insurer|policy|premium|underwriting)\b/i;
  const bannedEs = /\bseguro\b/i;
  assert(!bannedEn.test(text), `${label}: contains a banned English word: ${text}`);
  if (language === "es") {
    assert(!bannedEs.test(text), `${label}: contains "seguro": ${text}`);
  }
}

function runFormatterOnly(): void {
  const note = formatMissedCallDraftNote(
    {
      sms: "Hi Maria, this is Isaac — tried reaching you about protecting your family's future. Call/text me back when you can.",
      whatsapp: "Hi Maria! 👋 This is Isaac — I tried calling about the plan we discussed for your family. Let me know a good time to talk!",
    },
    "en",
    { dateAdded: new Date().toISOString(), reason: "call_status_no-answer" }
  );
  assert(note.includes("📱"), "note missing SMS section header");
  assert(note.includes("💬"), "note missing WhatsApp section header");
  assert(note.includes("━━━━━━━━━━━━━━━"), "note missing separator");
  console.log(note);
  console.log("\n✓ formatMissedCallDraftNote assertions passed");
}

async function runDedupLive(): Promise<void> {
  const config = getMissedCallDraftsConfig();
  const dayKey = localCalendarDateKey(new Date(), config.timezone);
  const contactId = `test-dedup-${Date.now()}`;
  const draftKey = missedCallDraftKey(contactId, dayKey);

  const first = await claimMissedCallDraft({
    draftKey,
    contactId,
    locationId: "test-location",
    reason: "call_status_no-answer",
    source: "ghl",
  });
  assert(first.claimed === true, "first claim should succeed");

  const second = await claimMissedCallDraft({
    draftKey,
    contactId,
    locationId: "test-location",
    reason: "call_status_no-answer",
    source: "ghl",
  });
  assert(second.claimed === false, "second claim (same day) should NOT succeed — this is the triple-dial dedup");

  await bumpMissedCallDraftAttempt(draftKey);

  // Clean up the synthetic row.
  const { db } = await import("../lib/db");
  const { missedCallDrafts } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(missedCallDrafts).where(eq(missedCallDrafts.draftKey, draftKey));

  console.log("✓ dedup-live assertions passed (claim/reclaim/cleanup)");
}

async function runLiveFixture(language: "en" | "es"): Promise<void> {
  const config = getMissedCallDraftsConfig();
  if (!config.callSummary.openaiApiKey) {
    console.error("OPENAI_API_KEY is not set in .env — cannot run a live test.");
    process.exit(1);
  }

  const drafts = await generateMissedCallDrafts(
    {
      contactFirstName: language === "es" ? "Rosa" : "Robert",
      language,
      lineOfBusiness: "final_expense",
      priorContext: {
        summary:
          language === "es"
            ? "Se cotizó un plan de $10,000 con Aetna a $54.30 al mes."
            : "Quoted a $10,000 plan with Aetna at $54.30/mo.",
        policySummary: "Aetna — $10,000 — $54.30/mo",
      },
    },
    config
  );

  console.log(`\nSMS (${language}): ${drafts.sms}`);
  console.log(`WhatsApp (${language}): ${drafts.whatsapp}`);

  assertCompliance("sms", drafts.sms, language);
  assertCompliance("whatsapp", drafts.whatsapp, language);
  assert(drafts.sms.length <= 320, `sms too long (${drafts.sms.length} chars)`);
  const emojiCount = (drafts.whatsapp.match(EMOJI_REGEX) || []).length;
  assert(emojiCount <= 2, `whatsapp has too many emoji (${emojiCount})`);

  console.log(`\n✓ compliance + length assertions passed (${language})`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--formatter-only")) {
    runFormatterOnly();
    return;
  }
  if (args.includes("--dedup-live")) {
    await runDedupLive();
    return;
  }
  const lang = args[0] === "es" ? "es" : "en";
  await runLiveFixture(lang);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
