import "dotenv/config";
import { createClient } from "next-sanity";

// Create write-enabled client
const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "anetxoet",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

// State name to code mapping
const STATE_CODES: Record<string, string> = {
  "Arizona": "AZ",
  "Colorado": "CO",
  "District of Columbia": "DC",
  "Florida": "FL",
  "Georgia": "GA",
  "Maryland": "MD",
  "New Mexico": "NM",
  "North Carolina": "NC",
  "Ohio": "OH",
  "Texas": "TX",
  "Utah": "UT",
  "Virginia": "VA",
};

// Current states from translations
const STATES = [
  "Arizona",
  "Colorado",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Maryland",
  "New Mexico",
  "North Carolina",
  "Ohio",
  "Texas",
  "Utah",
  "Virginia",
];

async function addStatesToSanity() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not set in .env");
  }

  console.log("🚀 Starting to add states to Sanity...\n");

  // First, check if states already exist
  const existingStates = await client.fetch(
    `*[_type == "state"]{ _id, name }`
  );
  
  const existingNames = new Set(
    existingStates.map((s: any) => s.name)
  );

  console.log(`Found ${existingStates.length} existing states in Sanity\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < STATES.length; i++) {
    const stateName = STATES[i];
    const stateCode = STATE_CODES[stateName] || "";
    const order = i; // Use index as order (0-based)

    // Skip if already exists
    if (existingNames.has(stateName)) {
      console.log(`⏭️  Skipping "${stateName}" - already exists`);
      skipped++;
      continue;
    }

    try {
      const stateDoc = await client.create({
        _type: "state",
        name: stateName,
        code: stateCode || undefined, // Only include if code exists
        order: order,
        active: true,
      });

      console.log(
        `✅ Created "${stateName}"${stateCode ? ` (${stateCode})` : ""} - Order: ${order} - ID: ${stateDoc._id}`
      );
      created++;
    } catch (error: any) {
      console.error(`❌ Error creating "${stateName}":`, error.message);
      errors++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log("=".repeat(50));

  if (created > 0) {
    console.log("\n✨ States have been successfully added to Sanity!");
    console.log("   You can now manage them in Sanity Studio.");
  }
}

// Run the script
async function main() {
  try {
    await addStatesToSanity();
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  }
}

main();
