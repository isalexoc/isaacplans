/**
 * Audit every routing number in the curated table against the embedded FedACH directory.
 *
 *   pnpm check:ach-directory
 *
 * ─── Why this is a committed script and not a one-off ───
 *
 * The curated table is the one place in this feature where a human types nine digits copied off a
 * bank's website, and a wrong routing number is a failed premium draft and a lapsed policy. When
 * the table was first assembled these exact checks rejected two published numbers that looked
 * perfectly reasonable:
 *
 *   - `081000033`, published as Bank of America Missouri — fails the ABA checksum outright.
 *   - `064103707`, published as U.S. Bank North Carolina — absent from the Fed directory entirely.
 *
 * Anyone adding a bank should run this before committing. It is fast, needs no network and no
 * credentials, because the directory it checks against ships with the app.
 */

import { CURATED_BANKS } from "../lib/iul-intake/data/bank-state-routing";
import { ACH_DIRECTORY_GZ_BASE64 } from "../lib/iul-intake/data/ach-directory.generated";
import { gunzipSync } from "node:zlib";

type Row = { name: string; city: string; state: string };

const directory = new Map<string, Row>();
for (const line of gunzipSync(Buffer.from(ACH_DIRECTORY_GZ_BASE64, "base64"))
  .toString("utf8")
  .split("\n")) {
  if (!line) continue;
  const [rn, name, city, state] = line.split("\t");
  if (rn) directory.set(rn, { name: name ?? "", city: city ?? "", state: state ?? "" });
}

/** The ABA check digit — the same one `lib/iul-intake/validation.ts` enforces on typed input. */
function checksumOk(d: string): boolean {
  if (!/^\d{9}$/.test(d)) return false;
  const n = [...d].map(Number);
  return (3 * (n[0] + n[3] + n[6]) + 7 * (n[1] + n[4] + n[7]) + (n[2] + n[5] + n[8])) % 10 === 0;
}

const squash = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Bank names that legitimately do not match the directory, with the reason.
 *
 * The embedded file is the December 2018 release, so a bank that rebranded after that date still
 * appears under its old name. These are the rebrands, not sloppiness — and listing them explicitly
 * means a genuine mismatch still gets flagged instead of being lost in accepted noise.
 */
const KNOWN_LEGACY_NAMES: Record<string, string> = {
  "061000104": "Truist — the 2018 file predates the rebrand and still says SUNTRUST",
  "053101121": "Truist — the 2018 file predates the rebrand and still says BRANCH BANKING & TRUST",
};

let checked = 0;
const errors: string[] = [];
const warnings: string[] = [];

for (const bank of CURATED_BANKS) {
  const entries: { rn: string; where: string }[] = [
    ...(bank.nationwide ?? []).map((rn) => ({ rn, where: "nationwide" })),
    ...Object.entries(bank.byState ?? {}).flatMap(([state, list]) =>
      list.map((rn) => ({ rn, where: state }))
    ),
  ];

  for (const { rn, where } of entries) {
    checked++;
    const label = `${bank.name} ${where} ${rn}`;

    if (!checksumOk(rn)) {
      errors.push(`${label} — fails the ABA checksum`);
      continue;
    }
    const row = directory.get(rn);
    if (!row) {
      errors.push(`${label} — not in the FedACH directory`);
      continue;
    }
    // A loose containment test on the distinctive part of the name: the directory writes
    // "U.S. BANK NATIONAL ASSOCIATION" where we write "U.S. Bank", so exact matching is useless.
    const token = squash(bank.name.replace(/\b(bank|national|credit union|n\.a\.)\b/gi, ""));
    if (token.length >= 4 && !squash(row.name).includes(token.slice(0, 6)) && !KNOWN_LEGACY_NAMES[rn]) {
      warnings.push(`${label} — directory says "${row.name}" (${row.city}, ${row.state})`);
    }
  }
}

console.log(`Checked ${checked} routing numbers across ${CURATED_BANKS.length} curated banks.`);

if (warnings.length) {
  console.log(`\n${warnings.length} name mismatch(es) to eyeball:`);
  for (const w of warnings) console.log(`  ? ${w}`);
}

if (errors.length) {
  console.error(`\n${errors.length} BAD number(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}

console.log("\nAll curated routing numbers pass the checksum and exist in the FedACH directory.");
