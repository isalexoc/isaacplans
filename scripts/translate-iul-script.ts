/**
 * English version of the IUL sales script, built from the Spanish one Isaac wrote in Studio.
 *
 * Covers every Spanish field that has no English yet: the script's rich-text sections (Complete
 * Script, Objection Handling, ...) and the IUL objection cards (title, answer, live-listener
 * triggers). Spanish is never written to — only the English twin of each field.
 *
 * Why the English is a separate text file and not a GPT call in here: the translation is written
 * and reviewed by hand (Claude, in session), and this script is the gate it has to pass. It checks
 * that every block keeps its style, its formatting marks, its line breaks and its fill-in blanks,
 * so the English reads on the same screen layout Isaac already knows in Spanish.
 *
 * The working files live in scripts/data/private/ (gitignored): the repo is public and the script
 * carries Isaac's phone number, NPN and sales playbook.
 *
 * Authoring format (source.es.txt / en/*.txt) — one unit per `@@ <id>` header, text below it:
 *   <b> strong  <i> em  <u> underline  <hl> Emphasize  <good> Good news  <bad> Careful  <fill> Fill in
 * Leading/trailing blank lines of a unit don't matter (the Spanish block's own are reused); the
 * line breaks INSIDE a unit must match the Spanish one for one. Triggers: one phrase per line.
 *
 * Run: pnpm translate:iul-script export          read-only snapshot of the Spanish
 *      pnpm translate:iul-script check           validate en/*.txt against the snapshot
 *      pnpm translate:iul-script apply --dry-run everything apply does, minus the write
 *      pnpm translate:iul-script apply           write the English (refuses to overwrite real
 *                                                English content unless --force)
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "next-sanity";
import { normalizeSpokenText } from "@/lib/objections/live-match";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
  // Drafts are invisible to the default published perspective, and a draft is exactly the case
  // that must stop a write (publishing it later would put the placeholder English back).
  perspective: "raw",
});

const LOB = "iul";
const DATA_DIR = path.join(process.cwd(), "scripts", "data", "private", "iul-script-en");
const EN_DIR = path.join(DATA_DIR, "en");
const SNAPSHOT_FILE = path.join(DATA_DIR, "source.json");
const SOURCE_TEXT_FILE = path.join(DATA_DIR, "source.es.txt");
const PROTECTED_FILE = path.join(DATA_DIR, "protected.json");

const SECTIONS = [
  "completeScript",
  "openingIntroduction",
  "discoveryQuestions",
  "productPresentation",
  "closingTechniques",
  "objectionHandling",
  "psychologySalesTips",
] as const;
const SECTION_PAIRS = [
  ["contentEs", "contentEn"],
  ["tipsEs", "tipsEn"],
] as const;

/** Decorator → tag. Order is the canonical nesting order (outermost first). */
const TAGS: Record<string, string> = {
  strong: "b",
  em: "i",
  underline: "u",
  highlight: "hl",
  highlightGood: "good",
  highlightCareful: "bad",
  fill: "fill",
};
const MARK_OF_TAG = Object.fromEntries(Object.entries(TAGS).map(([mark, tag]) => [tag, mark]));
const MARK_ORDER = Object.keys(TAGS);
const TAG_RE = new RegExp(`<(/?)(${Object.values(TAGS).join("|")})>`, "g");

/**
 * Must survive translation verbatim wherever the Spanish has them. Personal identifiers (the NPN)
 * are read from the gitignored protected.json beside the snapshot, never written here, because the
 * repo is public.
 */
const PROTECTED = [
  "540-681-3507",
  "Isaac Orraiz",
  "S&P 500",
  ...(existsSync(PROTECTED_FILE) ? (JSON.parse(readFileSync(PROTECTED_FILE, "utf8")) as string[]) : []),
];

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

type Span = { _key?: string; _type?: string; text: string; marks?: string[] };
type Block = {
  _key: string;
  _type: "block";
  style?: string;
  listItem?: string;
  level?: number;
  markDefs?: unknown[];
  children?: Span[];
};
type Item = { _key: string; _type: string; [field: string]: unknown };

