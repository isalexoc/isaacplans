/**
 * Pins the A-roll edit rules.
 *
 * The cutaway director's output is never trusted — `planCutaways` clamps, snaps, de-overlaps and
 * re-slices it. This checks that against deliberately awful input, because the failure mode it
 * guards against is expensive and quiet: a bad window renders a cutaway over the CTA, or a
 * quarter-second flicker, and you only find out after paying for the Veo clips and the render.
 *
 * Pure functions only — no API keys, no network, no spend.
 *
 *   pnpm test:aroll
 */
import "dotenv/config";
import {
  planCutaways,
  evenlySpacedBeats,
  snapToGap,
  targetCutawayCount,
} from "../lib/social-media-studio/aroll-director";
import {
  HOOK_HOLD_SEC,
  CTA_HOLD_SEC,
  MIN_CUTAWAY_SEC,
  MAX_CUTAWAY_SEC,
  MIN_GAP_SEC,
  MAX_COVERAGE,
  publicIdFromUrl,
  arollDeliveryUrl,
  arollAudioUrl,
  arollLengthProblem,
  needsCrop,
} from "../lib/social-media-studio/aroll";
import { wordsToSegments, wordsInWindow, timedWords } from "../lib/social-media-studio/aroll-words";
import { buildTimeline } from "../lib/social-media-studio/render/shotstack";
import type { RenderPlan } from "../lib/social-media-studio/render/types";
import type { ScribeWord } from "../lib/call-study/types";

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ── A 42s take, one word every 0.4s with a real pause after every eighth ───────────
const DURATION = 42;
const words: ScribeWord[] = [];
{
  let t = 0;
  for (let i = 0; i < 100; i++) {
    words.push({ text: `w${i}`, start: t, end: t + 0.3, type: "word" });
    t += i % 8 === 7 ? 0.6 : 0.4; // a longer gap every eighth word = a breath
  }
}
const timed = timedWords(words);

section("planCutaways — hostile director output");
{
  const raw = [
    { startSec: 0.0,  endSec: 3.0,  imageConcept: "starts before the hook hold" },
    { startSec: 5.0,  endSec: 5.4,  imageConcept: "far too short" },
    { startSec: 8.0,  endSec: 24.0, imageConcept: "far too long" },
    { startSec: 9.0,  endSec: 12.0, imageConcept: "overlaps the one before it" },
    { startSec: 30.0, endSec: 34.0, imageConcept: "fine" },
    { startSec: 40.0, endSec: 41.9, imageConcept: "runs into the CTA" },
    { startSec: 20.0, endSec: 15.0, imageConcept: "backwards" },
    { startSec: NaN,  endSec: 12.0, imageConcept: "not a number" },
  ];
  const beats = planCutaways(raw, timed, DURATION);
  const ceiling = DURATION - CTA_HOLD_SEC;

  check("returns at least one usable beat", beats.length > 0, `got ${beats.length}`);
  check(
    "never opens before the hook hold",
    beats.every((b) => b.startSec >= HOOK_HOLD_SEC - 1e-6),
    JSON.stringify(beats.map((b) => b.startSec)),
  );
  check(
    "never runs into the closing CTA",
    beats.every((b) => b.endSec <= ceiling + 1e-6),
    JSON.stringify(beats.map((b) => b.endSec)),
  );
  check(
    "every beat is between the min and max shot length",
    beats.every((b) => {
      const len = b.endSec - b.startSec;
      return len >= MIN_CUTAWAY_SEC - 1e-6 && len <= MAX_CUTAWAY_SEC + 1e-6;
    }),
    JSON.stringify(beats.map((b) => +(b.endSec - b.startSec).toFixed(2))),
  );
  check(
    "beats are in order and never overlap",
    beats.every((b, i) => i === 0 || b.startSec >= beats[i - 1].endSec - 1e-6),
  );
  check(
    "he is on screen for at least the minimum gap between cutaways",
    beats.every((b, i) => i === 0 || b.startSec - beats[i - 1].endSec >= MIN_GAP_SEC - 1e-6),
  );
  const coverage = beats.reduce((n, b) => n + (b.endSec - b.startSec), 0);
  check(
    "the story never covers more than the allowed share of the ad",
    coverage <= DURATION * MAX_COVERAGE + 1e-6,
    `${coverage.toFixed(1)}s of ${DURATION}s`,
  );
  check(
    "each beat carries the words actually spoken under it",
    beats.every((b) => b.narration === wordsInWindow(timed, b.startSec, b.endSec)),
  );
  check(
    "a beat with no concept still gets one",
    beats.every((b) => b.imageConcept.trim().length > 0),
  );
}

