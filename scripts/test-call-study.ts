/**
 * Offline checks for Call Study's dialogue conversion.
 *
 * The word-stream-to-dialogue step is the whole deliverable, and its failure modes are quiet:
 * a turn attributed to the wrong speaker, a line silently dropped, or a talk ratio that looks
 * plausible and is wrong. All of it is pure, so all of it is pinned down here.
 *
 * Includes a fixture captured from a real ElevenLabs Scribe response.
 *
 * No network, no database, no API keys. Run with: pnpm test:call-study
 */

import {
  computeMetrics,
  defaultSpeakerMap,
  renderDialogue,
  speakerLabel,
  windowTurns,
  wordsToTurns,
} from "../lib/call-study/dialogue";
import { REDACTED_ENTITY_TYPES } from "../lib/call-study/config";
import {
  computeSignature,
  parseSignatureHeader,
  verifyElevenLabsSignature,
} from "../lib/call-study/webhook-signature";
import fixture from "./fixtures/scribe-sample.json";
import type { ScribeWord, Turn } from "../lib/call-study/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Terse word-stream builder: ("agent", "Hello there", 0, 1) → two word entries. */
function say(speaker: string, text: string, start: number, end: number): ScribeWord[] {
  const parts = text.split(" ");
  const step = (end - start) / parts.length;
  const out: ScribeWord[] = [];
  parts.forEach((p, i) => {
    out.push({
      text: p,
      type: "word",
      speaker_id: speaker,
      start: start + i * step,
      end: start + (i + 1) * step,
    });
    if (i < parts.length - 1) out.push({ text: " ", type: "spacing", speaker_id: speaker });
  });
  return out;
}

console.log("\nTurn grouping");
{
  const words = [...say("agent", "Hello there", 0, 1), ...say("customer", "Hi yes", 1, 2)];
  const turns = wordsToTurns(words);
  check("two speakers make two turns", turns.length === 2, String(turns.length));
  check("text joins without the spacing entries", turns[0].text === "Hello there", turns[0].text);
  check("turn carries its timings", turns[0].start === 0 && turns[1].end === 2);

  // A backchannel splits the agent in two. Faithful, and deliberately not merged.
  const interrupted = wordsToTurns([
    ...say("agent", "So the policy builds", 0, 2),
    ...say("customer", "mm hm", 2, 2.4),
    ...say("agent", "cash value over time", 2.4, 4),
  ]);
  check("an interruption produces three turns, not two", interrupted.length === 3, String(interrupted.length));
  check("the resumed turn is its own line", interrupted[2].text === "cash value over time");

  const same = wordsToTurns([...say("agent", "One two", 0, 1), ...say("agent", "three four", 1, 2)]);
  check("consecutive same-speaker words stay one turn", same.length === 1, String(same.length));
  check("merged turn spans both", same[0].start === 0 && same[0].end === 2);

  check("empty input gives no turns", wordsToTurns([]).length === 0);
  check("null input gives no turns", wordsToTurns(null).length === 0);
  check("undefined input gives no turns", wordsToTurns(undefined).length === 0);

  // Spacing must never start a turn — a stray attribution on a space would split a line in half.
  const strayspace = wordsToTurns([
    ...say("agent", "Hello", 0, 1),
    { text: " ", type: "spacing", speaker_id: "customer" },
    ...say("agent", "again", 1, 2),
  ]);
  check("a spacing entry cannot split a turn", strayspace.length === 1, String(strayspace.length));

  const events = [
    ...say("agent", "That is funny", 0, 1),
    { text: "(laughter)", type: "audio_event" as const, speaker_id: "agent", start: 1, end: 1.5 },
  ];
  check("audio events are dropped by default", wordsToTurns(events)[0].text === "That is funny");
  check(
    "audio events can be kept",
    wordsToTurns(events, { includeAudioEvents: true })[0].text.includes("(laughter)")
  );

  const unattributed = wordsToTurns([{ text: "Hello", type: "word", start: 0, end: 1 }]);
  check("a word with no speaker still becomes a turn", unattributed.length === 1);
  check("…labelled unknown", unattributed[0].speaker === "unknown", unattributed[0].speaker);

  const noTimes = wordsToTurns([{ text: "Hello", type: "word", speaker_id: "agent" }]);
  check("missing timestamps do not produce NaN", Number.isFinite(noTimes[0].start) && Number.isFinite(noTimes[0].end));
}

