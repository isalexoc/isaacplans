/**
 * Best-effort US IANA timezone from a lead's state + ZIP, for GHL's contact `timezone` field
 * (verified: PUT {"timezone":"America/New_York"} sticks). Used to drive scheduling/automations.
 *
 * Single-timezone states map directly. The states that span two zones are refined by ZIP where the
 * boundary is clean; a few messy boundaries (e.g. far-west KS/NE, SW ND) fall back to the state's
 * dominant zone. Returns null when we can't determine it — better to leave it unset than to set a
 * wrong appointment time.
 */

const EASTERN = "America/New_York";
const CENTRAL = "America/Chicago";
const MOUNTAIN = "America/Denver";
const ARIZONA = "America/Phoenix"; // Mountain, but no DST
const PACIFIC = "America/Los_Angeles";
const ALASKA = "America/Anchorage";
const HAWAII = "Pacific/Honolulu";

/** States that sit entirely in one timezone (ND kept here — its tiny SW Mountain corner is ignored). */
const STATE_TZ: Record<string, string> = {
  CT: EASTERN, DE: EASTERN, DC: EASTERN, GA: EASTERN, MA: EASTERN, MD: EASTERN,
  ME: EASTERN, NH: EASTERN, NJ: EASTERN, NY: EASTERN, NC: EASTERN, OH: EASTERN,
  PA: EASTERN, RI: EASTERN, SC: EASTERN, VT: EASTERN, VA: EASTERN, WV: EASTERN,
  AL: CENTRAL, AR: CENTRAL, IL: CENTRAL, IA: CENTRAL, LA: CENTRAL, MN: CENTRAL,
  MS: CENTRAL, MO: CENTRAL, OK: CENTRAL, WI: CENTRAL, ND: CENTRAL,
  CO: MOUNTAIN, MT: MOUNTAIN, NM: MOUNTAIN, UT: MOUNTAIN, WY: MOUNTAIN,
  CA: PACIFIC, WA: PACIFIC, NV: PACIFIC,
  AZ: ARIZONA, AK: ALASKA, HI: HAWAII,
};

const SPLIT_STATES = new Set(["FL", "TX", "TN", "KY", "IN", "MI", "ID", "OR", "SD", "NE", "KS"]);

/** far-west KS counties (Mountain); everything else in KS is Central. */
const KS_MOUNTAIN_ZIPS = new Set([
  "67735", "67741", "67744", "67745", "67748", "67749", "67751", "67756",
  "67757", "67758", "67764", "67779", "67878", "67879",
]);

function splitStateTz(state: string, zip3: number | null, zip5: string | null): string | null {
  switch (state) {
    case "FL": // Eastern except the western panhandle (Panama City 324, Pensacola/Destin 325)
      return zip3 === 324 || zip3 === 325 ? CENTRAL : EASTERN;
    case "TX": // Central except far-west El Paso / Hudspeth (798, 799)
      return zip3 === 798 || zip3 === 799 ? MOUNTAIN : CENTRAL;
    case "TN": // East TN Eastern (373–379); west/middle Central
      return zip3 !== null && zip3 >= 373 && zip3 <= 379 ? EASTERN : CENTRAL;
    case "KY": // Western KY Central (Paducah/Bowling Green/Owensboro 420–426); rest Eastern
      return zip3 !== null && zip3 >= 420 && zip3 <= 426 ? CENTRAL : EASTERN;
    case "IN": // NW (Gary 463/464) & SW (Evansville 477) Central; rest Eastern
      return zip3 === 463 || zip3 === 464 || zip3 === 477 ? CENTRAL : EASTERN;
    case "MI": // 4 western UP counties Central (Iron Mountain/Menominee 498); rest Eastern
      return zip3 === 498 ? CENTRAL : EASTERN;
    case "ID": // Northern panhandle Pacific (Lewiston 835, Coeur d'Alene 838); rest Mountain
      return zip3 === 835 || zip3 === 838 ? PACIFIC : MOUNTAIN;
    case "OR": // Malheur County Mountain (Ontario area 979); rest Pacific
      return zip3 === 979 ? MOUNTAIN : PACIFIC;
    case "SD": // West-river Mountain (Rapid City/Black Hills 577); rest Central
      return zip3 === 577 ? MOUNTAIN : CENTRAL;
    case "NE": // Western panhandle Mountain (Scottsbluff 693); rest Central
      return zip3 === 693 ? MOUNTAIN : CENTRAL;
    case "KS": // Far-west counties Mountain; rest Central
      return zip5 && KS_MOUNTAIN_ZIPS.has(zip5) ? MOUNTAIN : CENTRAL;
    default:
      return null;
  }
}

/**
 * Resolve an IANA timezone from a 2-letter state (+ optional ZIP). The lead parser normalizes full
 * state names to 2-letter codes, so we require that here; returns null if we can't be confident.
 */
export function resolveTimezone(state?: string | null, postalCode?: string | null): string | null {
  const st = (state ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(st)) return null;

  const digits = (postalCode ?? "").replace(/\D/g, "");
  const zip5 = digits.length >= 5 ? digits.slice(0, 5) : null;
  const zip3 = digits.length >= 3 ? Number.parseInt(digits.slice(0, 3), 10) : null;

  if (SPLIT_STATES.has(st)) return splitStateTz(st, zip3, zip5);
  return STATE_TZ[st] ?? null;
}