section("planCutaways — degenerate input");
{
  check("empty input yields no beats", planCutaways([], timed, DURATION).length === 0);
  check(
    "a take too short to cut away from yields no beats",
    planCutaways(
      [{ startSec: 1, endSec: 4, imageConcept: "x" }],
      timed,
      HOOK_HOLD_SEC + CTA_HOLD_SEC + 1,
    ).length === 0,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  check("junk input does not throw", planCutaways([{} as any, null as any], timed, DURATION).length === 0);
}

section("snapToGap");
{
  // 3.0s sits mid-word; the nearest real breath is the longer gap after w7 (3.0 → 3.6).
  const snapped = snapToGap(3.2, timed);
  check("moves a cut onto a nearby breath", snapped !== 3.2, `stayed at ${snapped}`);
  check("never moves a cut far", Math.abs(snapped - 3.2) <= 0.45 + 1e-6, `moved to ${snapped}`);
  check("leaves a time with no breath nearby alone", snapToGap(200, timed) === 200);
  check("copes with no words at all", snapToGap(5, []) === 5);
}

section("evenlySpacedBeats — the fallback still obeys the rules");
{
  const beats = evenlySpacedBeats(DURATION, timed);
  const ceiling = DURATION - CTA_HOLD_SEC;
  check("produces beats", beats.length > 0, `got ${beats.length}`);
  check("respects the open and close holds", beats.every((b) => b.startSec >= HOOK_HOLD_SEC && b.endSec <= ceiling + 1e-6));
  check("respects the shot length bounds", beats.every((b) => {
    const len = b.endSec - b.startSec;
    return len >= MIN_CUTAWAY_SEC - 1e-6 && len <= MAX_CUTAWAY_SEC + 1e-6;
  }));
  check("never overlaps", beats.every((b, i) => i === 0 || b.startSec >= beats[i - 1].endSec - 1e-6));
  check(
    "leaves him on screen between cutaways",
    beats.every((b, i) => i === 0 || b.startSec - beats[i - 1].endSec >= MIN_GAP_SEC - 1e-6),
  );
  check("uses no cast reference (safe, people-free concepts)", beats.every((b) => b.includesCast === false));
  check("a take too short to cut yields nothing", evenlySpacedBeats(6, timed).length === 0);
}

section("targetCutawayCount");
{
  check("a 20s ad gets a couple of cutaways", targetCutawayCount(20) === 3, String(targetCutawayCount(20)));
  check("never fewer than two", targetCutawayCount(8) >= 2);
  check("never more than eight", targetCutawayCount(600) === 8);
}

section("wordsToSegments");
{
  const spoken: ScribeWord[] = [
    { text: "Hola,", start: 0.0, end: 0.4, type: "word" },
    { text: "soy", start: 0.5, end: 0.7, type: "word" },
    { text: "Isaac.", start: 0.8, end: 1.4, type: "word" },
    { text: "Hoy", start: 2.0, end: 2.3, type: "word" },
    { text: "hablamos", start: 2.4, end: 3.0, type: "word" },
    { text: "de", start: 3.1, end: 3.2, type: "word" },
    { text: "retiro.", start: 3.3, end: 3.9, type: "word" },
  ];
  const segments = wordsToSegments(spoken);
  check("splits on sentence endings", segments.length === 2, JSON.stringify(segments.map((s) => s.text)));
  check("keeps every word, in order", segments.map((s) => s.text).join(" ") === "Hola, soy Isaac. Hoy hablamos de retiro.");
  check("carries real timings", segments[0].start === 0 && Math.abs(segments[1].end - 3.9) < 1e-6);
  check("ignores spacing entries", wordsToSegments([{ text: " ", type: "spacing" }]).length === 0);
}

section("Cloudinary URL helpers");
{
  const cloud = "isaacdev";
  check(
    "reads a public id past a version",
    publicIdFromUrl(`https://res.cloudinary.com/${cloud}/video/upload/v1788799244/social-media/presenter/take.mp4`) ===
      "social-media/presenter/take",
  );
  check(
    "reads a public id past a transformation",
    publicIdFromUrl(`https://res.cloudinary.com/${cloud}/video/upload/c_fill,ar_9:16,g_auto/v123/folder/take.mp4`) ===
      "folder/take",
  );
  check(
    "keeps folders that merely look like transformations",
    publicIdFromUrl(`https://res.cloudinary.com/${cloud}/video/upload/social-media/presenter/take.mp4`) ===
      "social-media/presenter/take",
  );
  check("refuses a non-Cloudinary URL", publicIdFromUrl("https://example.com/video.mp4") === null);

  const portrait = arollDeliveryUrl("take", { width: 1080, height: 1920, cloudName: cloud });
  const landscape = arollDeliveryUrl("take", { width: 1920, height: 1080, cloudName: cloud });
  check("a portrait take is not cropped", portrait.includes("c_limit,w_1080") && !portrait.includes("ar_9:16"));
  check("a landscape take is cropped around the subject", landscape.includes("c_fill,ar_9:16,g_auto"));
  check("both are pinned to h264", portrait.includes("vc_h264") && landscape.includes("vc_h264"));
  check("the audio track is the mp3 rendition", arollAudioUrl("take", cloud).endsWith("/ac_mp3/take.mp3"));
  check("landscape is detected", needsCrop(1920, 1080) && !needsCrop(1080, 1920) && !needsCrop());
}

section("length limits");
{
  check("a 4s clip is refused", Boolean(arollLengthProblem(4)));
  check("a 40s clip is fine", arollLengthProblem(40) === null);
  check("a 5 minute clip is refused", Boolean(arollLengthProblem(300)));
  check("an unreadable length is refused", Boolean(arollLengthProblem(0)));
}


section("Shotstack timeline — the A-roll edit");
{
  const plan: RenderPlan = {
    width: 1080, height: 1920, fps: 30,
    durationSec: 41.95,
    scenes: [
      { backgroundUrl: "https://cdn/clip1.mp4",  isVideo: true,  start: 5.1,  length: 4.3, transition: true },
      { backgroundUrl: "https://cdn/still2.png", isVideo: false, start: 14.2, length: 3.9, transition: true },
    ],
    aRoll: {
      src:      "https://cdn/take.mp4",
      audioSrc: "https://cdn/take.mp3",
      start: 0, length: 41.95,
    },
    textCards: [
      { text: "TU DINERO PUEDE CRECER", start: 0,     length: 4,   style: "hook",   placement: "top" },
      { text: "El Dinero Que No Crece", start: 5.3,   length: 3.5, style: "kicker", placement: "top" },
      { text: "ASESORIA GRATUITA",      start: 38.95, length: 3,   style: "cta",    placement: "middle" },
    ],
    musicUrl: "https://cdn/music.mp3",
    musicVolume: 0.08,
    captions: true,
    captionPlacement: "bottom",
  };

  const timeline = buildTimeline(plan);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracks = timeline.tracks as { clips: any[] }[];
  const types = tracks.map((t) => t.clips[0]?.asset?.type);

  check("has all six tracks", tracks.length === 6, JSON.stringify(types));
  check(
    "stacks cards over captions over cutaways over the take",
    types.join(",") === "rich-text,rich-caption,video,video,audio,audio",
    types.join(","),
  );

  const aRollClip = tracks[3].clips[0];
  const speechClip = tracks[4].clips[0];
  const cutaways = tracks[2].clips;

  check("the take fills the frame", aRollClip.fit === "cover");
  check("the take runs the whole video from zero", aRollClip.start === 0 && aRollClip.length === 41.95);
  check("the take is MUTED — its audio is a separate track", aRollClip.asset.volume === 0);
  check("the take has no transition of its own", aRollClip.transition === undefined);

  check(
    "the speech track is the audio rendition, at full volume",
    speechClip.asset.src === "https://cdn/take.mp3" && speechClip.asset.volume === 1,
  );
  check("the speech track carries the caption alias", speechClip.alias === "speech");
  check("the speech track spans the whole video", speechClip.start === 0 && speechClip.length === 41.95);
  check(
    "nothing else claims the alias",
    tracks.flatMap((t) => t.clips).filter((c) => c.alias === "speech").length === 1,
  );

  check("captions transcribe the speech track", tracks[1].clips[0].asset.src === "alias://speech");
  check("captions sit at the bottom under a full-frame presenter", tracks[1].clips[0].asset.align.vertical === "bottom");

  check("every cutaway is silent", cutaways.every((c) => c.asset.type !== "video" || c.asset.volume === 0));
  check(
    "every cutaway dissolves in and out",
    cutaways.every((c) => c.transition?.in === "fade" && c.transition?.out === "fade"),
  );
  check("cutaways sit where the director put them", cutaways[0].start === 5.1 && cutaways[0].length === 4.3);
  check(
    "a still cutaway gets Ken Burns, a moving one does not",
    Boolean(cutaways[1].effect) && cutaways[1].asset.type === "image" && cutaways[0].effect === undefined,
  );

  check(
    "music is bounded to the video and ducked under a real voice",
    tracks[5].clips[0].length === 41.95 && tracks[5].clips[0].asset.volume === 0.08,
  );

  const cards = tracks[0].clips;
  check("the hook holds only until the first cutaway", cards[0].length === 4 && cards[0].start === 0);
  check("the CTA lands in the closing window", cards[2].start === 38.95);
  check("only the CTA gets a filled plate", !cards[0].asset.background && Boolean(cards[2].asset.background));
  check("cards use the rich-text asset", cards.every((c) => c.asset.type === "rich-text"));

  const endsAt = (c: { start: number; length: number | string }) =>
    typeof c.length === "number" ? c.start + c.length : 0;
  check(
    "no clip runs past the end of the take",
    tracks.flatMap((t) => t.clips).every((c) => endsAt(c) <= 41.95 + 1e-6),
  );
}

section("Shotstack timeline — the faceless path is untouched");
{
  const plan: RenderPlan = {
    width: 1080, height: 1920, fps: 30,
    durationSec: 30,
    scenes: [{ backgroundUrl: "https://cdn/a.png", isVideo: false, start: 0, length: 30 }],
    narrationAudio: { src: "https://cdn/vo.mp3", start: 0, length: 30 },
    musicUrl: "https://cdn/music.mp3",
    captions: true,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracks = buildTimeline(plan).tracks as { clips: any[] }[];
  const types = tracks.map((t) => t.clips[0]?.asset?.type);
  check(
    "still captions then narration then scenes then music",
    types.join(",") === "rich-caption,audio,image,audio",
    types.join(","),
  );
  check("narration still carries the alias", tracks[1].clips[0].alias === "speech");
  check("music still sits at its original level", tracks[3].clips[0].asset.volume === 0.12);
}

console.log(failures === 0 ? "\nAll A-roll edit rules hold.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