type BlockUnit = {
  id: string;
  kind: "block";
  style: string;
  listItem?: string;
  level?: number;
  lead: string;
  trail: string;
  core: string;
  hash: string;
};
/** Whitespace-only blocks and images: reproduced as they are, nothing to translate. */
type CopyUnit = { id: string; kind: "copy"; item: Item; hash: string };
type TitleUnit = { id: string; kind: "title"; text: string; hash: string };
type TriggersUnit = { id: string; kind: "triggers"; phrases: string[]; hash: string };
type Unit = BlockUnit | CopyUnit | TitleUnit | TriggersUnit;

type FieldSnapshot = {
  docId: string;
  source: string;
  target: string;
  kind: "blocks" | "title" | "triggers";
  units: Unit[];
};
type Snapshot = {
  exportedAt: string;
  docs: { _id: string; _rev: string; label: string }[];
  fields: FieldSnapshot[];
};

type ScriptDoc = { _id: string; _rev: string; title?: string } & Record<string, unknown>;
type ObjectionDoc = {
  _id: string;
  _rev: string;
  titleEn?: string;
  titleEs?: string;
  answerEn?: Item[];
  answerEs?: Item[];
  triggersEn?: string[];
  triggersEs?: string[];
};

/* ------------------------------------------------------------------ *
 * Portable Text <-> tagged text
 * ------------------------------------------------------------------ */

const hashOf = (value: unknown) =>
  createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const newKey = () => randomBytes(6).toString("hex");

function sortMarks(marks: string[] = [], where: string): string[] {
  for (const mark of marks) {
    if (!(mark in TAGS)) {
      throw new Error(`${where}: unsupported mark "${mark}" (links/annotations are not handled).`);
    }
  }
  return [...new Set(marks)].sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b));
}

/** Drops empty spans and merges neighbours that carry the same marks. */
function normalizeSpans(spans: Span[], where: string): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    if (!span.text) continue;
    const marks = sortMarks(span.marks, where);
    const prev = out[out.length - 1];
    if (prev && prev.marks!.join() === marks.join()) prev.text += span.text;
    else out.push({ text: span.text, marks });
  }
  return out;
}

function serialize(spans: Span[]): string {
  return spans
    .map((span) => {
      const tags = (span.marks ?? []).map((mark) => TAGS[mark]);
      const open = tags.map((tag) => `<${tag}>`).join("");
      const close = [...tags].reverse().map((tag) => `</${tag}>`).join("");
      return `${open}${span.text}${close}`;
    })
    .join("");
}

function parseTagged(text: string): { spans: Span[]; error?: string } {
  const spans: Span[] = [];
  const stack: string[] = [];
  let last = 0;
  const push = (chunk: string) => {
    if (chunk) spans.push({ text: chunk, marks: stack.map((tag) => MARK_OF_TAG[tag]) });
  };
  for (const match of text.matchAll(TAG_RE)) {
    push(text.slice(last, match.index));
    last = match.index! + match[0].length;
    const [, closing, tag] = match;
    if (!closing) {
      if (stack.includes(tag)) return { spans, error: `<${tag}> opened twice` };
      stack.push(tag);
    } else if (stack[stack.length - 1] !== tag) {
      return { spans, error: `</${tag}> closes out of order (open: ${stack.join(">") || "none"})` };
    } else {
      stack.pop();
    }
  }
  push(text.slice(last));
  if (stack.length) return { spans, error: `unclosed <${stack.join("> <")}>` };
  const stray = spans.map((span) => span.text).join("").match(/<\/?[a-z]+>/i);
  if (stray) return { spans, error: `unknown tag ${stray[0]}` };
  return { spans };
}

