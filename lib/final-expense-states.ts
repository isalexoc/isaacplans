import {
  getStatesWithPages,
  getStatesWithPagesForBuild,
  getLicensedStates,
  stateNameToSlug,
  type FeStateInfo,
} from "@/lib/licensed-states";

export type { FeStateInfo };
export { stateNameToSlug };

// Re-export under old names so app/[locale]/final-expense/[state]/page.tsx needs no changes.
export { getStatesWithPages as getFinalExpenseStates };
export { getStatesWithPagesForBuild as getFinalExpenseStatesForBuild };

/**
 * Returns the state info for a given URL slug, or null if not an active licensed state.
 * Searches all active states so existing pages never 404 while the statePages flag is
 * being toggled in Sanity Studio.
 */
export async function getFeStateInfo(slug: string): Promise<FeStateInfo | null> {
  const states = await getLicensedStates();
  return states.find((s) => stateNameToSlug(s.name) === slug) ?? null;
}
