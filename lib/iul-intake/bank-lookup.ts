/**
 * Given a routing number, name the bank — so whoever just typed it can confirm it is theirs.
 *
 * This is the reassurance half of the routing-number story. The agent-side lookup goes the other
 * way (bank + state → number); this one closes the loop: nine digits go in, "Bank of America,
 * N.A., CA" comes back, and the person typing sees the system recognised their bank. It catches a
 * transposed digit that still happens to pass the checksum, and it makes the page feel like it
 * knows what it is doing.
 *
 * ─── On the provider ───
 *
 * bankrouting.io: free, no key, backed by the Federal Reserve directory. Verified against real
 * numbers — 021000021 returns JPMorgan Chase NY, 121000358 returns Bank of America CA, and an
 * invalid checksum is rejected rather than guessed at.
 *
 * Its coverage is partial (~7,700 institutions against the Fed's full file), so some legitimate
 * numbers come back not-found — 111000025, a real Bank of America Texas number, is one. That is
 * why a miss must render as *nothing at all* rather than a warning: telling a client their real
 * routing number "was not found" would be worse than staying quiet.
 *
 * ─── On privacy ───
 *
 * The call is made server-side, never from the client's browser, and only the nine digits leave.
 * A routing number is public information — it is printed on every cheque and published by the Fed
 * — so this discloses "somebody looked up this bank", not who they are. The SSN and the account
 * number never go anywhere near it.
 */

import "server-only";
import { isValidRouting } from "./validation";

export type BankInfo = { bankName: string; city: string; state: string };

const ENDPOINT = "https://bankrouting.io/api/v1/aba";

/**
 * Routing numbers are effectively immutable, so anything found stays found.
 *
 * This matters more than a normal cache: the provider is free and rate-limited per IP, and in
 * production that IP is *our server*, shared by every client filling a form. Repeat lookups of the
 * big banks would otherwise burn the allowance for everyone.
 */
const cache = new Map<string, BankInfo | null>();
/** Bounded so a long-lived instance cannot grow this without limit. */
const MAX_CACHE = 500;

/**
 * Title-case a CITY only. Safe because city names have no brand casing to destroy.
 *
 * The BANK NAME is deliberately left exactly as the Federal Reserve directory publishes it, in
 * capitals. Every attempt to prettify it mangles something: the source is entirely uppercase, so
 * nothing distinguishes the initialism "NA" from the preposition "OF", and title-casing turns
 * JPMORGAN into "Jpmorgan". Capitals are also how the name appears on the client's own statement,
 * which makes it read as more official rather than less.
 */
function titleCaseCity(raw: string): string {
  return raw
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Look up the institution behind a routing number.
 *
 * Returns null for anything not confidently known — a bad checksum, an unknown number, a provider
 * outage. Every caller treats null as "show nothing".
 */
export async function lookupBankByRouting(routingNumber: string): Promise<BankInfo | null> {
  const digits = (routingNumber ?? "").replace(/\D/g, "");
  // Check locally first: no point spending a rate-limited request on a number that cannot exist.
  if (!isValidRouting(digits)) return null;

  if (cache.has(digits)) return cache.get(digits) ?? null;

  let result: BankInfo | null = null;
  try {
    const res = await fetch(`${ENDPOINT}/${digits}`, {
      // Somebody is mid-form on a phone; a hanging lookup is worse than no bank name.
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        status?: string;
        data?: { bank_name?: unknown; city?: unknown; state?: unknown };
      };
      const name = typeof json?.data?.bank_name === "string" ? json.data.bank_name.trim() : "";
      if (json?.status === "success" && name) {
        result = {
          bankName: name,
          city: typeof json.data?.city === "string" ? titleCaseCity(json.data.city) : "",
          state: typeof json.data?.state === "string" ? json.data.state.trim().toUpperCase() : "",
        };
      }
    }
  } catch {
    // Network trouble: don't cache a miss that was really an outage, so the next try can succeed.
    return null;
  }

  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(digits, result);
  return result;
}