/** Peels the block's leading/trailing whitespace off the spans; it is reused as-is in English. */
function splitEdges(spans: Span[]): { lead: string; trail: string; core: Span[] } {
  const core = spans.map((span) => ({ ...span }));
  let lead = "";
  while (core.length) {
    const ws = core[0].text.match(/^\s*/)![0];
    lead += ws;
    core[0].text = core[0].text.slice(ws.length);
    if (core[0].text) break;
    core.shift();
  }
  let trail = "";
  while (core.length) {
    const last = core[core.length - 1];
    const ws = last.text.match(/\s*$/)![0];
    trail = ws + trail;
    last.text = last.text.slice(0, last.text.length - ws.length);
    if (last.text) break;
    core.pop();
  }
  return { lead, trail, core };
}

function blockUnits(items: Item[] | undefined, prefix: string): Unit[] {
  return (items ?? []).map((item) => {
    const id = `${prefix}.${item._key}`;
    if (item._type !== "block") return { id, kind: "copy", item, hash: hashOf(item) };
    const block = item as unknown as Block;
    const spans = normalizeSpans(block.children ?? [], id);
    const { lead, trail, core } = splitEdges(spans);
    if (!core.length) return { id, kind: "copy", item, hash: hashOf(item) };
    const text = serialize(core);
    if (/^@@ /m.test(text)) throw new Error(`${id}: a line starts with "@@ ", which the file format reserves.`);
    const unit: BlockUnit = {
      id,
      kind: "block",
      style: block.style ?? "normal",
      ...(block.listItem ? { listItem: block.listItem, level: block.level ?? 1 } : {}),
      lead,
      trail,
      core: text,
      hash: "",
    };
    unit.hash = hashOf([unit.style, unit.listItem, unit.level, lead, trail, text]);
    return unit;
  });
}

/** A field Isaac filled with a single throwaway character to get past "required". */
function isPlaceholder(items: Item[] | undefined): boolean {
  if (!items || items.length === 0) return true;
  return items.every(
    (item) =>
      item._type === "block" &&
      ((item as unknown as Block).children ?? []).map((span) => span.text).join("").trim().length <= 1
  );
}

/* ------------------------------------------------------------------ *
 * Reading Sanity
 * ------------------------------------------------------------------ */

async function fetchLive() {
  const scripts = await client.fetch<ScriptDoc[]>(
    `*[_type == "presentationScript" && lineOfBusiness == $lob]`,
    { lob: LOB }
  );
  const objections = await client.fetch<ObjectionDoc[]>(
    `*[_type == "objection" && (!defined(linesOfBusiness) || $lob in linesOfBusiness)]
      {_id, _rev, titleEn, titleEs, answerEn, answerEs, triggersEn, triggersEs}`,
    { lob: LOB }
  );

  const drafts = [...scripts, ...objections].filter((doc) => doc._id.startsWith("drafts."));
  if (drafts.length) {
    throw new Error(
      `Unpublished Studio edits exist (${drafts.map((d) => d._id).join(", ")}). ` +
        `Publish or discard them first — writing around a draft would be undone when it is published.`
    );
  }
  const published = scripts.filter((doc) => (doc as { status?: string }).status === "published");
  if (published.length !== 1) {
    throw new Error(`Expected exactly one published IUL script, found ${published.length}.`);
  }
  return { script: published[0], objections };
}