console.log("\nSpeaker labels and rendering");
{
  check("agent role reads as Agent", speakerLabel("agent", null) === "Agent");
  check("customer role reads as Client", speakerLabel("customer", null) === "Client");
  check("speaker_0 becomes 1-based", speakerLabel("speaker_0", null) === "Speaker 1");
  check("speaker_1 becomes 1-based", speakerLabel("speaker_1", null) === "Speaker 2");
  check("a mapped name wins", speakerLabel("agent", { agent: { name: "Will", role: "agent" } }) === "Will");
  check(
    "a blank mapped name falls back rather than rendering an empty label",
    speakerLabel("agent", { agent: { name: "   ", role: "agent" } }) === "Agent"
  );

  const turns: Turn[] = [
    { speaker: "agent", text: "Hello", start: 0, end: 1 },
    { speaker: "customer", text: "Hi there", start: 1, end: 2 },
  ];
  const map = { agent: { name: "Will", role: "agent" as const }, customer: { name: "Dennis", role: "client" as const } };

  const plain = renderDialogue(turns, map);
  check("renders Name: text", plain.split("\n")[0] === "Will: Hello", plain.split("\n")[0]);
  check("one line per turn", plain.split("\n").length === 2);

  const aligned = renderDialogue(turns, map, { align: true });
  const [l1, l2] = aligned.split("\n");
  check(
    "aligned mode lines the text up in a column",
    l1.indexOf("Hello") === l2.indexOf("Hi there"),
    JSON.stringify([l1, l2])
  );

  check("no timestamps leak into the output", !/\d+\.\d+/.test(plain) && !plain.includes("-->"));
  check("empty turns render as empty string", renderDialogue([], map) === "");
  check(
    "blank-line mode separates turns",
    renderDialogue(turns, map, { blankLineBetweenTurns: true }).includes("\n\n")
  );
}

console.log("\nMetrics");
{
  // 7s agent, 3s client — a deliberately lopsided call.
  const turns: Turn[] = [
    { speaker: "agent", text: "a b c", start: 0, end: 7 },
    { speaker: "customer", text: "d e", start: 7, end: 10 },
  ];
  const m = computeMetrics(turns);
  check("total speaking time adds up", m.totalSpeakingSeconds === 10, String(m.totalSpeakingSeconds));
  check("talk ratio is 70/30", Math.round(m.talkRatio.agent * 100) === 70 && Math.round(m.talkRatio.customer * 100) === 30);
  check("longest monologue found", m.longestMonologueSeconds === 7 && m.longestMonologueSpeaker === "agent");
  check("word counts per speaker", m.bySpeaker.agent.words === 3 && m.bySpeaker.customer.words === 2);
  check("turn counts per speaker", m.bySpeaker.agent.turns === 1);

  const empty = computeMetrics([]);
  check("empty call does not divide by zero", empty.totalSpeakingSeconds === 0 && empty.longestMonologueSpeaker === null);

  const reversed = computeMetrics([{ speaker: "agent", text: "x", start: 5, end: 1 }]);
  check("a backwards turn contributes zero, not a negative", reversed.totalSpeakingSeconds === 0);
}

console.log("\nWindowing for long calls");
{
  const many: Turn[] = Array.from({ length: 60 }, (_, i) => ({
    speaker: i % 2 === 0 ? "agent" : "customer",
    text: "word ".repeat(20).trim(),
    start: i,
    end: i + 1,
  }));
  const windows = windowTurns(many, 2000);
  check("a long call splits into several windows", windows.length > 1, String(windows.length));
  check("every turn appears somewhere", windows.flat().length >= many.length);
  check("windows overlap so an exchange is not cut in half", windows[1][0] === windows[0][windows[0].length - 2]);
  check("a short call stays a single window", windowTurns(many.slice(0, 2), 100000).length === 1);
  check("no turns, no windows", windowTurns([], 1000).length === 0);
}

