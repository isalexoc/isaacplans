export const FE_STATE_SLUGS = [
  "arizona",
  "california",
  "colorado",
  "district-of-columbia",
  "florida",
  "georgia",
  "maryland",
  "michigan",
  "new-mexico",
  "north-carolina",
  "ohio",
  "south-carolina",
  "tennessee",
  "texas",
  "utah",
  "virginia",
] as const;

export type FeStateSlug = (typeof FE_STATE_SLUGS)[number];

export interface FeStateInfo {
  slug: FeStateSlug;
  name: string;
  code: string;
}

export const FE_STATE_MAP: Record<FeStateSlug, FeStateInfo> = {
  "arizona":              { slug: "arizona",              name: "Arizona",          code: "AZ" },
  "california":           { slug: "california",           name: "California",       code: "CA" },
  "colorado":             { slug: "colorado",             name: "Colorado",         code: "CO" },
  "district-of-columbia": { slug: "district-of-columbia", name: "Washington, D.C.", code: "DC" },
  "florida":              { slug: "florida",              name: "Florida",          code: "FL" },
  "georgia":              { slug: "georgia",              name: "Georgia",          code: "GA" },
  "maryland":             { slug: "maryland",             name: "Maryland",         code: "MD" },
  "michigan":             { slug: "michigan",             name: "Michigan",         code: "MI" },
  "new-mexico":           { slug: "new-mexico",           name: "New Mexico",       code: "NM" },
  "north-carolina":       { slug: "north-carolina",       name: "North Carolina",   code: "NC" },
  "ohio":                 { slug: "ohio",                 name: "Ohio",             code: "OH" },
  "south-carolina":       { slug: "south-carolina",       name: "South Carolina",   code: "SC" },
  "tennessee":            { slug: "tennessee",            name: "Tennessee",        code: "TN" },
  "texas":                { slug: "texas",                name: "Texas",            code: "TX" },
  "utah":                 { slug: "utah",                 name: "Utah",             code: "UT" },
  "virginia":             { slug: "virginia",             name: "Virginia",         code: "VA" },
};

export function isFeStateSlug(s: string): s is FeStateSlug {
  return (FE_STATE_SLUGS as readonly string[]).includes(s);
}

export function getFeStateInfo(slug: string): FeStateInfo | null {
  if (!isFeStateSlug(slug)) return null;
  return FE_STATE_MAP[slug];
}
