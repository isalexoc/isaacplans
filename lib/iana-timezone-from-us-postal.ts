import tzLookup from "tz-lookup";

type ZipcodesModule = {
  lookup: (
    zip: string,
  ) => { latitude?: number; longitude?: number; state?: string } | undefined;
};

// package has no TypeScript types
// eslint-disable-next-line @typescript-eslint/no-require-imports -- zipcodes ships without types
const zipcodes = require("zipcodes") as ZipcodesModule;

/** When ZIP lookup fails, use a single “dominant” zone per state (imperfect for split states). */
const US_STATE_DOMINANT_IANA: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
};

function stateFallbackIana(stateAbbrev: string | undefined): string | null {
  if (!stateAbbrev?.trim()) return null;
  const code = stateAbbrev.trim().toUpperCase();
  if (code.length !== 2) return null;
  return US_STATE_DOMINANT_IANA[code] ?? null;
}

/**
 * IANA zone for LeadConnector / HighLevel `timezone` on contacts.
 * Uses ZIP → lat/lon (`zipcodes`) → zone (`tz-lookup`). Falls back to a state-level default if needed.
 */
export function ianaTimezoneFromUsPostalCode(
  postalCode: string,
  stateAbbrev: string | undefined,
): string | null {
  const zip5 = postalCode.replace(/\D/g, "").slice(0, 5);
  if (zip5.length === 5) {
    const row = zipcodes.lookup(zip5);
    const lat = row?.latitude;
    const lon = row?.longitude;
    if (typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        const tz = tzLookup(lat, lon);
        if (typeof tz === "string" && tz.length > 0) return tz;
      } catch {
        /* fall through */
      }
    }
  }
  return stateFallbackIana(stateAbbrev);
}
