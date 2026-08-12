/**
 * Registry of every line of business served by the shared intake engine.
 *
 * ACA, IUL and Final Expense are deliberately absent: they predate this engine, run on their own
 * tables and `/api/<x>-intake` routes, and work. They can migrate here later; nothing forces it.
 *
 * Client-safe — the generic form component resolves its config from here in the browser.
 */

import type { LobSlug } from "@/lib/lob/registry";
import type { IntakeLobConfig } from "@/lib/intake-core/types";
import { shortTermMedicalIntake } from "./short-term-medical";
import { dentalVisionIntake } from "./dental-vision";
import { hospitalIndemnityIntake } from "./hospital-indemnity";
import { lifeInsuranceIntake } from "./life-insurance";
import { healthAlternativeIntake } from "./health-alternative";

/** Lines of business the engine serves, in dashboard order. */
export const ENGINE_INTAKE_CONFIGS: IntakeLobConfig[] = [
  shortTermMedicalIntake,
  dentalVisionIntake,
  hospitalIndemnityIntake,
  lifeInsuranceIntake,
  healthAlternativeIntake,
];

const BY_LOB = new Map<string, IntakeLobConfig>(ENGINE_INTAKE_CONFIGS.map((c) => [c.lob, c]));

/** Slugs the engine handles — the valid values of the `[lob]` route segment. */
export const ENGINE_INTAKE_LOBS: LobSlug[] = ENGINE_INTAKE_CONFIGS.map((c) => c.lob);

/** Config for a line of business, or undefined for an unknown/legacy slug (route → 404). */
export function getIntakeConfig(lob: string): IntakeLobConfig | undefined {
  return BY_LOB.get(lob);
}

/** Throwing variant for call sites that have already validated the slug. */
export function requireIntakeConfig(lob: string): IntakeLobConfig {
  const config = BY_LOB.get(lob);
  if (!config) throw new Error(`No intake config registered for "${lob}".`);
  return config;
}

export {
  shortTermMedicalIntake,
  dentalVisionIntake,
  hospitalIndemnityIntake,
  lifeInsuranceIntake,
  healthAlternativeIntake,
};
