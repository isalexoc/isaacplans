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
  numberedDialogue,
  speakerLabel,
  windowTurns,
  windowTurnsWithIndex,
  wordsToTurns,
} from "../lib/call-study/dialogue";
import {
  MAX_MARKERS,
  buildStageTimeline,
  buildTimeMarkers,
  elapsedLabel,
  findAllOccurrences,
  findQuoteRange,
  formatClock,
  isBackchannel,
  pickMarkerInterval,
  splitByHighlights,
  type Stage,
} from "../lib/call-study/reading";
import {
  buildScanIndex,
  mergeScanIntoObjections,
  scanLanguageFor,
  scanText,
  scanTurns,
} from "../lib/call-study/objection-scan";
import { REDACTED_ENTITY_TYPES } from "../lib/call-study/config";
import {
  computeSignature,
  parseSignatureHeader,
  verifyElevenLabsSignature,
} from "../lib/call-study/webhook-signature";
import fixture from "./fixtures/scribe-sample.json";
import type { CallObjection, ScribeWord, Turn } from "../lib/call-study/types";

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

console.log("\nWindowing keeps absolute turn positions");
{
  const many: Turn[] = Array.from({ length: 60 }, (_, i) => ({
    speaker: i % 2 === 0 ? "agent" : "customer",
    text: "word ".repeat(20).trim(),
    start: i,
    end: i + 1,
  }));
  const windows = windowTurnsWithIndex(many, 2000);

  check("a long call splits into several windows", windows.length > 1, String(windows.length));
  check(
    "every window reports where it really begins",
    windows.every((w) => many[w.startIndex] === w.turns[0])
  );
  check(
    "windowTurns still returns exactly the turns",
    JSON.stringify(windowTurns(many, 2000)) === JSON.stringify(windows.map((w) => w.turns))
  );

  // The regression this replaces: numbering by `offset += window.length` counts each window's
  // overlap turns twice, so every phase and snippet in windows 2..n pointed at the wrong line.
  let naive = 0;
  const drifted = windows.map((w) => {
    const at = naive;
    naive += w.turns.length;
    return at;
  });
  check(
    "accumulating window lengths would have drifted",
    drifted.some((at, i) => at !== windows[i].startIndex)
  );
  check(
    "every turn in a window sits at startIndex + its position",
    windows.every((w) => w.turns.every((t, j) => t === many[w.startIndex + j]))
  );
  check(
    "the windows cover the whole call",
    windows[0].startIndex === 0 &&
      windows[windows.length - 1].startIndex + windows[windows.length - 1].turns.length === many.length
  );

  // A turn bigger than the whole budget closes a window on its own, so only ONE turn is carried
  // forward rather than the usual two. The start index must still land inside the array.
  const oversized: Turn[] = [
    { speaker: "agent", text: "x".repeat(5000), start: 0, end: 1 },
    ...many.slice(0, 3),
  ];
  check(
    "an oversized turn never yields a negative start index",
    windowTurnsWithIndex(oversized, 100).every((w) => w.startIndex >= 0 && w.turns[0] === oversized[w.startIndex])
  );
}

console.log("\nNumbering the dialogue for the model");
{
  const turns: Turn[] = [
    { speaker: "agent", text: "Hi, this is Will.", start: 0, end: 2 },
    // A newline inside one turn used to shift every number after it by one, for good.
    { speaker: "customer", text: "Dennis here.\nGo ahead.", start: 2, end: 4 },
    { speaker: "agent", text: "Great.", start: 4, end: 5 },
  ];

  const lines = numberedDialogue(turns, null).split("\n");
  check("one line per turn, whatever the text contains", lines.length === turns.length, String(lines.length));
  check(
    "line k is numbered k",
    lines.every((line, i) => line.startsWith(`[${i}] `))
  );
  check("a newline inside a turn becomes a space", lines[1] === "[1] Client: Dennis here. Go ahead.", lines[1]);
  check("the offset is the window's absolute start", numberedDialogue(turns, null, 48).startsWith("[48] "));
  check(
    "no line is blank",
    numberedDialogue([{ speaker: "agent", text: "a\n\nb", start: 0, end: 1 }], null).split("\n").length === 1
  );

  // The fixture is the real thing: line count must equal turn count on actual Scribe output.
  const real = wordsToTurns(fixture.words as ScribeWord[]);
  check(
    "line count equals turn count on the real fixture",
    numberedDialogue(real, null).split("\n").length === real.length
  );
}

