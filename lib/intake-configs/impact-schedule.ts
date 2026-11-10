/**
 * Impact Health Sharing's start-date and payment-day rule, and the note that explains it to the
 * client while they fill in the form.
 *
 * Coverage always starts on the 1st of a month, and the first monthly payment has to be made in
 * the month BEFORE that 1st, on the payment day the client picks (1–28). Example, on Nov 10:
 *  - start Dec 1, pay on the 15th → first payment Nov 15, coverage Dec 1. Fine.
 *  - start Dec 1, pay on the 3rd → Nov 3 has passed, so the first payment is Dec 3 and coverage
 *    can't start until Jan 1. The form says so and won't submit until one of the two changes.
 *
 * Client-safe: the form runs this live, the server runs it again at completion.
 */

import {
  addMonths,
  businessToday,
  compareYmd,
  formatLongDate,
  formatMonthDay,
  formatMonthName,
  formatMonthYear,
  isValidMonthStart,
  parseIso,
  type Ym,
  type Ymd,
} from "@/lib/intake-core/month-start";
import type { IntakeData, IntakeNote, IntakeOption } from "@/lib/intake-core/types";

/** Latest payment day Impact allows. Also the cutoff for offering next month's 1st. */
export const IMPACT_LAST_PAYMENT_DAY = 28;

/** "1st" … "28th". */
export function ordinalEn(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

export const PAYMENT_DAY_OPTIONS: IntakeOption[] = Array.from({ length: IMPACT_LAST_PAYMENT_DAY }, (_, i) => ({
  value: String(i + 1),
  labelEn: ordinalEn(i + 1),
  labelEs: `Día ${i + 1}`,
}));

type Schedule =
  /** Start chosen, payment day not yet. */
  | { kind: "pending"; start: Ymd; payMonth: Ym; payIsThisMonth: boolean; minDay: number }
  | { kind: "ok"; start: Ymd; payDay: number; firstPayment: Ymd }
  /** The payment day has already passed in the month the first payment is due. */
  | { kind: "late"; start: Ymd; payDay: number; payMonth: Ym; minDay: number; wouldPay: Ymd; wouldStart: Ymd };

/**
 * Where a start date + payment day leaves the client today. Null until there is a valid start
 * date: a missing or out-of-date start is the start field's problem, flagged there.
 */
export function impactSchedule(startIso: unknown, payDayRaw: unknown, today: Ymd = businessToday()): Schedule | null {
  const startValue = typeof startIso === "string" ? startIso : "";
  if (!isValidMonthStart(startValue, IMPACT_LAST_PAYMENT_DAY, today)) return null;
  const start = parseIso(startValue) as Ymd;

  const payMonth = addMonths(start.y, start.m, -1);
  const payIsThisMonth = payMonth.y === today.y && payMonth.m === today.m;
  // Only a first payment due this month can be squeezed by today's date.
  const minDay = payIsThisMonth ? today.d : 1;

  const payDay = Number(payDayRaw);
  if (!payDayRaw || !Number.isInteger(payDay) || payDay < 1 || payDay > IMPACT_LAST_PAYMENT_DAY) {
    return { kind: "pending", start, payMonth, payIsThisMonth, minDay };
  }

  const firstPayment = { ...payMonth, d: payDay };
  if (compareYmd(firstPayment, today) >= 0) return { kind: "ok", start, payDay, firstPayment };

  // Too late this month: the first payment slips a month, and coverage slips with it.
  return {
    kind: "late",
    start,
    payDay,
    payMonth,
    minDay,
    wouldPay: { ...addMonths(payMonth.y, payMonth.m, 1), d: payDay },
    wouldStart: { ...addMonths(start.y, start.m, 1), d: 1 },
  };
}

/** `isValid` for the payment-day field: false only for a day that can't meet the start date. */
export function isImpactPaymentDayValid(value: string, data: IntakeData): boolean {
  return impactSchedule(data.requestedEffectiveDate, value)?.kind !== "late";
}

/** The live note under the payment-day question. */
export function impactPaymentDayNote(data: IntakeData, locale: "en" | "es"): IntakeNote | null {
  const s = impactSchedule(data.requestedEffectiveDate, data.paymentDay);
  if (!s) return null;
  const es = locale === "es";
  const startLong = formatLongDate(s.start, locale);

  if (s.kind === "ok") {
    const firstLong = formatLongDate(s.firstPayment, locale);
    return {
      tone: "success",
      text: es
        ? `Primer pago: ${firstLong}. Su cobertura empieza el ${startLong}. Después, paga el día ${s.payDay} de cada mes.`
        : `First payment: ${firstLong}. Your coverage starts ${startLong}. After that, you pay on the ${ordinalEn(s.payDay)} of every month.`,
    };
  }

  const payByLong = formatMonthDay({ ...s.payMonth, d: IMPACT_LAST_PAYMENT_DAY }, locale);
  const monthName = formatMonthName(s.payMonth, locale);
  const pickRange =
    s.minDay >= IMPACT_LAST_PAYMENT_DAY
      ? es
        ? `Elija el día ${IMPACT_LAST_PAYMENT_DAY}.`
        : `Pick the ${ordinalEn(IMPACT_LAST_PAYMENT_DAY)}.`
      : es
        ? `Elija un día del ${s.minDay} al ${IMPACT_LAST_PAYMENT_DAY}.`
        : `Pick a day from ${s.minDay} to ${IMPACT_LAST_PAYMENT_DAY}.`;

  if (s.kind === "pending") {
    if (!s.payIsThisMonth) {
      const payMonthYear = formatMonthYear(s.payMonth, locale);
      return {
        tone: "info",
        text: es
          ? `Su primer pago será en ${payMonthYear}, el mes antes de que empiece su cobertura.`
          : `Your first payment will be in ${payMonthYear}, the month before your coverage starts.`,
      };
    }
    return {
      tone: "info",
      text: es
        ? `Para empezar el ${startLong}, su primer pago debe hacerse en ${monthName}, entre hoy y el ${payByLong}. ${pickRange}`
        : `To start on ${startLong}, your first payment has to be made in ${monthName}, between today and ${payByLong}. ${pickRange}`,
    };
  }

  const startShort = formatMonthDay(s.start, locale);
  const wouldPayLong = formatLongDate(s.wouldPay, locale);
  const wouldStartLong = formatLongDate(s.wouldStart, locale);
  return {
    tone: "warning",
    title: es
      ? `El día ${s.payDay} no funciona para empezar el ${startShort}`
      : `The ${ordinalEn(s.payDay)} doesn't work for a ${startShort} start`,
    text: es
      ? `Para empezar el ${startLong}, su primer pago debe hacerse en ${monthName}, a más tardar el ${payByLong}. ` +
        `Si paga el día ${s.payDay}, su primer pago sería el ${wouldPayLong} y su cobertura empezaría el ${wouldStartLong}. ` +
        `${pickRange.replace(/\.$/, "")}, o cambie su fecha de inicio al ${wouldStartLong}.`
      : `To start on ${startLong}, your first payment has to be made in ${monthName}, by ${payByLong}. ` +
        `If you pay on the ${ordinalEn(s.payDay)}, your first payment would be ${wouldPayLong}, so your coverage would start ${wouldStartLong}. ` +
        `${pickRange.replace(/\.$/, "")}, or change your start date to ${wouldStartLong}.`,
  };
}