console.log("\nRedaction policy");
{
  const set = new Set<string>(REDACTED_ENTITY_TYPES);
  check("redacts SSN", set.has("ssn"));
  check("redacts card numbers", set.has("credit_card"));
  check("redacts bank and routing numbers", set.has("bank_account") && set.has("routing_number"));
  // These two are the reason the narrow list exists at all.
  check("does NOT redact names — the dialogue depends on them", !set.has("name") && !set.has("name_given"));
  check("does NOT redact money — premiums are the point of the call", !set.has("money"));
  check("does NOT redact age — it is underwriting substance", !set.has("age"));
}

console.log("\nReal Scribe response (captured fixture)");
{
  const turns = wordsToTurns(fixture.words as ScribeWord[]);
  check("five turns from the real five-line call", turns.length === 5, String(turns.length));
  check("roles came back as agent/customer", turns[0].speaker === "agent" && turns[1].speaker === "customer");
  check("names survived redaction", turns[0].text.includes("Will") && turns[1].text.includes("Dennis"));
  check("the SSN did not", turns[1].text.includes("{SSN_0}") && !turns[1].text.includes("6789"));
  check("nor did the card number", turns[1].text.includes("{CREDIT_CARD_0}") && !turns[1].text.includes("4111"));

  const rendered = renderDialogue(
    turns,
    { agent: { name: "Will", role: "agent" }, customer: { name: "Dennis", role: "client" } },
    { align: true }
  );
  check("renders as the dialogue Isaac asked for", rendered.startsWith("Will:   Hi, this is Will"), rendered.slice(0, 40));
  check("the client's lines are labelled Dennis", rendered.includes("Dennis: Yes, this is Dennis"));

  const seeded = defaultSpeakerMap(turns);
  check("default map seeds both speakers", Object.keys(seeded).length === 2);
  check("…with the right roles", seeded.agent.role === "agent" && seeded.customer.role === "client");
}

console.log("");
console.log("Webhook signature");
{
  const SECRET = "wsec_test_secret";
  const bodyText = JSON.stringify({ type: "speech_to_text_transcription", data: { request_id: "abc" } });
  const now = 1_800_000_000;
  const ts = String(now);
  const good = "t=" + ts + ",v0=" + computeSignature(ts, bodyText, SECRET);
  const ok = (header: string | null, opts: { rawBody?: string; secret?: string; nowSeconds?: number } = {}) =>
    verifyElevenLabsSignature({
      rawBody: opts.rawBody ?? bodyText,
      header,
      secret: opts.secret ?? SECRET,
      nowSeconds: opts.nowSeconds ?? now,
    });

  check("parses t and v0 out of the header", parseSignatureHeader(good)?.timestamp === ts);
  check("a valid signature is accepted", ok(good));
  check("a tampered body is rejected", ok(good, { rawBody: bodyText + " " }) === false);
  check("the wrong secret is rejected", ok(good, { secret: "wsec_other" }) === false);
  check("a missing header is rejected", ok(null) === false);
  check("an empty header is rejected", ok("") === false);
  check("garbage in the header is rejected", ok("not-a-signature") === false);
  check("a header with no v0 is rejected", ok("t=" + ts) === false);
  check("a header with no t is rejected", ok("v0=" + computeSignature(ts, bodyText, SECRET)) === false);
  check("a non-numeric timestamp is rejected", ok("t=abc,v0=" + computeSignature("abc", bodyText, SECRET)) === false);
  check("an empty secret is rejected", ok(good, { secret: "" }) === false);

  check("a stale payload is rejected", ok(good, { nowSeconds: now + 31 * 60 }) === false);
  check("a payload inside the window is accepted", ok(good, { nowSeconds: now + 29 * 60 }));
  check("a far-future payload is rejected", ok(good, { nowSeconds: now - 31 * 60 }) === false);

  // The timestamp is part of the signed material, so editing it breaks the signature rather than
  // extending the replay window.
  const moved = String(now + 20 * 60);
  check(
    "the timestamp cannot be edited to refresh the window",
    ok("t=" + moved + ",v0=" + computeSignature(ts, bodyText, SECRET), { nowSeconds: now + 20 * 60 }) === false
  );

  // A length mismatch must return false, not throw out of timingSafeEqual.
  let threw = false;
  try {
    ok("t=" + ts + ",v0=abc");
  } catch {
    threw = true;
  }
  check("a short signature returns false rather than throwing", !threw);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
