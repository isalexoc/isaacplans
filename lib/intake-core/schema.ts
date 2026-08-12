/**
 * Sanitization + completion validation for the intake engine, derived from a line of business's
 * field config.
 *
 * Autosave (PATCH) accepts any partial data — we never block in-progress saves. Completion
 * (POST .../complete) runs `validateForCompletion`, which checks required, currently-visible
 * fields (respecting `showIf`) plus repeater row integrity.
 *
 * Repeater rows are validated against their own `rowFields`, with `showIf` resolved against the
 * ROW rather than the top-level data — that is what lets a per-row branch (e.g. "has SSN?" →
 * number, else reason) enforce the right answers per person.
 *
 * Ported from `lib/aca-intake/schema.ts`; every function now takes `sections`.
 */

import { z } from "zod";
import { isFieldVisible, isRowFilled } from "./fields";
import { fieldFormatError } from "./validation";
import { isMaskedValue } from "@/lib/intake-shared/masking";
import type { IntakeData, IntakeField, IntakeSection, RepeaterRow } from "./types";

const fileRefSchema = z.object({
  url: z.string(),
  name: z.string(),
  fileId: z.string().optional(),
});

/** A repeater row: string sub-values plus FileRef[] for file sub-fields. */
const repeaterRowSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(fileRefSchema)]).optional()
);

/** Loose schema used to sanitize incoming autosave payloads. */
export const intakeDataSchema = z.record(z.string(), z.unknown());

/** Absolute cap on repeater rows when a field declares no `maxRows`. */
const DEFAULT_MAX_ROWS = 8;

export function sanitizeIntakeData(sections: IntakeSection[], input: unknown): IntakeData {
  if (!input || typeof input !== "object") return {};
  const parsed = intakeDataSchema.safeParse(input);
  const data: IntakeData = parsed.success
    ? (parsed.data as IntakeData)
    : { ...(input as Record<string, unknown>) };

  // Clamp every repeater to its declared maxRows and drop malformed rows, so a bad client
  // payload can never grow the jsonb without bound.
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type !== "repeater") continue;
      const raw = data[field.key];
      if (!Array.isArray(raw)) continue;
      data[field.key] = raw
        .filter((r) => r && typeof r === "object" && !Array.isArray(r))
        .map((r) => {
          const row = repeaterRowSchema.safeParse(r);
          return (row.success ? row.data : (r as RepeaterRow)) as RepeaterRow;
        })
        .slice(0, field.maxRows ?? DEFAULT_MAX_ROWS);
    }
  }

  return data;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

/** Rows that must be validated: every filled row, plus the first `minRows` regardless. */
export function significantRows(field: IntakeField, data: IntakeData): RepeaterRow[] {
  const raw = data[field.key];
  const rows: RepeaterRow[] = Array.isArray(raw) ? (raw as RepeaterRow[]) : [];
  const minRows = field.minRows ?? 1;
  return rows.filter((row, i) => i < minRows || isRowFilled(field, row ?? {}));
}

/**
 * Missing/invalid sub-field keys for one repeater, reported as `repeaterKey[rowIndex].subKey`
 * so the form can highlight the exact input.
 */
function repeaterMissingFields(field: IntakeField, data: IntakeData): string[] {
  const missing: string[] = [];
  const rows = significantRows(field, data);
  const minRows = field.minRows ?? 1;

  // `minRows` is itself the requirement: a visible repeater with too few rows is incomplete,
  // whether or not the field carries `required`. (The gate that hides it — e.g. "no dependents" —
  // is what makes the whole block optional.)
  if (rows.length < minRows) {
    missing.push(field.key);
    return missing;
  }

  rows.forEach((row, index) => {
    const rowData = (row ?? {}) as RepeaterRow;
    for (const sub of field.rowFields ?? []) {
      // showIf resolves against the ROW — this is what drives per-person branches.
      if (!isFieldVisible(sub, rowData as Record<string, unknown>)) continue;

      const path = `${field.key}[${index}].${sub.key}`;

      if (sub.type === "file") {
        const files = rowData[sub.key];
        if (sub.required && (!Array.isArray(files) || files.length === 0)) missing.push(path);
        continue;
      }

      const value = str(rowData[sub.key]);
      if (sub.required && !value) {
        missing.push(path);
        continue;
      }
      if (value && !isMaskedValue(value) && fieldFormatError(sub, value)) missing.push(path);
    }
  });

  return missing;
}

export type CompletionCheck = {
  ok: boolean;
  /** Field keys, or `repeaterKey[i].subKey` paths, that are required but empty/invalid. */
  missing: string[];
  message?: string;
};

/**
 * Required/format-invalid field keys for a single section (respects conditional visibility).
 * Used both for whole-form completion and to gate a client's step-by-step progression.
 */
export function sectionMissingFields(section: IntakeSection, data: IntakeData): string[] {
  const missing: string[] = [];
  for (const field of section.fields) {
    if (!isFieldVisible(field, data)) continue;

    if (field.type === "repeater") {
      missing.push(...repeaterMissingFields(field, data));
      continue;
    }

    if (field.type === "file") {
      const files = data[field.key];
      if (field.required && (!Array.isArray(files) || files.length === 0)) missing.push(field.key);
      continue;
    }

    const value = str(data[field.key]);

    // Required-but-empty.
    if (field.required && !value) {
      missing.push(field.key);
      continue;
    }

    // Present but clearly malformed (email/phone/zip/ssn/dob/routing/card).
    if (value && !isMaskedValue(value) && fieldFormatError(field, value)) missing.push(field.key);
  }
  return missing;
}

/** Required-field check used at completion time. Respects conditional visibility. */
export function validateForCompletion(sections: IntakeSection[], data: IntakeData): CompletionCheck {
  const missing: string[] = [];
  for (const section of sections) {
    if (section.ownerOnly) continue; // agent notes never block a client submission
    missing.push(...sectionMissingFields(section, data));
  }

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length ? "Some required fields are still empty." : undefined,
  };
}
