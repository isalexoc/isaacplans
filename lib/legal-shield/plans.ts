/**
 * The one LegalShield offer Ysmael presents, and its prices.
 *
 * Isaac's choice (2026-11-24): a single package, the Preferred legal plan plus IDShield Family 3B,
 * never Basic or Premium. The agent can drop IDShield when a client can't afford the package (a
 * switch only he sees), leaving the Preferred plan alone.
 *
 * Prices are LegalShield's own, copied from its "Choose a LegalShield / IDShield Tier" windows
 * (monthly and "Annually"), not computed: annual Preferred is 10% off, annual IDShield has no
 * discount. Everything is integer cents so the totals and "per month" figures round exactly like
 * LegalShield's ($850.86 / 12 = $70.905 → $70.91). If LegalShield changes a price, change it here:
 * the form's summary note and the deck's price slide both read this file.
 *
 * Pure: no React, no server. Tested by `pnpm test:staff-access`.
 */

export type LsPackage = "preferido_idshield" | "solo_preferido";
export type LsBilling = "mensual" | "anual";

export const LS_PACKAGE_DEFAULT: LsPackage = "preferido_idshield";
export const LS_BILLING_DEFAULT: LsBilling = "mensual";

type Plan = { nameEs: string; monthlyCents: number; annualCents: number; annualPerMonthCents: number };

/** Plan Legal Preferencial ("Preferred"). */
export const LS_PREFERRED: Plan = {
  nameEs: "Plan Legal Preferencial",
  monthlyCents: 3995,
  annualCents: 43146,
  annualPerMonthCents: 3596,
};

/** IDShield Familiar 3B ("Family 3B": credit monitoring from all 3 bureaus). */
export const LS_IDSHIELD_FAMILY_3B: Plan = {
  nameEs: "IDShield Familiar (3 agencias)",
  monthlyCents: 3495,
  annualCents: 41940,
  annualPerMonthCents: 3495,
};

export function plansIn(pkg: LsPackage): Plan[] {
  return pkg === "solo_preferido" ? [LS_PREFERRED] : [LS_PREFERRED, LS_IDSHIELD_FAMILY_3B];
}

export type LsQuote = {
  /** The big number: per month, or per year when billed annually. */
  totalCents: number;
  /** Annual only: what it comes to per month (LegalShield's "just $X/mo"). */
  perMonthCents: number | null;
  /** Annual only: saved against paying monthly for a year. */
  savingsCents: number | null;
  lines: Array<{ nameEs: string; cents: number }>;
};

export function lsQuote(pkg: LsPackage, billing: LsBilling): LsQuote {
  const plans = plansIn(pkg);
  if (billing === "anual") {
    const total = plans.reduce((sum, p) => sum + p.annualCents, 0);
    const monthlyYear = plans.reduce((sum, p) => sum + p.monthlyCents * 12, 0);
    return {
      totalCents: total,
      perMonthCents: Math.round(total / 12),
      savingsCents: monthlyYear - total,
      lines: plans.map((p) => ({ nameEs: p.nameEs, cents: p.annualCents })),
    };
  }
  return {
    totalCents: plans.reduce((sum, p) => sum + p.monthlyCents, 0),
    perMonthCents: null,
    savingsCents: null,
    lines: plans.map((p) => ({ nameEs: p.nameEs, cents: p.monthlyCents })),
  };
}

/** 7490 → "$74.90". */
export function usd(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `$${whole.toLocaleString("en-US")}.${rest}`;
}

/** The stored answer, or the default when it is missing or unknown. */
export function asPackage(value: unknown): LsPackage {
  return value === "solo_preferido" ? "solo_preferido" : LS_PACKAGE_DEFAULT;
}

export function asBilling(value: unknown): LsBilling {
  return value === "anual" ? "anual" : LS_BILLING_DEFAULT;
}

/** One line for the form and the summary: "Plan Legal Preferencial + IDShield Familiar (3 agencias): $74.90 al mes". */
export function lsQuoteSentence(pkg: LsPackage, billing: LsBilling): string {
  const quote = lsQuote(pkg, billing);
  const names = quote.lines.map((l) => l.nameEs).join(" + ");
  if (billing === "anual") {
    return `${names}: ${usd(quote.totalCents)} al año (equivale a ${usd(quote.perMonthCents ?? 0)} al mes; ahorra ${usd(quote.savingsCents ?? 0)}).`;
  }
  return `${names}: ${usd(quote.totalCents)} al mes.`;
}
