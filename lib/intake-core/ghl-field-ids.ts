/**
 * Agent CRM (GHL) custom-field id lookup for the intake engine.
 *
 * GHL identifies custom fields by opaque id, not by the readable slug the field config uses, so
 * every slug has to be resolved to an id before a contact update. The three original intakes each
 * hardcode their map in a TS file that a provisioning script rewrites with line-anchored regex
 * surgery — fragile, and it would have to be repeated per line of business. Here the script writes
 * a single JSON file instead, keyed `<lob>.<slug>`, and this module just reads it.
 *
 * An unprovisioned slug resolves to null rather than throwing: the CRM sync collects those into
 * `skippedSlugs` and logs them, so a half-provisioned line still syncs everything it can. Run
 * `pnpm intake:fields <lob>` to fill them in.
 */

import generated from "@/lib/intake-configs/ghl-field-ids.generated.json";

type FieldIdMap = Record<string, Record<string, string>>;

const MAP = generated as FieldIdMap;

/** GHL custom-field id for a slug, or null when it has not been provisioned yet. */
export function crmFieldId(lob: string, slug: string): string | null {
  const id = MAP[lob]?.[slug];
  return id && id.trim() ? id.trim() : null;
}

/** Slug of the custom field holding the client's share link, e.g. `stm_intake_link`. */
export function intakeLinkSlug(slugPrefix: string): string {
  return `${slugPrefix}_intake_link`;
}