function snapshotFrom(live: Awaited<ReturnType<typeof fetchLive>>): Snapshot {
  const { script, objections } = live;
  const fields: FieldSnapshot[] = [];

  for (const section of SECTIONS) {
    const value = (script[section] ?? {}) as Record<string, Item[] | undefined>;
    for (const [source, target] of SECTION_PAIRS) {
      if (isPlaceholder(value[source])) continue; // nothing real to translate
      fields.push({
        docId: script._id,
        source: `${section}.${source}`,
        target: `${section}.${target}`,
        kind: "blocks",
        units: blockUnits(value[source], `script.${section}.${target}`),
      });
    }
  }

  for (const doc of objections) {
    const hasSpanish = Boolean(doc.titleEs?.trim()) && (doc.answerEs?.length ?? 0) > 0;
    const hasEnglish = Boolean(doc.titleEn?.trim()) && (doc.answerEn?.length ?? 0) > 0;
    if (!hasSpanish || hasEnglish) continue;
    const prefix = `objection.${doc._id}`;
    fields.push({
      docId: doc._id,
      source: "titleEs",
      target: "titleEn",
      kind: "title",
      units: [{ id: `${prefix}.title`, kind: "title", text: doc.titleEs!.trim(), hash: hashOf(doc.titleEs!.trim()) }],
    });
    fields.push({
      docId: doc._id,
      source: "answerEs",
      target: "answerEn",
      kind: "blocks",
      units: blockUnits(doc.answerEs, `${prefix}.answer`),
    });
    fields.push({
      docId: doc._id,
      source: "triggersEs",
      target: "triggersEn",
      kind: "triggers",
      units: [{ id: `${prefix}.triggers`, kind: "triggers", phrases: doc.triggersEs ?? [], hash: hashOf(doc.triggersEs ?? []) }],
    });
  }

  const docIds = new Set(fields.map((field) => field.docId));
  return {
    exportedAt: new Date().toISOString(),
    docs: [script, ...objections]
      .filter((doc) => docIds.has(doc._id))
      .map((doc) => ({
        _id: doc._id,
        _rev: doc._rev,
        label: doc._id === script._id ? `script "${script.title}"` : `objection "${(doc as ObjectionDoc).titleEs}"`,
      })),
    fields,
  };
}

/* ------------------------------------------------------------------ *
 * The authoring files
 * ------------------------------------------------------------------ */

function unitText(unit: Unit): string | null {
  if (unit.kind === "block") return unit.core;
  if (unit.kind === "title") return unit.text;
  if (unit.kind === "triggers") return unit.phrases.join("\n");
  return null;
}

