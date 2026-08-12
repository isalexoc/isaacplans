/**
 * Pure format validators for the intake engine. No React / DOM — safe to import on the client
 * (inline field errors) and the server (stricter completion check).
 *
 * These only flag clearly-invalid *non-empty* values. Required-but-empty is handled separately by
 * `validateForCompletion` so we never block in-progress saves.
 *
 * Ported unchanged from `lib/aca-intake/validation.ts`, which was already line-of-business
 * agnostic — only the field type changed.
 */

import type { IntakeField } from "./types";

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

/** Bank routing numbers are always 9 digits. */
export function isValidRouting(v: string): boolean {
  return digits(v).length === 9;
}

/** Card numbers run 13–19 digits depending on the network. */
export function isValidCardNumber(v: string): boolean {
  const d = digits(v);
  return d.length >= 13 && d.length <= 19;
}

/** MM/YY, a real month, not already expired. */
export function isValidCardExpiration(v: string): boolean {
  const value = (v ?? "").trim();
  const match = value.match(/^(\d{2})\s*\/?\s*(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

export function isValidCvv(v: string): boolean {
  const d = digits(v);
  return d.length === 3 || d.length === 4;
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

export type FieldErrorKey =
  | "email"
  | "phone"
  | "zip"
  | "ssn"
  | "dob"
  | "routing"
  | "card"
  | "cardExpiration"
  | "cvv";

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
    case "zip":
      return isValidZip(v) ? null : "zip";
    default:
      break;
  }

  // Payment fields are plain `text` (they are not their own types) — key off the field key.
  switch (field.key) {
    case "routingNumber":
      return isValidRouting(v) ? null : "routing";
    case "cardNumber":
      return isValidCardNumber(v) ? null : "card";
    case "cardExpiration":
      return isValidCardExpiration(v) ? null : "cardExpiration";
    case "cardCvv":
      return isValidCvv(v) ? null : "cvv";
    default:
      return null;
  }
}
