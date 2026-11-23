/**
 * The shape of an agent slug, on its own so route handlers that only look a slug up (the start
 * route, lib/tenancy/agents.ts) don't pull in `i18n/routing.ts`. The full rule, reserved words and
 * provider names included, is `checkAgentSlug` in lib/tenancy/slugs.ts. Pure.
 */

export const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

export function normalizeAgentSlug(input: unknown): string {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}