console.log("\nStage timeline");
{
  const turns: Turn[] = Array.from({ length: 20 }, (_, i) => ({
    speaker: i % 2 === 0 ? "agent" : "customer",
    text: `line ${i}`,
    start: i * 10,
    end: i * 10 + 10,
  }));

  /** The invariant the whole reading view rests on: one stage per turn, no gaps, no overlaps. */
  const covers = (stages: Stage[]): boolean => {
    const seen = new Array<number>(turns.length).fill(0);
    for (const stage of stages) {
      for (let t = stage.startTurn; t <= stage.endTurn; t += 1) seen[t] += 1;
    }
    return seen.every((n) => n === 1);
  };

  check("no phases means no stages", buildStageTimeline([], turns).length === 0);
  check("a missing analysis means no stages", buildStageTimeline(null, turns).length === 0);
  check(
    "no turns means no stages",
    buildStageTimeline([{ phase: "opening", startTurn: 0, endTurn: 1 }], []).length === 0
  );

  const one = buildStageTimeline([{ phase: "opening", startTurn: 0, endTurn: 19 }], turns);
  check("one phase covers the whole call", one.length === 1 && one[0].endTurn === 19);
  check("stages carry real seconds", one[0].startSec === 0 && one[0].endSec === 200);

  const gap = buildStageTimeline(
    [
      { phase: "opening", startTurn: 0, endTurn: 4 },
      { phase: "discovery", startTurn: 9, endTurn: 12 },
    ],
    turns
  );
  check("a mid-call gap is absorbed by the previous stage", gap[0].endTurn === 8);
  check("the last stage runs to the end of the call", gap[gap.length - 1].endTurn === 19);
  check("every turn belongs to exactly one stage (gap)", covers(gap));

  const late = buildStageTimeline([{ phase: "discovery", startTurn: 6, endTurn: 19 }], turns);
  check("a gap at the start pulls the first stage back to turn 0", late[0].startTurn === 0);

  const overlap = buildStageTimeline(
    [
      { phase: "opening", startTurn: 0, endTurn: 10 },
      { phase: "discovery", startTurn: 5, endTurn: 15 },
    ],
    turns
  );
  check("an overlap never puts a turn in two stages", covers(overlap));
  // Equal spans, so the later-starting claim paints last and takes the disputed turns.
  check("the more specific claim wins the disputed region", overlap[1].startTurn === 5);

  // The case that matters most, and the one the first implementation of this silently destroyed:
  // the model returns a broad stage with a precise pocket inside it. Losing the pocket loses the
  // objection stretch, which is the whole reason to segment the call at all.
  const nested = buildStageTimeline(
    [
      { phase: "presentation", startTurn: 4, endTurn: 16 },
      { phase: "objection", startTurn: 9, endTurn: 11 },
    ],
    turns
  );
  check(
    "a pocket nested inside a broad stage survives",
    nested.length === 3 && nested[1].phase === "objection",
    nested.map((s) => `${s.phase}[${s.startTurn}-${s.endTurn}]`).join(" ")
  );
  check("the broad stage resumes after the pocket", nested[2].phase === "presentation");
  check("every turn belongs to exactly one stage (nested)", covers(nested));

  check(
    "no two neighbouring stages share a name",
    [gap, overlap, nested].every((stages) =>
      stages.every((s, i) => i === 0 || s.phase !== stages[i - 1].phase)
    )
  );

  const unordered = buildStageTimeline(
    [
      { phase: "close", startTurn: 15, endTurn: 19 },
      { phase: "opening", startTurn: 0, endTurn: 14 },
    ],
    turns
  );
  check("out-of-order phases are sorted", unordered[0].phase === "opening");
  check("every turn belongs to exactly one stage (unordered)", covers(unordered));

  const seam = buildStageTimeline(
    [
      { phase: "discovery", startTurn: 0, endTurn: 12 },
      { phase: "discovery", startTurn: 10, endTurn: 12 },
      { phase: "close", startTurn: 13, endTurn: 19 },
    ],
    turns
  );
  check("a window-seam repeat does not become its own stage", seam.length === 2, String(seam.length));

  const wild = buildStageTimeline(
    [
      { phase: "opening", startTurn: -5, endTurn: 3 },
      { phase: "close", startTurn: 18, endTurn: 900 },
    ],
    turns
  );
  check("indices outside the call are clamped", covers(wild) && wild[wild.length - 1].endTurn === 19);

  const reversed = buildStageTimeline([{ phase: "opening", startTurn: 12, endTurn: 4 }], turns);
  check("reversed bounds are swapped rather than dropped", reversed.length === 1);
}