function readUnitFiles(): Map<string, { text: string; file: string }> {
  const units = new Map<string, { text: string; file: string }>();
  if (!existsSync(EN_DIR)) return units;
  for (const file of readdirSync(EN_DIR).filter((name) => name.endsWith(".txt")).sort()) {
    const lines = readFileSync(path.join(EN_DIR, file), "utf8").replace(/\r\n/g, "\n").split("\n");
    let id: string | null = null;
    let body: string[] = [];
    const flush = () => {
      if (id === null) return;
      if (units.has(id)) throw new Error(`${id} is translated twice (${units.get(id)!.file} and ${file}).`);
      units.set(id, { text: body.join("\n").trim(), file });
    };
    for (const line of lines) {
      const header = line.match(/^@@ (\S+)\s*$/);
      if (header) {
        flush();
        id = header[1];
        body = [];
      } else if (id !== null) {
        body.push(line);
      } else if (line.trim()) {
        throw new Error(`${file}: text before the first "@@ <id>" header.`);
      }
    }
    flush();
  }
  return units;
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

const plain = (spans: Span[]) => spans.map((span) => span.text).join("");
const markSet = (spans: Span[]) =>
  [...new Set(spans.filter((span) => span.text.trim()).flatMap((span) => span.marks ?? []))].sort().join(",");
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const numbersOf = (text: string) =>
  (text.replace(/(\d)[.,](?=\d{3}\b)/g, "$1").match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((n) => n.replace(",", "."))
    .sort()
    .join(" ");

const SPANISH_WORDS =
  /\b(que|para|pero|porque|usted|también|entonces|ahora|dinero|dólares|cuenta|póliza|gracias|verdad|cierto|okey|bueno|aquí|muy|cuando|tienes|estás)\b/i;

type Finding = { errors: string[]; warnings: string[] };

function checkBlock(unit: BlockUnit, english: string): Finding {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = parseTagged(english);
  if (parsed.error) return { errors: [`markup: ${parsed.error}`], warnings };
  const es = parseTagged(unit.core).spans;
  const en = parsed.spans;
  const esText = plain(es);
  const enText = plain(en);

  if (!enText.trim()) errors.push("empty translation");
  if (markSet(es) !== markSet(en)) {
    errors.push(`formatting differs: Spanish uses [${markSet(es)}], English uses [${markSet(en)}]`);
  }
  if (count(esText, /\n/g) !== count(enText, /\n/g)) {
    errors.push(`line breaks: Spanish has ${count(esText, /\n/g)}, English has ${count(enText, /\n/g)}`);
  }
  if (count(esText, /_{2,}/g) !== count(enText, /_{2,}/g)) {
    errors.push(`fill-in blanks: Spanish has ${count(esText, /_{2,}/g)}, English has ${count(enText, /_{2,}/g)}`);
  }
  for (const token of PROTECTED) {
    if (esText.includes(token) && !enText.includes(token)) errors.push(`missing "${token}"`);
  }
  if (/[¿¡ñÑ]/.test(enText)) errors.push("Spanish punctuation or ñ left in the English");

  if (numbersOf(esText) !== numbersOf(enText)) {
    warnings.push(`numbers differ: ES [${numbersOf(esText)}] vs EN [${numbersOf(enText)}]`);
  }
  const word = enText.match(SPANISH_WORDS);
  if (word) warnings.push(`possible Spanish left: "${word[0]}"`);
  if (/[áéíóúÁÉÍÓÚ]/.test(enText)) warnings.push("accented letters in the English");
  const ratio = enText.length / Math.max(esText.length, 1);
  if (esText.length > 40 && (ratio < 0.6 || ratio > 1.3)) {
    warnings.push(`length ${Math.round(ratio * 100)}% of the Spanish — check nothing was dropped or added`);
  }
  return { errors, warnings };
}

function checkTriggers(english: string): Finding {
  const errors: string[] = [];
  const phrases = english.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!phrases.length) errors.push("no phrases");
  for (const phrase of phrases) {
    if (phrase !== phrase.toLowerCase()) errors.push(`"${phrase}" must be lowercase`);
    if (!/^[a-z0-9' ]+$/.test(phrase)) errors.push(`"${phrase}" may only use letters, digits, apostrophes`);
    const words = phrase.split(/\s+/).length;
    if (words > 8) errors.push(`"${phrase}" is ${words} words; keep it under 9`);
  }
  if (new Set(phrases.map(normalizeSpokenText)).size !== phrases.length) errors.push("duplicate phrases");
  return { errors, warnings: [] };
}

function checkAll(snapshot: Snapshot, english: Map<string, { text: string; file: string }>) {
  const findings = new Map<string, Finding>();
  const expected = new Set<string>();
  const triggerOwners = new Map<string, string>();

  for (const field of snapshot.fields) {
    for (const unit of field.units) {
      if (unit.kind === "copy") continue;
      expected.add(unit.id);
      const entry = english.get(unit.id);
      if (!entry) {
        findings.set(unit.id, { errors: ["not translated yet"], warnings: [] });
        continue;
      }
      let finding: Finding;
      if (unit.kind === "block") finding = checkBlock(unit, entry.text);
      else if (unit.kind === "triggers") finding = checkTriggers(entry.text);
      else {
        finding = { errors: [], warnings: [] };
        if (!entry.text) finding.errors.push("empty title");
        if (entry.text.includes("\n")) finding.errors.push("titles are one line");
        if (/[¿¡ñÑ]/.test(entry.text)) finding.errors.push("Spanish punctuation or ñ left in the English");
      }
      if (unit.kind === "triggers") {
        // One phrase, one objection — otherwise the live matcher's winner is arbitrary.
        for (const phrase of entry.text.split("\n").map((l) => l.trim()).filter(Boolean)) {
          const key = normalizeSpokenText(phrase);
          const owner = triggerOwners.get(key);
          if (owner && owner !== unit.id) finding.errors.push(`"${phrase}" is also a trigger of ${owner}`);
          triggerOwners.set(key, unit.id);
        }
      }
      if (finding.errors.length || finding.warnings.length) findings.set(unit.id, finding);
    }
  }
  for (const id of english.keys()) {
    if (!expected.has(id)) findings.set(id, { errors: ["no such Spanish unit in the snapshot"], warnings: [] });
  }
  return { findings, expected: expected.size };
}

function report(snapshot: Snapshot, english: Map<string, { text: string; file: string }>): boolean {
  const { findings, expected } = checkAll(snapshot, english);
  let errorCount = 0;
  let warningCount = 0;
  for (const [id, { errors, warnings }] of findings) {
    errorCount += errors.length;
    warningCount += warnings.length;
    const where = english.get(id)?.file ?? "—";
    console.log(`\n${errors.length ? "✗" : "!"} ${id}  (${where})`);
    for (const error of errors) console.log(`    error    ${error}`);
    for (const warning of warnings) console.log(`    warning  ${warning}`);
  }
  const done = [...english.keys()].filter((id) => !findings.get(id)?.errors.length).length;
  console.log(
    `\n${done}/${expected} units pass · ${errorCount} error(s) · ${warningCount} warning(s) to eyeball`
  );
  return errorCount === 0;
}

/* ------------------------------------------------------------------ *
 * Building the English values
 * ------------------------------------------------------------------ */

function rekey(item: Item): Item {
  const copy = JSON.parse(JSON.stringify(item)) as Item;
  copy._key = newKey();
  if (copy._type === "block") {
    for (const span of ((copy as unknown as Block).children ?? [])) span._key = newKey();
  }
  return copy;
}

function buildBlock(unit: BlockUnit, english: string): Block {
  const spans = normalizeSpans(
    [{ text: unit.lead, marks: [] }, ...parseTagged(english).spans, { text: unit.trail, marks: [] }],
    unit.id
  );
  return {
    _key: newKey(),
    _type: "block",
    style: unit.style,
    ...(unit.listItem ? { listItem: unit.listItem, level: unit.level } : {}),
    markDefs: [],
    children: spans.map((span) => ({ _key: newKey(), _type: "span", text: span.text, marks: span.marks ?? [] })),
  };
}

function buildValue(field: FieldSnapshot, english: Map<string, { text: string; file: string }>): unknown {
  if (field.kind === "title") return english.get(field.units[0].id)!.text;
  if (field.kind === "triggers") {
    return english.get(field.units[0].id)!.text.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  return field.units.map((unit) =>
    unit.kind === "copy" ? rekey(unit.item) : buildBlock(unit as BlockUnit, english.get(unit.id)!.text)
  );
}

/** What a reader sees: style + marks + text, keys ignored. Used to verify the write landed. */
function fingerprint(value: unknown): string {
  if (!Array.isArray(value)) return JSON.stringify(value ?? null);
  return JSON.stringify(
    (value as Item[]).map((item) =>
      item._type === "block"
        ? [
            (item as unknown as Block).style,
            serialize(normalizeSpans((item as unknown as Block).children ?? [], "verify")),
          ]
        : [item._type, JSON.stringify({ ...item, _key: undefined })]
    )
  );
}

function getPath(doc: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], doc);
}

/* ------------------------------------------------------------------ *
 * Commands
 * ------------------------------------------------------------------ */

function loadSnapshot(): Snapshot {
  if (!existsSync(SNAPSHOT_FILE)) throw new Error("No snapshot yet — run: pnpm translate:iul-script export");
  return JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as Snapshot;
}

async function exportCommand() {
  const snapshot = snapshotFrom(await fetchLive());
  mkdirSync(EN_DIR, { recursive: true });
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));

  const lines: string[] = [];
  for (const field of snapshot.fields) {
    for (const unit of field.units) {
      const text = unitText(unit);
      if (text !== null) lines.push(`@@ ${unit.id}`, text, "");
    }
  }
  writeFileSync(SOURCE_TEXT_FILE, lines.join("\n"));

  for (const field of snapshot.fields) {
    const units = field.units.filter((unit) => unit.kind !== "copy");
    const chars = units.reduce((n, unit) => n + (unitText(unit)?.length ?? 0), 0);
    console.log(`  ${field.docId.slice(0, 8)} ${field.source} → ${field.target}: ${units.length} unit(s), ${chars} chars`);
  }
  console.log(`\nSnapshot: ${path.relative(process.cwd(), SNAPSHOT_FILE)}`);
  console.log(`Spanish to translate: ${path.relative(process.cwd(), SOURCE_TEXT_FILE)}`);
}

