/**
 * Postgres "undefined_table" (SQLSTATE 42P01): the code shipped before the migration that creates
 * the table ran (`pnpm db:migrate 0046`). The tenancy reads treat it as "no agent", which is exactly
 * true then: no agent row can exist in a table that doesn't.
 *
 * Neon's driver puts the SQLSTATE on `code`; the message check and the `cause` walk cover a wrapper.
 * Pure, so the offline tests can import it.
 */
export function isMissingTableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 4; depth++) {
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (code === "42P01") return true;
    if (typeof message === "string" && /relation "[^"]+" does not exist/i.test(message)) return true;
    current = cause;
  }
  return false;
}