console.log("\nTime markers");
{
  const call = (durationSeconds: number, turnCount: number): Turn[] =>
    Array.from({ length: turnCount }, (_, i) => ({
      speaker: i % 2 === 0 ? "agent" : "customer",
      text: `line ${i}`,
      start: (i * durationSeconds) / turnCount,
      end: ((i + 1) * durationSeconds) / turnCount,
    }));

  check("a 3-minute call marks every minute", pickMarkerInterval(180) === 60);
  check("a 40-minute call marks every 5 minutes", pickMarkerInterval(2400) === 300);
  check("a 2-hour call marks every 15 minutes", pickMarkerInterval(7200) === 900);

  for (const seconds of [180, 900, 2400, 7200, 12000]) {
    const markers = buildTimeMarkers(call(seconds, 400));
    check(
      `a ${seconds}s call stays under ${MAX_MARKERS} markers`,
      markers.length <= MAX_MARKERS,
      String(markers.length)
    );
  }

  check("no turns, no markers", buildTimeMarkers([]).length === 0);
  check("a call shorter than one interval gets no markers", buildTimeMarkers(call(30, 10)).length === 0);

  const forced = buildTimeMarkers(call(600, 200), { intervalSeconds: 60 });
  check("an explicit interval overrides the automatic one", forced.length === 9, String(forced.length));

  const markers = buildTimeMarkers(call(2400, 400));
  check("the first marker is labelled by elapsed time", markers[0].label === "5 min", markers[0]?.label);
  check("markers sit before a real turn", markers.every((m) => m.atTurn > 0 && m.atTurn < 400));
  check(
    "markers run forwards",
    markers.every((m, i) => i === 0 || m.seconds > markers[i - 1].seconds)
  );

  // One long monologue crossing several boundaries must not stack markers between two lines.
  const monologue: Turn[] = [
    { speaker: "agent", text: "a very long pitch", start: 0, end: 1500 },
    { speaker: "customer", text: "okay", start: 1500, end: 1505 },
  ];
  const jumped = buildTimeMarkers(monologue, { intervalSeconds: 300 });
  check("a boundary-jumping monologue yields one marker, not five", jumped.length === 1, String(jumped.length));
  check("that marker is labelled with the boundary actually reached", jumped[0].label === "25 min");
}

console.log("\nReading helpers");
{
  check("elapsed label under an hour", elapsedLabel(600) === "10 min");
  check("elapsed label on the hour", elapsedLabel(3600) === "1 hr");
  check("elapsed label past the hour", elapsedLabel(4500) === "1 hr 15 min");

  check("clock under an hour", formatClock(724) === "12:04", formatClock(724));
  check("clock past an hour", formatClock(4040) === "1:07:20", formatClock(4040));
  check("clock guards nonsense", formatClock(Number.NaN) === "0:00");

  check("mm-hm is backchannel", isBackchannel("Mm-hm."));
  check("okay is backchannel", isBackchannel("Okay"));
  check("an accented aja is backchannel", isBackchannel("Ajá"));
  check("a real answer is not backchannel", isBackchannel("I already have coverage") === false);
  check("an empty line is not backchannel", isBackchannel("   ") === false);
  check("a longer agreement is not backchannel", isBackchannel("yeah yeah yeah okay sure") === false);
  // Demoting a refusal to background noise would mute the most important word on the call.
  check("no is never backchannel", isBackchannel("No") === false);
  check("nunca is never backchannel", isBackchannel("Nunca") === false);
}

console.log("\nLocating a quote inside a turn");
{
  /** The whole contract: the range must slice back to real characters of the ORIGINAL text. */
  const sliced = (text: string, quote: string): string | null => {
    const range = findQuoteRange(text, quote);
    return range ? text.slice(range.start, range.end) : null;
  };

  const line = "Well, honestly? I can't afford that right now, not this month.";
  check("an exact phrase is found", sliced(line, "I can't afford that") === "I can't afford that");
  check(
    "punctuation differences do not stop a match",
    sliced(line, "i cant afford that") === "I can't afford that"
  );
  check("case differences do not stop a match", sliced(line, "WELL HONESTLY") === "Well, honestly");
  check(
    "a quote with extra whitespace still matches",
    sliced(line, "  not   this  month  ") === "not this month"
  );
  check("a quote that is not there returns null", findQuoteRange(line, "sounds great") === null);
  check("an empty quote returns null", findQuoteRange(line, "   ") === null);
  check("an empty text returns null", findQuoteRange("", "anything") === null);

  // Spanish, where the accents are exactly what nobody types back consistently.
  const spanish = "Necesito la cotización primero, ¿me entiende?";
  check("accents are folded away", sliced(spanish, "cotizacion primero") === "cotización primero");
  check("inverted punctuation is skipped", sliced(spanish, "me entiende") === "me entiende");

  // The range must never reach past the end of the string, whatever the folding did to lengths.
  const ranges = ["café", "naïve résumé", "a—b", "hola 😀 mundo"].map((t) => ({
    t,
    r: findQuoteRange(t, t),
  }));
  check(
    "a whole-string match stays inside the string",
    ranges.every(({ t, r }) => r !== null && r.start >= 0 && r.end <= t.length && r.start < r.end)
  );
  check(
    "a string containing an emoji does not break the offset map",
    sliced("hola 😀 mundo", "mundo") === "mundo"
  );

  // The highlight is only ever a wrapper: what is marked must be exactly what was said.
  const objectionLine = "Yeah no, my wife handles all that. I'd have to ask her first.";
  check(
    "the marked span is verbatim",
    sliced(objectionLine, "I'd have to ask her first") === "I'd have to ask her first"
  );
}

