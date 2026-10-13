/**
 * Checks for the Illustration Studio (carrier illustration → NLG-style two-page summary).
 *
 * Offline (default, no network, no API keys):
 *   pnpm test:illustration-studio
 * Pins down the pure pipeline: table-row reconstruction from PDF text runs, grounding, the model
 * output normalizer, carrier detection, and the deterministic defaults — the latter against
 * fixtures captured from six real carrier illustrations (agent details replaced).
 *
 * Live, on a real PDF (needs OPENAI_API_KEY in .env):
 *   pnpm test:illustration-studio --pdf "C:\path\to\illustration.pdf"
 * Reads the PDF exactly as the browser does, runs the AI extraction and prints the draft.
 *
 * Render the two-page PDF (fixtures, or the --pdf result) into a folder for a visual check:
 *   pnpm test:illustration-studio --render <dir>
 */

import "dotenv/config";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { detectCarrier } from "../lib/illustration-studio/carriers";
import {
  buildDefaultPresentation,
  chooseLivingBenefitsAge,
  defaultCashValueBars,
  seedPresentedBy,
  tidyName,
} from "../lib/illustration-studio/defaults";
import { prepareModelInput } from "../lib/illustration-studio/extract";
import { formatCurrency, formatLongDate, summaryPdfFilename } from "../lib/illustration-studio/format";
import { buildNumberIndex, groundExtraction } from "../lib/illustration-studio/grounding";
import { normalizeExtraction, type RawExtraction } from "../lib/illustration-studio/normalize";
import { reconstructLines, type PdfTextItem } from "../lib/illustration-studio/pdf-text";
import type {
  CarrierKey,
  IllustrationExtraction,
  LivingBenefitRow,
  PresentationData,
} from "../lib/illustration-studio/types";

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

const FIXTURES_DIR = join(process.cwd(), "scripts", "fixtures", "illustration-studio");
const FIXTURES: { file: string; carrier: CarrierKey }[] = [
  { file: "americo.json", carrier: "americo" },
  { file: "american-amicable.json", carrier: "american_amicable" },
  { file: "fg.json", carrier: "fg" },
  { file: "mutual-of-omaha.json", carrier: "mutual_of_omaha" },
  { file: "transamerica.json", carrier: "transamerica" },
  { file: "national-life.json", carrier: "national_life" },
];

async function loadFixture(file: string): Promise<IllustrationExtraction> {
  return JSON.parse(await readFile(join(FIXTURES_DIR, file), "utf8")) as IllustrationExtraction;
}

/** A text run at baseline (x, y) in PDF space (y grows upward), 10 pt type. */
function run(str: string, x: number, y: number, width = str.length * 5): PdfTextItem {
  return { str, transform: [10, 0, 0, 10, x, y], width };
}
/** Letter page, the viewport PDF.js produces at scale 1. */
const LETTER_VIEWPORT = [1, 0, 0, -1, 0, 792];

function rowText(row: LivingBenefitRow): string {
  const value = row.amount === null ? row.text : formatCurrency(row.amount);
  return [row.prefix, value, row.suffix].filter(Boolean).join(" ");
}

// ─── reconstructLines ─────────────────────────────────────────────────────────

