/**
 * GHL (Agent CRM) custom-field id map for the IUL get-covered (Meta ads) Step-2 quiz.
 *
 * IDs start empty ("") and are filled in by `scripts/create-iul-step2-fields.ts`
 * (`pnpm iul:step2-fields`), which creates each field inside the "IUL Step 2 Ads Form"
 * folder and rewrites this file.
 *
 * An empty id means the field has not been provisioned yet; the Step-2 save endpoint
 * skips that field (and logs) so the app still builds/runs before the script is executed.
 * Per-field env overrides (`AGENT_CRM_CUSTOM_FIELD_IUL_S2_*`) take precedence when set.
 *
 * Two answers deliberately have NO custom field — they go to native contact fields so they
 * also drive CRM segmentation and automation:
 *   - state → native `state` (+ derived `timezone`)
 *   - email → native `email` (captured on the LAST quiz step; Step 1 is phone-only)
 */

export type IulStep2FieldSlug =
  | "iul_s2_age"
  | "iul_s2_retirement_timeline"
  | "iul_s2_monthly_savings"
  | "iul_s2_call_time";

/** GHL custom-field folder that groups all IUL Step-2 ads fields. Set by the provisioning script. */
export const iulStep2FolderId = "FYCxx4vnSJranT6mRexW";

export const iulStep2FieldIds: Record<IulStep2FieldSlug, string> = {
  iul_s2_age: "OssicR5p76fhCJ33ffuZ",
  iul_s2_retirement_timeline: "zyID3z4a30eAVGObluts",
  iul_s2_monthly_savings: "m614d9NL5N5ZV9QCA0xY",
  iul_s2_call_time: "bciIJfx3QBiZ1Nm8M6pb",
};

/** Optional per-field env overrides (set in .env to skip the live lookup / script). */
const ENV_OVERRIDES: Record<IulStep2FieldSlug, string | undefined> = {
  iul_s2_age: process.env.AGENT_CRM_CUSTOM_FIELD_IUL_S2_AGE_ID,
  iul_s2_retirement_timeline:
    process.env.AGENT_CRM_CUSTOM_FIELD_IUL_S2_RETIREMENT_TIMELINE_ID,
  iul_s2_monthly_savings: process.env.AGENT_CRM_CUSTOM_FIELD_IUL_S2_MONTHLY_SAVINGS_ID,
  iul_s2_call_time: process.env.AGENT_CRM_CUSTOM_FIELD_IUL_S2_CALL_TIME_ID,
};

/** Resolve a Step-2 custom field id: env override first, then the provisioned config id. */
export function getIulStep2FieldId(slug: IulStep2FieldSlug): string {
  const fromEnv = ENV_OVERRIDES[slug]?.trim();
  if (fromEnv) return fromEnv;
  return iulStep2FieldIds[slug] || "";
}
