import { cache } from "react";
import { sanityFetch } from "@/sanity/lib/live";

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
 * Number of active `state` documents in Sanity (source of truth for “{states}+” copy).
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