function testReconstructLines() {
  console.log("\nreconstructLines");
  const ledger = reconstructLines(
    [
      // Column-ordered content stream (Americo): every year first, then every value.
      run("1", 50, 560), run("2", 50, 548),
      run("39", 100, 560), run("40", 100, 548),
      run("1,384", 300, 560), run("2,874", 300, 548),
    ],
    LETTER_VIEWPORT
  );
  check("rebuilds rows from a column-ordered stream", ledger === "1 | 39 | 1,384\n2 | 40 | 2,874", JSON.stringify(ledger));

  const split = reconstructLines([run("$", 100, 500, 5), run("391,871", 105, 500, 35)], LETTER_VIEWPORT);
  check("joins a number split across runs with no space", split === "$391,871", split);

  const words = reconstructLines([run("Initial", 100, 500, 30), run("Premium", 133, 500, 35)], LETTER_VIEWPORT);
  check("keeps a word space", words === "Initial Premium", words);

  const overdraw = reconstructLines(
    [run("5", 50, 500), run("5", 50.2, 500.1), run("5", 50.4, 500), run("44", 100, 500), run("44", 100.3, 500)],
    LETTER_VIEWPORT
  );
  check("drops fake-bold overdraw (Transamerica)", overdraw === "5 | 44", overdraw);

  const footnote = reconstructLines(
    [run("At age 65:", 50, 500, 45), run("$47,223", 100, 500, 35), { str: "2", transform: [6, 0, 0, 6, 135, 504], width: 3 }],
    LETTER_VIEWPORT
  );
  check("a footnote digit never glues onto a number", footnote.split("\n").includes("At age 65: $47,223"), JSON.stringify(footnote));

  const order = reconstructLines([run("bottom", 50, 100), run("top", 50, 700)], LETTER_VIEWPORT);
  check("orders lines top to bottom", order === "top\nbottom", order);

  // Text set at 90° (a sideways table): columns of constant x read as lines.
  const rotated = reconstructLines(
    [
      { str: "65", transform: [0, 10, -10, 0, 200, 100], width: 10 },
      { str: "82,295", transform: [0, 10, -10, 0, 200, 300], width: 30 },
      { str: "70", transform: [0, 10, -10, 0, 220, 100], width: 10 },
      { str: "113,211", transform: [0, 10, -10, 0, 220, 300], width: 35 },
    ],
    LETTER_VIEWPORT
  );
  check("groups rotated text along its own baseline", rotated === "65 | 82,295\n70 | 113,211", JSON.stringify(rotated));
}

// ─── normalize ────────────────────────────────────────────────────────────────

function rawExtraction(overrides: Partial<RawExtraction> = {}): RawExtraction {
  return {
    carrierName: "Americo",
    issuingCompany: "Americo Financial Life and Annuity Insurance Company",
    issuerAddress: "Kansas City, MO",
    productName: "Instant Decision IUL",
    policyForm: "ACA336",
    preparedDate: "2026-10-13",
    insured: { name: "Insured", gender: "Male", issueAge: 38, riskClass: "Non-Nicotine", state: "ca" },
    agent: {
      name: "Please fill in name",
      addressLines: ["111 Main St., Anywhere, TX 12345", "100 Main St"],
      phone: null,
      email: null,
      license: null,
    },
    premium: { amount: 213.87, mode: "Monthly" },
    initialDeathBenefit: 391871,
    deathBenefitOption: "Option A - Level",
    illustratedRate: 8.45,
    ledger: [
      [27, 65, 2566, 76823, 76823, 391871],
      [27, 65, 2566, 1, 1, 391871],
      [1, 39, 2566, 1384, 0, 391871],
      [0, 38, 0, 0, 0, 0],
      [5, 43, 2566],
    ],
    livingBenefits: [
      { type: "terminal", riderName: "Terminal Illness Rider", maxPercentOfDeathBenefit: 100, maxAmount: null, examples: [] },
      { type: "terminal", riderName: "Terminal Illness Rider", maxPercentOfDeathBenefit: null, maxAmount: 250000, examples: [
        { age: 65, amount: 67870, frequency: "lump_sum", kind: "payout", label: null },
      ] },
      { type: "weird", riderName: "Mystery Rider", maxPercentOfDeathBenefit: 140, maxAmount: null, examples: [] },
    ],
    otherRiders: [" Overloan Protection Rider "],
    ...overrides,
  };
}

const META = { model: "test", pageCount: 1, sentChars: 0, droppedPages: [], promptTokens: null, completionTokens: null };

function testNormalize() {
  console.log("\nnormalizeExtraction");
  const n = normalizeExtraction(rawExtraction(), META);
  check("placeholder insured name → null", n.insured.name === null);
  check("placeholder agent name → null", n.agent.name === null);
  check("dummy 'Anywhere' address dropped", n.agent.addressLines.join("|") === "100 Main St", n.agent.addressLines.join("|"));
  check("state upper-cased", n.insured.state === "CA");
  check("ledger: bad and short rows dropped, first year kept, sorted",
    n.ledger.map((r) => r.policyYear).join(",") === "1,27", n.ledger.map((r) => r.policyYear).join(","));
  check("ledger: duplicate year keeps the first occurrence", n.ledger[1]?.cashSurrenderValue === 76823);
  check("living benefits: duplicate type merged", n.livingBenefits.filter((b) => b.type === "terminal").length === 1);
  const terminal = n.livingBenefits.find((b) => b.type === "terminal");
  check("merged rider keeps the % and gains the $ cap + example",
    terminal?.maxPercentOfDeathBenefit === 100 && terminal?.maxAmount === 250000 && terminal?.examples.length === 1);
  const other = n.livingBenefits.find((b) => b.riderName === "Mystery Rider");
  check("unknown type → other, impossible % dropped", other?.type === "other" && other.maxPercentOfDeathBenefit === null);
  check("rider names trimmed", n.otherRiders[0] === "Overloan Protection Rider");
}