function checkCommand() {
  const ok = report(loadSnapshot(), readUnitFiles());
  if (!ok) process.exitCode = 1;
}

async function applyCommand(dry: boolean, force: boolean) {
  if (!process.env.SANITY_API_WRITE_TOKEN) throw new Error("SANITY_API_WRITE_TOKEN is required.");
  const snapshot = loadSnapshot();
  const english = readUnitFiles();
  if (!report(snapshot, english)) throw new Error("Fix the errors above first.");

  // The Spanish must still be the Spanish that was translated.
  const live = await fetchLive();
  const now = snapshotFrom(live);
  const liveHashes = new Map(now.fields.flatMap((field) => field.units.map((unit) => [unit.id, unit.hash])));
  const drifted = snapshot.fields
    .flatMap((field) => field.units)
    .filter((unit) => unit.kind !== "copy" && liveHashes.get(unit.id) !== unit.hash)
    .map((unit) => unit.id);
  if (drifted.length && !force) {
    throw new Error(
      `The Spanish changed in Studio since the export (${drifted.length} unit(s)):\n  ${drifted.join("\n  ")}\n` +
        `Re-run export and update those translations.`
    );
  }

  const docs = new Map<string, Record<string, unknown>>(
    [live.script, ...live.objections].map((doc) => [doc._id, doc as Record<string, unknown>])
  );
  const sets = new Map<string, Record<string, unknown>>();
  const blocked: string[] = [];
  for (const field of snapshot.fields) {
    const doc = docs.get(field.docId)!;
    const current = getPath(doc, field.target);
    const empty = field.kind === "blocks" ? isPlaceholder(current as Item[] | undefined) : !current || (Array.isArray(current) ? current.length === 0 : !String(current).trim());
    if (!empty && !force) blocked.push(`${field.docId} ${field.target}`);
    sets.set(field.docId, { ...(sets.get(field.docId) ?? {}), [field.target]: buildValue(field, english) });
  }
  if (blocked.length) {
    throw new Error(`These already have English content (use --force to replace):\n  ${blocked.join("\n  ")}`);
  }

  for (const [docId, values] of sets) {
    const label = snapshot.docs.find((doc) => doc._id === docId)?.label ?? docId;
    console.log(`\n  ${label}`);
    for (const [target, value] of Object.entries(values)) {
      const size = Array.isArray(value) ? `${value.length} item(s)` : JSON.stringify(value);
      console.log(`    set ${target}: ${size}`);
    }
  }

  if (dry) {
    console.log(`\nDRY RUN — nothing written. ${sets.size} document(s) would be patched.`);
    return;
  }

  const backupDir = path.join(DATA_DIR, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(backupFile, JSON.stringify([...sets.keys()].map((id) => docs.get(id)), null, 2));
  console.log(`\nBackup of the documents as they were: ${path.relative(process.cwd(), backupFile)}`);

  const transaction = client.transaction();
  for (const [docId, values] of sets) {
    transaction.patch(client.patch(docId).ifRevisionId(docs.get(docId)!._rev as string).set(values));
  }
  await transaction.commit({ visibility: "sync" });

  const after = await client.fetch<Record<string, unknown>[]>(`*[_id in $ids]`, { ids: [...sets.keys()] });
  const mismatched: string[] = [];
  for (const [docId, values] of sets) {
    const doc = after.find((d) => d._id === docId)!;
    for (const [target, value] of Object.entries(values)) {
      if (fingerprint(getPath(doc, target)) !== fingerprint(value)) mismatched.push(`${docId} ${target}`);
    }
  }
  if (mismatched.length) throw new Error(`Written, but these read back differently:\n  ${mismatched.join("\n  ")}`);
  console.log(`\n✅ ${sets.size} document(s) patched and read back identical.`);
}

async function main() {
  const [command] = process.argv.slice(2);
  const dry = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  if (command === "export") return exportCommand();
  if (command === "check") return checkCommand();
  if (command === "apply") return applyCommand(dry, force);
  throw new Error("Usage: pnpm translate:iul-script <export | check | apply [--dry-run] [--force]>");
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error("\n❌", error instanceof Error ? error.message : error);
    process.exit(1);
  });
