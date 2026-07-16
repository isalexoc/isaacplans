/**
 * Seeds `agentLicense` documents in Sanity from the license list that used to
 * live hardcoded in the IUL presentation message JSON (snapshot now at
 * scripts/data/iul-presentation-en.json).
 *
 * License images stay in Cloudinary (authenticated delivery) — Sanity only
 * stores the metadata (state reference + Cloudinary public ID).
 *
 * Idempotent: uses deterministic _ids with createIfNotExists, so re-running
 * never overwrites Studio edits.
 *
 * Run: pnpm add:agent-licenses
 */
import "dotenv/config";
import { createClient } from "next-sanity";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

interface LicenseSeed {
  key: string;
  licenseType: "state" | "drivers";
  stateCode?: string;
  publicId: string;
}

const LICENSES: LicenseSeed[] = [
  { key: "drivers", licenseType: "drivers", publicId: "license_py9vgu" },
  { key: "az", licenseType: "state", stateCode: "AZ", publicId: "arizona_seh3e1" },
  { key: "co", licenseType: "state", stateCode: "CO", publicId: "colorado_ieaqys" },
  { key: "dc", licenseType: "state", stateCode: "DC", publicId: "dc_dlypyq" },
  { key: "fl", licenseType: "state", stateCode: "FL", publicId: "florida_fkx9g8" },
  { key: "ga", licenseType: "state", stateCode: "GA", publicId: "georgia_v2jqcl" },
  { key: "md", licenseType: "state", stateCode: "MD", publicId: "maryland_fhwufq" },
  { key: "nm", licenseType: "state", stateCode: "NM", publicId: "new_mexico_ulco2i" },
  { key: "nc", licenseType: "state", stateCode: "NC", publicId: "north_carolina_myol58" },
  { key: "oh", licenseType: "state", stateCode: "OH", publicId: "ohio_s958a4" },
  { key: "tx", licenseType: "state", stateCode: "TX", publicId: "texas_ycnpwx" },
  { key: "ut", licenseType: "state", stateCode: "UT", publicId: "utah_mgw2tw" },
  { key: "va", licenseType: "state", stateCode: "VA", publicId: "virginia_woehci" },
];

async function addAgentLicenses() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not set in .env");
  }

  console.log("🚀 Seeding agent licenses in Sanity...\n");

  const states: { _id: string; code?: string }[] = await client.fetch(
    `*[_type == "state"]{ _id, code }`
  );
  const stateIdByCode = new Map(states.filter((s) => s.code).map((s) => [s.code, s._id]));

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < LICENSES.length; i++) {
    const license = LICENSES[i];
    const _id = `agentLicense-${license.key}`;

    if (license.licenseType === "state" && !stateIdByCode.has(license.stateCode)) {
      console.warn(`⚠️  Skipping ${license.stateCode}: no matching state document (run pnpm add:states first)`);
      continue;
    }

    const doc = {
      _id,
      _type: "agentLicense",
      licenseType: license.licenseType,
      ...(license.licenseType === "state"
        ? { state: { _type: "reference", _ref: stateIdByCode.get(license.stateCode)! } }
        : {}),
      cloudinaryPublicId: license.publicId,
      active: true,
      order: i,
    };

    const result = await client.createIfNotExists(doc);
    if (result._createdAt === result._updatedAt) {
      console.log(`✅ Created ${_id} (${license.stateCode ?? "driver's license"})`);
      created++;
    } else {
      console.log(`⏭️  Skipped ${_id} - already exists`);
      skipped++;
    }
  }

  console.log(`\n📊 Done: ${created} created, ${skipped} already existed.`);
}

addAgentLicenses()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("❌ Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