// ─── grounding ────────────────────────────────────────────────────────────────

function testGrounding() {
  console.log("\ngroundExtraction");
  const pages = [
    [
      "Planned Monthly Premium: $213.87",
      "Initial Death Benefit: $391,871.00",
      "1 | 39 | 2,566 | 1,350 | 0 | 391,871 | 1,384 | 0 | 391,871",
      "27 | 65 | 2,566 | 9,698 | 9,698 | 391,871 | 76,823 | 76,823 | 391,871",
      "32 | 70 | 2,566 | 106,098 | 106,098 | 391,871",
      "Terminal benefit at age 65: $67,870",
    ].join("\n"),
  ];
  const base = normalizeExtraction(
    rawExtraction({
      ledger: [
        [1, 39, 2566, 1384, 0, 391871],
        [27, 65, 2566, 76823, 76823, 391871],
        // Right numbers, wrong row: 106,098 sits on year 32's line, not year 30's.
        [30, 68, 2566, 106098, 106098, 391871],
        // Surrender value above accumulation value can't happen.
        [32, 70, 2566, 1, 106098, 391871],
      ],
      livingBenefits: [
        { type: "terminal", riderName: "T", maxPercentOfDeathBenefit: null, maxAmount: 999999, examples: [
          { age: 65, amount: 67870, frequency: "lump_sum", kind: "payout", label: null },
          { age: 65, amount: 12345, frequency: "lump_sum", kind: "payout", label: null },
        ] },
      ],
    }),
    META
  );
  const g = groundExtraction(base, buildNumberIndex(pages));
  check("premium found → verified", g.premium.verified);
  check("death benefit found → verified", g.initialDeathBenefitVerified);
  check("row whose numbers share one line → verified", g.ledger[0].verified && g.ledger[1].verified);
  check("values from another row's line → unverified", !g.ledger[2].verified);
  check("surrender above accumulation → unverified", !g.ledger[3].verified);
  check("ledger warning names the ages", g.warnings.some((w) => w.includes("68") && w.includes("70")), g.warnings.join(" / "));
  const t = g.livingBenefits[0];
  check("printed example verified, invented one not", t.examples[0].verified && !t.examples[1].verified);
  check("invented $ cap unverified", !t.maxAmountVerified);
  check("warning counts dropped benefit amounts", g.warnings.some((w) => w.startsWith("2 living-benefit")), g.warnings.join(" / "));

  const missing = groundExtraction(
    normalizeExtraction(rawExtraction({ premium: { amount: 199.14, mode: "Monthly" }, ledger: [] }), META),
    buildNumberIndex(pages)
  );
  check("premium not in text → unverified + warning",
    !missing.premium.verified && missing.warnings.some((w) => w.includes("$199.14")));
  check("empty ledger → warning", missing.warnings.some((w) => w.startsWith("No cash values")));
}

// ─── carriers / format / input cap ───────────────────────────────────────────

function testCarriersAndFormat() {
  console.log("\ndetectCarrier / format / prepareModelInput");
  const cases: [string, CarrierKey][] = [
    ["Transamerica Life Insurance Company, Cedar Rapids", "transamerica"],
    ["Americo Financial Life and Annuity Insurance Company", "americo"],
    ["American-Amicable Life Insurance Company of Texas", "american_amicable"],
    ["United of Omaha Life Insurance Company ... Income Advantage Life Insurance Illustration ... United of Omaha", "mutual_of_omaha"],
    ["F&G Annuities & Life ... F&G Everlast", "fg"],
    ["Life Insurance Company of the Southwest, Addison, TX", "national_life"],
    ["Some Other Life Company", "other"],
  ];
  for (const [text, expected] of cases) {
    check(`detects ${expected}`, detectCarrier(text) === expected, detectCarrier(text));
  }
  check("Transamerica never reads as Americo", detectCarrier("TRANSAMERICA TRANSAMERICA") === "transamerica");

  check("currency whole dollars", formatCurrency(391871) === "$391,871");
  check("currency with cents", formatCurrency(213.87, true) === "$213.87");
  check("long date", formatLongDate("2026-10-05") === "October 5, 2026", formatLongDate("2026-10-05"));
  check("tidyName title-cases ALL CAPS only", tidyName("MARIO SILVA") === "Mario Silva" && tidyName("Rodolfo Rodríguez") === "Rodolfo Rodríguez");

  const filename = summaryPdfFilename({
    carrierDisplayName: "F&G",
    productName: "Everlast",
    clientName: "Rodolfo Rodríguez",
    preparedDate: "2026-10-05",
  } as PresentationData);
  check("filename is ASCII kebab-case", filename === "f-g-everlast-rodolfo-rodriguez-2026-10-05.pdf", filename);

  const dense = "1 | 39 | 2,566 | 1,384\n".repeat(2500);
  const prose = "S&P Dow Jones Indices disclaims all warranties. ".repeat(2000);
  const { text, droppedPages } = prepareModelInput(["cover", "summary", "ledger", prose, dense, dense, prose]);
  check("over the cap: the low-digit pages are dropped first", droppedPages.join(",") === "4,7", droppedPages.join(","));
  check("dropped pages are left out of the prompt", !text.includes("=== PAGE 4 ===") && text.includes("=== PAGE 5 ==="));
}

