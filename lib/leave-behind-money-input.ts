/** Whole-dollar and premium (2-decimal) input helpers for leave-behind forms. */

/** Strip to digits only (stored value for whole-dollar coverage). */
export function parseWholeDollarInput(display: string): string {
  return display.replace(/\D/g, "");
}

/** Format whole dollars with grouping while typing, e.g. 10000 → 10,000 */
export function formatWholeDollarDisplay(storedDigits: string): string {
  if (!storedDigits) return "";
  const n = parseInt(storedDigits, 10);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US");
}

/** Allow digits and one decimal point, max 2 fraction digits (stored canonical form). */
export function sanitizePremiumInput(value: string): string {
  const normalized = value.replace(/[,·\u00B7\u2022]/g, ".");
  const cleaned = normalized.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]}.${(parts[1] ?? "").slice(0, 2)}`;
}

/** Parse premium string to number for calculations. */
export function parsePremiumAmount(value: string): number {
  const n = parseFloat(sanitizePremiumInput(value));
  return Number.isFinite(n) ? n : 0;
}

/** Format premium for display in inputs (up to 2 decimals while typing). */
export function formatPremiumDisplay(value: string): string {
  return sanitizePremiumInput(value);
}

/** On blur, normalize to two decimal places (e.g. 45 → 45.00, 69.7 → 69.70). */
export function normalizePremiumOnBlur(value: string): string {
  const trimmed = sanitizePremiumInput(value).trim();
  if (!trimmed) return "";
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format premium for quote image (always 2 decimals). */
export function formatPremiumForQuote(value: string): string {
  const n = parsePremiumAmount(value);
  if (n <= 0) return "";
  return n.toFixed(2);
}