console.log("\nHighlighting never alters the text");
{
  const text = "I can't afford that right now, not this month.";
  const join = (segments: { text: string }[]) => segments.map((s) => s.text).join("");

  check("plain text with no highlights round-trips", join(splitByHighlights(text, [])) === text);
  check(
    "a highlighted text round-trips",
    join(splitByHighlights(text, [{ start: 2, end: 20, kind: "objection" }])) === text
  );
  check(
    "the highlighted run is the requested slice",
    splitByHighlights(text, [{ start: 2, end: 20, kind: "objection" }]).find((s) => s.kind)?.text ===
      text.slice(2, 20)
  );
  check(
    "overlapping highlights do not duplicate or drop characters",
    join(
      splitByHighlights(text, [
        { start: 2, end: 20, kind: "objection" },
        { start: 10, end: 30, kind: "search" },
      ])
    ) === text
  );
  check(
    "the first highlight wins an overlap, so priority is the caller's order",
    splitByHighlights(text, [
      { start: 2, end: 20, kind: "objection" },
      { start: 10, end: 30, kind: "search" },
    ]).filter((s) => s.kind).length === 1
  );
  check(
    "out-of-range highlights are clamped, not thrown",
    join(splitByHighlights(text, [{ start: -50, end: 9999, kind: "objection" }])) === text
  );
  check(
    "a zero-width or reversed highlight is ignored",
    splitByHighlights(text, [
      { start: 5, end: 5, kind: "objection" },
      { start: 9, end: 3, kind: "objection" },
    ]).every((s) => s.kind === null)
  );
  check(
    "unordered highlights still round-trip",
    join(
      splitByHighlights(text, [
        { start: 30, end: 40, kind: "search" },
        { start: 2, end: 8, kind: "objection" },
      ])
    ) === text
  );
  check("an empty string yields no segments", splitByHighlights("", [{ start: 0, end: 3, kind: "x" }]).length === 0);

  // The invariant, stated once more against every turn of the real fixture.
  const real = wordsToTurns(fixture.words as ScribeWord[]);
  check(
    "every real turn round-trips through highlighting",
    real.every((turn) => {
      const ranges = findAllOccurrences(turn.text, "the");
      return join(splitByHighlights(turn.text, ranges.map((r) => ({ ...r, kind: "search" })))) === turn.text;
    })
  );

  const hits = findAllOccurrences("the man saw the dog and THE cat", "the");
  check("search finds every occurrence, not just the first", hits.length === 3, String(hits.length));
  check(
    "search is case-insensitive but reports the real casing",
    hits.map((r) => "the man saw the dog and THE cat".slice(r.start, r.end)).join("|") === "the|the|THE"
  );
  check("search for nothing finds nothing", findAllOccurrences("anything", "   ").length === 0);
  check("search never overlaps itself", findAllOccurrences("aaaa", "aa").length === 2);
}

