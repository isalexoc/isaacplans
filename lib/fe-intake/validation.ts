/**
 * Shared, pure format validators for Final Expense intake. No React / DOM — safe to import on
 * the client (inline field errors in the form) and the server (stricter completion check).
 *
 * These only flag clearly-invalid *non-empty* values. Required-but-empty is handled
 * separately by `validateForCompletion` so we never block in-progress saves.
 */

import type { FeField } from "./fields";

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

/** Title-case a person's name: "MARthA saNCHEZ" → "Martha Sanchez" (handles spaces, - and ʼ). */
export function titleCaseName(v: string): string {
  return (v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s'’-])([a-zà-öø-ÿ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
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

export type FieldErrorKey = "email" | "phone" | "zip" | "ssn" | "dob";

/**
 * Format error for a single field, or null if the value is empty or well-formed.
 * Shared by the client (→ message) and the server (→ which keys are invalid).
 */
export function fieldFormatError(field: FeField, value: string): FieldErrorKey | null {
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
    case "zip":
      return isValidZip(v) ? null : "zip";
    default:
      return null;
  }
}
