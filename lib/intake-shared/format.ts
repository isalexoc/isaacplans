/**
 * Pure input-formatting helpers shared by the IUL and ACA intake forms.
 * No React / DOM — safe to import anywhere.
 */

export type IntakeLocale = "en" | "es";

export const MONTHS: Record<IntakeLocale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
};

/** Month/day/year parts → ISO "YYYY-MM-DD", or "" when the date is not a real calendar day. */
export function buildDobIso(month: string, day: string, year: string): string {
  if (!month || !day || !year) return "";
  const m = month.padStart(2, "0");
  const d = day.padStart(2, "0");
  const yNum = Number(year);
  const mNum = Number(month);
  const dNum = Number(day);
  const check = new Date(yNum, mNum - 1, dNum);
  if (
    Number.isNaN(check.getTime()) ||
    check.getFullYear() !== yNum ||
    check.getMonth() !== mNum - 1 ||
    check.getDate() !== dNum
  ) {
    return "";
  }
  return `${year}-${m}-${d}`;
}

/** ISO "YYYY-MM-DD" → month/day/year parts for the three-select DOB input. */
export function splitDobIso(value: string): { month: string; day: string; year: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? "").trim());
  if (!m) return { month: "", day: "", year: "" };
  return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) };
}

/** Progressive US phone format: digits → (305) 555-1234. */
export function formatUsPhone(value: string): string {
  let d = (value ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Progressive card expiration format: digits → MM/YY. */
export function formatCardExpiration(value: string): string {
  const d = (value ?? "").replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}
