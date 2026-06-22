/**
 * Shared, pure format validators for IUL intake. No React / DOM — safe to import on the
 * client (inline field errors in the form) and the server (stricter completion check).
 *
 * These only flag clearly-invalid *non-empty* values. Required-but-empty is handled
 * separately by `validateForCompletion` so we never block in-progress saves.
 */

import type { IntakeField, Beneficiary } from "./fields";

const digits = (v: string): string => (v ?? "").replace(/\D/g, "");

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v ?? "").trim());
}

/** US phone: 10 digits, or 11 starting with country code 1. */
export function isValidPhone(v: string): boolean {
  const d = digits(v);
  return d.length === 10 || (d.length === 11 && d.startsWith("1"));
}

export function isValidZip(v: string): boolean {
  return /^\d{5}$/.test((v ?? "").trim());
}

export function isValidSsn(v: string): boolean {
  return digits(v).length === 9;
}

export function isValidRouting(v: string): boolean {
  return digits(v).length === 9;
}

export function isValidPercent(v: string): boolean {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

export function isValidAge(v: string): boolean {
  const n = Number((v ?? "").trim());
  return Number.isFinite(n) && n >= 0 && n <= 120;
}

const DOB_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in ISO form, not in the future, within a sane age range. */
export function isValidDob(v: string): boolean {
  const value = (v ?? "").trim();
  if (!DOB_ISO_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return false;
  }
  const now = new Date();
  if (date.getTime() > now.getTime()) return false;
  return y >= now.getFullYear() - 120;
}

export type FieldErrorKey = "email" | "phone" | "zip" | "ssn" | "routing" | "age" | "dob";

const AGE_KEYS = new Set(["fatherAge", "motherAge", "fatherAgeAtDeath", "motherAgeAtDeath"]);

/**
 * Format error for a single field, or null if the value is empty or well-formed.
 * Shared by the client (→ message) and the server (→ which keys are invalid).
 */
export function fieldFormatError(field: IntakeField, value: string): FieldErrorKey | null {
  const v = (value ?? "").trim();
  if (!v) return null;

  switch (field.type) {
    case "email":
      return isValidEmail(v) ? null : "email";
    case "tel":
      return isValidPhone(v) ? null : "phone";
    case "dob":
      return isValidDob(v) ? null : "dob";
    case "ssn":
      return isValidSsn(v) ? null : "ssn";
    default:
      break;
  }

  if (field.digitsOnly && field.maxLength === 5) return isValidZip(v) ? null : "zip";
  if (field.key === "routingNumber") return isValidRouting(v) ? null : "routing";
  if (AGE_KEYS.has(field.key)) return isValidAge(v) ? null : "age";

  return null;
}

/** Sum of percentages across filled beneficiaries (NaN-safe). */
export function beneficiaryPercentTotal(list: Beneficiary[]): number {
  return list.reduce((sum, b) => {
    const n = Number((b.percent ?? "").trim());
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}
