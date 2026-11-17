/**
 * What a line's secure link can ask for, read from its config. Client-safe: the agent's panel,
 * the client's page and the server routes all read the same groups.
 */

import type { IntakeData, IntakeLobConfig, SecureCaptureGroup } from "./types";

export function captureGroups(config: IntakeLobConfig): SecureCaptureGroup[] {
  return config.secureCapture?.groups ?? [];
}

/** Every field key some group of this line may capture. */
export function captureFieldKeys(config: IntakeLobConfig): string[] {
  return Array.from(new Set(captureGroups(config).flatMap((g) => g.fieldKeys)));
}

/** Groups whose panel shows on this step. */
export function groupsForSection(config: IntakeLobConfig, sectionKey: string): SecureCaptureGroup[] {
  return captureGroups(config).filter((g) => g.sections.includes(sectionKey));
}

/** A group can be asked for once its prerequisite (the SSN/ITIN choice, the ID type) is answered. */
export function groupReady(group: SecureCaptureGroup, data: IntakeData): boolean {
  if (!group.requires) return true;
  return String(data[group.requires] ?? "").trim() !== "";
}

/** Field keys for a set of group keys, de-duplicated, unknown keys ignored. */
export function keysForGroups(config: IntakeLobConfig, groupKeys: readonly string[]): string[] {
  const wanted = new Set(groupKeys);
  return Array.from(
    new Set(captureGroups(config).filter((g) => wanted.has(g.key)).flatMap((g) => g.fieldKeys))
  );
}

/**
 * The groups a link's frozen key list covers, for display only ("waiting on: bank account"). The
 * frozen keys are the authority on what a link may write, never this.
 */
export function groupsForKeys(config: IntakeLobConfig, keys: readonly string[]): string[] {
  const have = new Set(keys);
  return captureGroups(config)
    .filter((g) => g.fieldKeys.every((k) => have.has(k)))
    .map((g) => g.key);
}
