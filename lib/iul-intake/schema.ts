/**
 * Validation + shared types for IUL intake, derived from the field config.
 *
 * Autosave (PATCH) accepts any partial data — we never block in-progress saves.
 * Completion (POST .../complete) runs `validateForCompletion`, which checks required,
 * currently-visible fields (respecting `showIf`) and beneficiary integrity.
 */

import { z } from "zod";
import {
  INTAKE_SECTIONS,
  MAX_BENEFICIARIES,
  isFieldVisible,
  type Beneficiary,
} from "./fields";
import { fieldFormatError } from "./validation";

/** The shape stored in `iulIntakeSessions.data` (jsonb). */
export type IntakeData = Record<string, unknown> & {
  beneficiaries?: Beneficiary[];
};

const beneficiarySchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  relationship: z.string(),
  percent: z.string(),
  dateOfBirth: z.string(),
  ssn: z.string(),
});

/** Loose schema used to sanitize incoming autosave payloads. */
export const intakeDataSchema = z
  .record(z.string(), z.unknown())
  .and(z.object({ beneficiaries: z.array(beneficiarySchema).max(MAX_BENEFICIARIES).optional() }));

export function sanitizeIntakeData(input: unknown): IntakeData {
  if (!input || typeof input !== "object") return {};
  const parsed = intakeDataSchema.safeParse(input);
  if (parsed.success) return parsed.data as IntakeData;
  // Fall back to a shallow copy of plain values so a malformed beneficiary array
  // never blocks autosave.
  return { ...(input as Record<string, unknown>) };
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

function beneficiariesValid(data: IntakeData): { ok: boolean; reason?: string } {
  const list = Array.isArray(data.beneficiaries) ? data.beneficiaries : [];
  const filled = list.filter(
    (b) => str(b.firstName) || str(b.lastName) || str(b.percent) || str(b.ssn) || str(b.relationship)
  );
  if (filled.length === 0) return { ok: false, reason: "At least one beneficiary is required" };
  for (const b of filled) {
    if (!str(b.firstName) || !str(b.lastName) || !str(b.relationship) || !str(b.percent)) {
      return { ok: false, reason: "Each beneficiary needs name, relationship, and percentage" };
    }
  }
  return { ok: true };
}

export type CompletionCheck = {
  ok: boolean;
  /** Field keys (or "beneficiaries") that are required but empty. */
  missing: string[];
  message?: string;
};

/** Required-field check used at completion time. Respects conditional visibility. */
export function validateForCompletion(data: IntakeData): CompletionCheck {
  const missing: string[] = [];

  for (const section of INTAKE_SECTIONS) {
    for (const field of section.fields) {
      if (!isFieldVisible(field, data)) continue;

      if (field.type === "beneficiaries") {
        if (field.required) {
          const result = beneficiariesValid(data);
          if (!result.ok) missing.push("beneficiaries");
        }
        continue;
      }

      const value = str(data[field.key]);

      // Required-but-empty.
      if (field.required && !value) {
        missing.push(field.key);
        continue;
      }

      // Present but clearly malformed (email/phone/zip/ssn/routing/age/dob).
      if (value && fieldFormatError(field, value)) missing.push(field.key);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length ? "Some required fields are still empty." : undefined,
  };
}
