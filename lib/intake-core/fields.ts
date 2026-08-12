/**
 * Config-driven helpers over the intake field DSL.
 *
 * Same functions `lib/aca-intake/fields.ts` exposes, except each takes the sections it should walk
 * instead of closing over one line of business's constant. Results are memoized per section array
 * (configs are module-level singletons, so the identity check is stable and free).
 */

import type { IntakeField, IntakeSection, RepeaterRow } from "./types";

/** Sections a given role should see/step through (clients skip owner-only sections). */
export function visibleSections(sections: IntakeSection[], isOwner: boolean): IntakeSection[] {
  if (isOwner) return sections;
  return sections.filter((s) => !s.ownerOnly);
}

/** Build an empty row for a repeater field (every declared sub-field present and blank). */
export function emptyRow(field: IntakeField): RepeaterRow {
  const row: RepeaterRow = {};
  for (const sub of field.rowFields ?? []) {
    row[sub.key] = sub.type === "file" ? [] : "";
  }
  return row;
}

const flatCache = new WeakMap<IntakeSection[], IntakeField[]>();

function allFields(sections: IntakeSection[]): IntakeField[] {
  let flat = flatCache.get(sections);
  if (!flat) {
    flat = sections.flatMap((s) => s.fields);
    flatCache.set(sections, flat);
  }
  return flat;
}

/** Flat list of plain scalar fields (excludes repeaters and file uploads). */
export function allScalarFields(sections: IntakeSection[]): IntakeField[] {
  return allFields(sections).filter((f) => f.type !== "repeater" && f.type !== "file");
}

/** All top-level file-upload fields, keyed for the files API / CRM media sync. */
export function allFileFields(sections: IntakeSection[]): IntakeField[] {
  return allFields(sections).filter((f) => f.type === "file");
}

/** All repeater fields, in section order. */
export function allRepeaterFields(sections: IntakeSection[]): IntakeField[] {
  return allFields(sections).filter((f) => f.type === "repeater");
}

export function fieldByKey(sections: IntakeSection[], key: string): IntakeField | undefined {
  return allFields(sections).find((f) => f.key === key);
}

/** A sub-field inside a repeater row, e.g. rowFieldByKey(s, "dependents", "ssn"). */
export function rowFieldByKey(
  sections: IntakeSection[],
  repeaterKey: string,
  rowFieldKey: string
): IntakeField | undefined {
  const repeater = fieldByKey(sections, repeaterKey);
  if (!repeater || repeater.type !== "repeater") return undefined;
  return repeater.rowFields?.find((f) => f.key === rowFieldKey);
}

/**
 * True when a field's showIf condition is satisfied by the given data.
 * Inside a repeater, pass the ROW object so conditions resolve against sibling sub-fields.
 */
export function isFieldVisible(field: IntakeField, data: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const current = data[field.showIf.field];
  const expected = field.showIf.equals;
  if (Array.isArray(expected)) return expected.includes(String(current ?? ""));
  return String(current ?? "") === expected;
}

/** A row counts as "filled" when any non-file sub-field has a value. */
export function isRowFilled(field: IntakeField, row: RepeaterRow): boolean {
  for (const sub of field.rowFields ?? []) {
    if (sub.type === "file") continue;
    const v = row[sub.key];
    if (typeof v === "string" && v.trim()) return true;
  }
  return false;
}

/** `[repeaterKey, [sensitive sub-field keys]]` pairs — drives encryption and masking walks. */
export function sensitiveRowKeys(sections: IntakeSection[]): Array<[string, string[]]> {
  return allRepeaterFields(sections)
    .map((f): [string, string[]] => [
      f.key,
      (f.rowFields ?? []).filter((sub) => sub.sensitive).map((sub) => sub.key),
    ])
    .filter(([, subKeys]) => subKeys.length > 0);
}

/** Top-level sensitive scalar field keys. */
export function sensitiveScalarKeys(sections: IntakeSection[]): string[] {
  return allScalarFields(sections)
    .filter((f) => f.sensitive)
    .map((f) => f.key);
}