// ─── defaults on real fixtures ────────────────────────────────────────────────

const EXPECTED: Record<CarrierKey, { premium: number; db: number; bars: string; age: number | null; rows: string[] } | undefined> = {
  americo: { premium: 213.87, db: 391871, bars: "65:76823 70:106098 75:141599 80:182045", age: null, rows: ["Terminal Illness Benefit=Included"] },
  american_amicable: {
    premium: 199.14, db: 389000, bars: "65:87514 70:116561 75:149688 80:184664", age: null,
    rows: [
      "Terminal Illness Benefit=Up to $389,000 Lump Sum",
      "Chronic Illness Benefit=Included",
      "Critical Illness Benefit=Up to $369,550 Lump Sum",
      "Confined Care Benefit=Included",
    ],
  },
  fg: {
    premium: 200, db: 150000, bars: "65:127942 70:193976 75:288405 80:424019", age: 70,
    rows: [
      "Terminal Illness Benefit=$217,574 Lump Sum",
      "Chronic Illness Benefit=$48,494 Per Year",
      "Critical Illness Benefit=Up to $193,976 Lump Sum",
    ],
  },
  mutual_of_omaha: {
    premium: 200, db: 371932, bars: "65:82295 70:113211 75:149670 80:190968", age: null,
    rows: [
      "Terminal Illness Benefit=Up to $297,545 Lump Sum",
      "Chronic Illness Benefit=Up to $156,950 Per Year",
      "Critical Illness Benefit=Up to $250,000 Lump Sum",
    ],
  },
  transamerica: {
    premium: 200, db: 196000, bars: "65:91409 70:129342 75:177353 80:238407", age: 65,
    rows: [
      "Terminal Illness Benefit=$270,512 Lump Sum",
      "Chronic Illness Benefit=Up to $57,063 Per Year",
      "Critical Illness Benefit=Up to $216,286 Lump Sum",
    ],
  },
  national_life: {
    premium: 120, db: 78585, bars: "65:47223 70:72825 75:110563 80:163819", age: 65,
    rows: [
      "Terminal Illness Benefit=$67,870 Lump Sum",
      "Chronic Illness Benefit=$1,206 Per Month",
      "Critical Illness Benefit=Up to $63,672 Lump Sum",
      "Critical Injury Benefit=Up to $63,672 Lump Sum",
      "Alzheimer's Disease Benefit=$61,277 Lump Sum",
    ],
  },
  other: undefined,
};

function draftFor(extraction: IllustrationExtraction, carrier: CarrierKey): PresentationData {
  return buildDefaultPresentation(extraction, {
    carrierKey: carrier,
    today: "2026-10-13",
    presentedBy: seedPresentedBy(extraction, null),
  });
}