console.log("\nObjection scanning against the trigger library");
{
  // Triggers taken verbatim from the shipped corpus in scripts/migrate-objections-to-library.ts
  // and scripts/enrich-objection-triggers.ts.
  const objections = [
    { _id: "o-price", titleEn: "Can't afford it", objectionType: "price" as const, triggersEn: ["can't afford", "it's not in my budget"] },
    { _id: "o-shop", titleEn: "Just looking", objectionType: "other" as const, triggersEn: ["i'm just looking"] },
    { _id: "o-time", titleEn: "Call me back", objectionType: "timing" as const, triggersEn: ["call me back", "i didn't call"] },
    { _id: "o-kids", titleEn: "Talk to my kids", objectionType: "spouse" as const, triggersEn: ["talk to my kids"] },
  ];
  const index = buildScanIndex(objections, { language: "en" });
  const hits = (text: string) => scanText(index, text);
  const ids = (text: string) => hits(text).map((m) => m.objectionId).sort().join(",");

  check("the index compiled some triggers", index.triggers.length >= 6, String(index.triggers.length));

  // Genuine objections must fire.
  check("an exact phrase fires", ids("Well I can't afford it right now") === "o-price");
  check("filler between content words still fires", ids("I really can't even afford that") === "o-price");
  check("a trailing question mark does not block a match", ids("Can you just call me back tomorrow?") === "o-time");
  check("an exact phrase mid-sentence fires", ids("Honestly I'm just looking around.") === "o-shop");
  check("a budget phrasing fires", ids("It's not in my budget, sorry.") === "o-price");

  /* The false positives that made this worth writing at all.
   *
   * In lib/objections/live-match.ts an apostrophe becomes a SPACE, so "can't afford" compiles with
   * a bare "t" as a content token and these sentences match it. Live that costs one dismissed card;
   * offline, with the recency floor, cooldown and fire-once all gone, it would be a permanent wrong
   * row on a page whose whole value is being trusted. Folding the apostrophe away removes the
   * class entirely — each of these must find NOTHING. */
  check("'She's not worried about the budget' is not an objection", ids("She's not worried about the budget.") === "");
  check("'That's not really a budget problem' is not an objection", ids("That's not really a budget problem.") === "");
  check("'I don't need to decide right now' is not an objection", ids("I don't need to decide right now.") === "");
  check("'I'm still looking at the paperwork' is not an objection", ids("I'm still looking at the paperwork.") === "");
  check("'I didn't get your call' is not an objection", ids("I didn't get your call.") === "");
  check("ordinary chatter finds nothing", ids("We're just outside Waco, been here thirty years.") === "");

  // Order matters, which is what separates an objection from its mirror image.
  check("'my kids talk to me' is not 'talk to my kids'", ids("My kids talk to me about this stuff.") === "");

  const many = hits("I can't afford it. Honestly, I can't afford it at all.");
  check("every occurrence in a line is found, not just the first", many.length === 2, String(many.length));
  check("the matches do not overlap", many[0].range.end <= many[1].range.start);

  // The span must point at the real words, so the highlight lands on them.
  const line = "I mean, honestly? I can't afford that right now.";
  const match = hits(line)[0];
  check(
    "the matched range is the spoken phrase",
    line.slice(match.range.start, match.range.end) === "can't afford",
    line.slice(match.range.start, match.range.end)
  );
  check("the match carries the library id for the rebuttal", match.objectionId === "o-price");

  // Only what the client said is scanned.
  const speakerMap = {
    agent: { name: "Will", role: "agent" as const },
    customer: { name: "Dennis", role: "client" as const },
  };
  const convo: Turn[] = [
    { speaker: "agent", text: "So is it that you can't afford it, or something else?", start: 0, end: 4 },
    { speaker: "customer", text: "I can't afford it, no.", start: 4, end: 7 },
  ];
  const scanned = scanTurns(convo, speakerMap, index);
  check("the agent quoting an objection back is not counted", scanned.length === 1, String(scanned.length));
  check("the client's line is the one found", scanned[0].turnIndex === 1);

  // Merging with the model's own findings.
  const aiOnly: CallObjection[] = [
    {
      objection: "Cannot afford the premium",
      objectionType: "price",
      clientQuote: "I can't afford it",
      agentResponse: "Let's shape it around a budget.",
      resolved: true,
      turnIndex: 1,
      strength: "hard",
      source: "ai",
    },
  ];
  const merged = mergeScanIntoObjections(aiOnly, scanned, convo);
  check("a turn both detectors found stays one entry", merged.length === 1, String(merged.length));
  check("…marked as found by both", merged[0].source === "both");
  check("…keeping the model's wording", merged[0].objection === "Cannot afford the premium");
  check("…and gaining the library link", merged[0].libraryObjectionId === "o-price");

  const libraryOnly = mergeScanIntoObjections([], scanned, convo);
  check("a library-only find becomes its own entry", libraryOnly.length === 1);
  check("…marked soft, since a phrase match is not proof of intent", libraryOnly[0].strength === "soft");
  check("…quoting the client verbatim", libraryOnly[0].clientQuote === "can't afford");

  check("no triggers means no scan", scanTurns(convo, speakerMap, buildScanIndex([], { language: "en" })).length === 0);
  check("an unknown language scans both lists", scanLanguageFor(null) === "both");
  check("a Spanish call scans Spanish", scanLanguageFor("es-419") === "es");
  check("an English call scans English", scanLanguageFor("en") === "en");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
