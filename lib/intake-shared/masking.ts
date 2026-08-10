/**
 * Sensitive-value masking for passwordless intake sessions, shared by Final Expense, ACA and IUL.
 *
 * With no sign-in, a client's browser is authenticated only by an unguessable link plus a device
 * cookie. That's strong, but it makes the browser the weakest link — so the server never sends
 * real sensitive values (SSNs, bank and card numbers) back to it. The client sees a mask proving
 * the value is on file; only the agent, authenticated through Clerk, sees the real thing.
 *
 * The round trip: `maskSensitive` on the way out, `mergePreservedSensitive` on the way back in,
 * so a returning mask never overwrites what's stored.
 *
 * Sensitive values live at two levels — top-level scalars, and sub-fields inside repeater rows
 * (each ACA household member's SSN, each IUL beneficiary's SSN) — so both walks are handled here.
 */

/** Bullet used to build masks — also the marker that identifies one coming back. */
const MASK_CHAR = "•";

/** `[repeaterKey, [sensitive sub-field keys]]`, e.g. `["householdMembers", ["ssn"]]`. */
export type SensitiveRowKeys = Array<[string, string[]]>;

type Data = Record<string, unknown>;
type Row = Record<string, unknown>;

/** True when a value is one of our masks rather than something the client actually typed. */
export function isMaskedValue(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(MASK_CHAR);
}

/** "123456789" → "•••••6789"; short values are fully masked. */
export function maskValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return MASK_CHAR.repeat(trimmed.length);
  return MASK_CHAR.repeat(trimmed.length - 4) + trimmed.slice(-4);
}

function mapRows(list: unknown, subKeys: string[], transform: (value: string) => string): Row[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.map((r) => {
    const row = { ...((r ?? {}) as Row) };
    for (const key of subKeys) {
      const v = row[key];
      if (typeof v === "string" && v !== "") row[key] = transform(v);
    }
    return row;
  });
}

/** Replace every sensitive value with a mask before sending data to a client browser. */
export function maskSensitive<T extends Data>(
  data: T,
  scalarKeys: string[],
  rowKeys: SensitiveRowKeys = []
): T {
  const out: Data = { ...data };
  for (const key of scalarKeys) {
    const value = out[key];
    if (typeof value === "string" && value !== "") out[key] = maskValue(value);
  }
  for (const [repeaterKey, subKeys] of rowKeys) {
    const rows = mapRows(out[repeaterKey], subKeys, maskValue);
    if (rows) out[repeaterKey] = rows;
  }
  return out as T;
}

/**
 * Keep the stored value whenever the client sends back a mask (or clears a field it was never
 * given). A real edit — the client types a new number — arrives as plain digits and overwrites
 * normally.
 */
export function mergePreservedSensitive<T extends Data>(
  incoming: T,
  stored: Data,
  scalarKeys: string[],
  rowKeys: SensitiveRowKeys = []
): T {
  const out: Data = { ...incoming };

  for (const key of scalarKeys) {
    const next = out[key];
    const previous = stored[key];
    if (typeof previous !== "string" || previous === "") continue;
    if (isMaskedValue(next) || next === undefined || next === "") out[key] = previous;
  }

  for (const [repeaterKey, subKeys] of rowKeys) {
    const nextRows = out[repeaterKey];
    if (!Array.isArray(nextRows)) continue;
    const storedRows = Array.isArray(stored[repeaterKey]) ? (stored[repeaterKey] as Row[]) : [];
    out[repeaterKey] = nextRows.map((r, i) => {
      const row = { ...((r ?? {}) as Row) };
      const storedRow = (storedRows[i] ?? {}) as Row;
      for (const key of subKeys) {
        const previous = storedRow[key];
        if (typeof previous !== "string" || previous === "") continue;
        const next = row[key];
        if (isMaskedValue(next) || next === undefined || next === "") row[key] = previous;
      }
      return row;
    });
  }

  return out as T;
}