async function testDefaults() {
  console.log("\nbuildDefaultPresentation (six real illustrations)");
  for (const { file, carrier } of FIXTURES) {
    const expected = EXPECTED[carrier];
    if (!expected) continue;
    const draft = draftFor(await loadFixture(file), carrier);
    const bars = draft.cashValueBars.map((b) => `${b.age}:${b.value}`).join(" ");
    const rows = draft.livingBenefits.map((r) => `${r.label}=${rowText(r)}`);
    check(`${carrier}: premium + death benefit`, draft.premium.amount === expected.premium && draft.deathBenefit === expected.db,
      `${draft.premium.amount} / ${draft.deathBenefit}`);
    check(`${carrier}: cash value bars`, bars === expected.bars, bars);
    check(`${carrier}: living-benefit age`, draft.livingBenefitsAge === expected.age, String(draft.livingBenefitsAge));
    check(`${carrier}: living-benefit rows`, rows.join(" | ") === expected.rows.join(" | "), rows.join(" | "));
  }

  const transamerica = draftFor(await loadFixture("transamerica.json"), "transamerica");
  check("ALL-CAPS client name tidied", transamerica.clientName === "Mario Silva", transamerica.clientName);
  check("agent block seeded from the illustration", transamerica.presentedBy.name === "Sample Agent" &&
    transamerica.presentedBy.lines.join("|") === "100 Main St|Richmond, VA 23220|(555) 555-0100",
    JSON.stringify(transamerica.presentedBy));
  const americo = draftFor(await loadFixture("americo.json"), "americo");
  check("no insured name → blank client (editor flags it)", americo.clientName === "");

  const late = defaultCashValueBars(
    [60, 65, 70, 75, 80, 85, 90].map((age, i) => ({
      policyYear: i + 1, age, premiumOutlay: 1, accumulationValue: age * 100, cashSurrenderValue: age * 100,
      deathBenefit: 1, verified: true,
    })),
    62
  );
  check("issue age 62 → chart starts at 75", late.map((b) => b.age).join(",") === "75,80,85,90", late.map((b) => b.age).join(","));
  check("no examples → no living-benefit age", chooseLivingBenefitsAge([]) === null);
}

// ─── live + render modes ──────────────────────────────────────────────────────

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function liveExtraction(pdfPath: string): Promise<{ extraction: IllustrationExtraction; carrier: CarrierKey }> {
  const { extractPdfPages } = await import("../lib/illustration-studio/pdf-text");
  const { extractIllustration } = await import("../lib/illustration-studio/extract");
  const started = Date.now();
  const pages = await extractPdfPages(new Uint8Array(await readFile(pdfPath)));
  const result = await extractIllustration(pages);
  if (!result.ok) throw new Error(result.error);
  const carrier = detectCarrier(pages.join("\n"));
  const { meta, warnings } = result.extraction;
  console.log(`\nLive: ${carrier}, ${meta.pageCount} pages, ${meta.promptTokens} prompt tokens, ${Date.now() - started} ms`);
  if (warnings.length > 0) console.log(`Warnings:\n  - ${warnings.join("\n  - ")}`);
  return { extraction: result.extraction, carrier };
}

function printDraft(draft: PresentationData) {
  console.log(`  ${draft.carrierDisplayName} ${draft.productName} — ${draft.clientName || "(no client name)"}`);
  console.log(`  ${formatCurrency(draft.premium.amount, true)} ${draft.premium.mode}, death benefit ${formatCurrency(draft.deathBenefit)}`);
  console.log(`  Cash values: ${draft.cashValueBars.map((b) => `${b.age}: ${formatCurrency(b.value)}`).join(" · ")}`);
  console.log(`  Living benefits${draft.livingBenefitsAge ? ` at ${draft.livingBenefitsAge}` : ""}:`);
  for (const row of draft.livingBenefits) console.log(`    ${row.label}: ${rowText(row)}`);
}

async function renderDrafts(dir: string, drafts: PresentationData[]) {
  const { renderSummaryPdf } = await import("../lib/illustration-studio/pdf-render");
  await mkdir(dir, { recursive: true });
  for (const draft of drafts) {
    const file = join(dir, summaryPdfFilename(draft));
    await writeFile(file, await renderSummaryPdf(draft));
    console.log(`  wrote ${file}`);
  }
}

async function main() {
  const pdfPath = argValue("--pdf");
  const renderDir = argValue("--render");

  if (pdfPath) {
    const { extraction, carrier } = await liveExtraction(pdfPath);
    const draft = draftFor(extraction, carrier);
    printDraft(draft);
    if (renderDir) await renderDrafts(renderDir, [draft]);
    return;
  }

  testReconstructLines();
  testNormalize();
  testGrounding();
  testCarriersAndFormat();
  await testDefaults();

  if (renderDir) {
    console.log("\nrender");
    const drafts = await Promise.all(FIXTURES.map(async ({ file, carrier }) => draftFor(await loadFixture(file), carrier)));
    await renderDrafts(renderDir, drafts);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
