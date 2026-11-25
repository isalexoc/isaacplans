/**
 * The agent dashboard's route for a line, client-safe.
 *
 * The insurance lines take it from the line-of-business registry; a line outside that registry
 * (Legal Shield is not insurance, so it has no apply page or Page Media entry) declares its own on
 * the config. Reading `LOBS[lob]` directly would crash for such a line.
 */

import { LOBS, type IntakeRoute, type LobSlug } from "@/lib/lob/registry";
import type { IntakeLobConfig } from "@/lib/intake-core/types";

export function intakeRouteOf(config: IntakeLobConfig): IntakeRoute {
  if (config.intakeRoute) return config.intakeRoute;
  const definition = LOBS[config.lob as LobSlug];
  if (!definition) throw new Error(`Intake line "${config.lob}" needs an intakeRoute on its config.`);
  return definition.intakeRoute;
}
