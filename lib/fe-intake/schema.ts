/**
 * Validation + shared types for Final Expense intake, derived from the field config.
 *
 * Autosave (PATCH) accepts any partial data — we never block in-progress saves.
 * Completion (POST .../complete) runs `validateForCompletion`, which checks required,
 * currently-visible fields (respecting `showIf`) plus the medications repeater.
 */

import { z } from "zod";
import {
  FE_SECTIONS,
  isFieldVisible,
  isRowFilled,
  type FeField,
  type FeSection,
  type RepeaterRow,
} from "./fields";
import { fieldFormatError } from "./validation";

/** The shape stored in `feIntakeSessions.data` (jsonb). */
export type FeIntakeData = Record<string, unknown>;

const repeaterRowSchema = z.record(z.string(), z.string().optional());

/** Loose schema used to sanitize incoming autosave payloads. */
export const feIntakeDataSchema = z.record(z.string(), z.unknown());

export function sanitizeFeIntakeData(input: unknown): FeIntakeData {
  if (!input || typeof input !== "object") return {};
  const parsed = feIntakeDataSchema.safeParse(input);
  const data: FeIntakeData = parsed.success
    ? (parsed.data as FeIntakeData)
    : { ...(input as Record<string, unknown>) };

  // Clamp every repeater to its declared maxRows and drop malformed rows.
  for (const section of FE_SECTIONS) {
    for (const field of section.fields) {
      if (field.type !== "repeater") continue;
      const raw = data[field.key];
      if (!Array.isArray(raw)) continue;
      const rows = raw
        .filter((r) => r && typeof r === "object" && !Array.isArray(r))
        .map((r) => {
          const row = repeaterRowSchema.safeParse(r);
          return (row.success ? row.data : (r as RepeaterRow)) as RepeaterRow;
        })
        .slice(0, field.maxRows ?? 15);
      data[field.key] = rows;
    }
  }

  return data;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

/** Rows that must be validated: every filled row, plus the first `minRows` regardless. */
export function significantRows(field: FeField, data: FeIntakeData): RepeaterRow[] {
  const raw = data[field.key];
  const rows: RepeaterRow[] = Array.isArray(raw) ? (raw as RepeaterRow[]) : [];
  const minRows = field.minRows ?? 1;
  return rows.filter((row, i) => i < minRows || isRowFilled(field, row ?? {}));
}

/**
 * Missing/invalid sub-field keys for one repeater, reported as `repeaterKey[rowIndex].subKey`
 * so the form can highlight the exact input.
 */
function repeaterMissingFields(field: FeField, data: FeIntakeData): string[] {
  const missing: string[] = [];
  const rows = significantRows(field, data);
  const minRows = field.minRows ?? 1;

  if (rows.length < minRows) {
    missing.push(field.key);
    return missing;
  }

  rows.forEach((row, index) => {
    const rowData = (row ?? {}) as RepeaterRow;
    for (const sub of field.rowFields ?? []) {
      if (!isFieldVisible(sub, rowData as Record<string, unknown>)) continue;

      const path = `${field.key}[${index}].${sub.key}`;
      const value = str(rowData[sub.key]);
      if (sub.required && !value) {
        missing.push(path);
        continue;
      }
      if (value && fieldFormatError(sub, value)) missing.push(path);
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
export function sectionMissingFields(section: FeSection, data: FeIntakeData): string[] {
  const missing: string[] = [];
  for (const field of section.fields) {
    if (!isFieldVisible(field, data)) continue;

    if (field.type === "repeater") {
      missing.push(...repeaterMissingFields(field, data));
      continue;
    }

    const value = str(data[field.key]);

    if (field.required && !value) {
      missing.push(field.key);
      continue;
    }

    if (value && fieldFormatError(field, value)) missing.push(field.key);
  }
  return missing;
}

/** Required-field check used at completion time. Respects conditional visibility. */
export function validateForCompletion(data: FeIntakeData): CompletionCheck {
  const missing: string[] = [];
  for (const section of FE_SECTIONS) {
    missing.push(...sectionMissingFields(section, data));
  }

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length ? "Some required fields are still empty." : undefined,
  };
}
