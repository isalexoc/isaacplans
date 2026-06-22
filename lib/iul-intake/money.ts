/**
 * Currency helpers for IUL intake dollar fields. Inputs behave like an ATM/calculator:
 * digits fill from the right (1 → $0.01, 10 → $0.10, 100 → $1.00 …). Stored canonical form
 * is a plain dollar string with 2 decimals (e.g. "1000.00"), which the CRM MONETORY field
 * accepts. Older whole-dollar values (e.g. "50000") still render correctly because display
 * parses the stored value as dollars, not cents.
 */

/** Map raw keystrokes (any string) → canonical "dollars.cents" by treating digits as cents. */
export function digitsToStored(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "").slice(0, 14);
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2);
}

/** Format a stored dollar string for display, with thousands separators and 2 decimals. */
export function formatMoneyDisplay(stored: string): string {
  const s = (stored ?? "").trim();
  if (!s) return "";
  const n = Number(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
