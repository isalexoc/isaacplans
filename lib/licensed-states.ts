import { cache } from "react";
import { sanityFetch } from "@/sanity/lib/live";
import { client } from "@/sanity/lib/client";

/** Full list of active licensed states (same filter as About / map). */
export const LICENSED_STATES_LIST_QUERY = `*[
  _type == "state"
  && active == true
]|order(order asc, name asc){
  _id,
  name,
  code,
  order
}`;

/** Cheap count for badges, metadata, and legal copy. */
export const LICENSED_STATE_COUNT_QUERY = `count(*[_type == "state" && active == true])`;

export const statesSanityFetchOptions = {
  next: {
    revalidate: 3600,
    tags: ["states"] as const,
  },
} as const;

/**
 * Full list of active licensed states for rendering any state-specific page.
 * Cached per request.
 */
export const getLicensedStates = cache(async (): Promise<FeStateInfo[]> => {
  const result = await sanityFetch({
    query: LICENSED_STATES_LIST_QUERY,
    ...statesSanityFetchOptions,
  });
  const rows = result.data as Array<{ name: string; code: string }> | null;
  return (rows ?? []).map((s) => ({
    slug: stateNameToSlug(s.name),
    name: s.name,
    code: s.code,
  }));
});

/**
 * Number of active `state` documents in Sanity (source of truth for "{states}+" copy).
 * Cached per request so layout, hero, footer, etc. share one fetch.
 */
export const getLicensedStateCount = cache(async (): Promise<number> => {
  const result = await sanityFetch({
    query: LICENSED_STATE_COUNT_QUERY,
    ...statesSanityFetchOptions,
  });
  const n = result.data;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
});

/** Derives a URL slug from a state name, e.g. "New Mexico" becomes "new-mexico". */
export function stateNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface FeStateInfo {
  slug: string;
  name: string;
  code: string;
}

/** States that have state-specific landing pages enabled for all LOBs. */
export const STATE_PAGES_QUERY = `*[
  _type == "state"
  && active == true
  && statePages == true
] | order(order asc, name asc) { _id, name, code }`;

/**
 * Active states with state-specific landing pages enabled.
 * Controls all six LOBs at once (ACA, STM, HI, DV, IUL, FE).
 * Cached per request; use in server components only.
 */
export const getStatesWithPages = cache(async (): Promise<FeStateInfo[]> => {
  const result = await sanityFetch({
    query: STATE_PAGES_QUERY,
    ...statesSanityFetchOptions,
  });
  const rows = result.data as Array<{ name: string; code: string }> | null;
  return (rows ?? []).map((s) => ({
    slug: stateNameToSlug(s.name),
    name: s.name,
    code: s.code,
  }));
});

/**
 * Same as getStatesWithPages but uses the direct Sanity client.
 * Safe to call in generateStaticParams (build-time, no request context).
 */
export async function getStatesWithPagesForBuild(): Promise<FeStateInfo[]> {
  const rows = await client.fetch<Array<{ name: string; code: string }>>(
    STATE_PAGES_QUERY
  );
  return (rows ?? []).map((s) => ({
    slug: stateNameToSlug(s.name),
    name: s.name,
    code: s.code,
  }));
}
