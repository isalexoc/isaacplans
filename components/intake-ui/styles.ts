/**
 * The intake visual language, shared between the Final Expense wizard and the IUL stepper.
 *
 * These started as private constants inside `components/fe-intake/intake-form.tsx`, where they
 * were the reason that form reads so much better than the others: 2px borders, generous radii,
 * large value text, and a brand-coloured focus border instead of a ring. Nothing about them is
 * Final-Expense-specific, so they live here now and FE imports them.
 *
 * The FE block below is copied **byte-for-byte** from the original definitions. That is the whole
 * safety argument for the extraction: the class strings are identical, so FE's rendered DOM is
 * unchanged and the restyle carries no risk of regressing a form that already works.
 *
 * Pure strings, no React — the server renderer, the admin preview and both forms can all import
 * this without pulling a component tree along.
 */

/* ─── The Final Expense set, verbatim ─────────────────────────────────────────
 *
 * Calibrated for ONE QUESTION PER SCREEN, where the question itself is the <h1> and the label is
 * a footnote. Use these on a page that asks one thing at a time — the client capture page, or FE.
 */

export const BIG_INPUT =
  "w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-lg text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

export const SMALL_INPUT =
  "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

/** Narrower padding than BIG_INPUT so 2–3 selects fit side by side on a phone. */
export const SELECT_INPUT =
  "w-full rounded-2xl border-2 border-gray-200 bg-white px-3 py-4 text-center text-base font-medium text-gray-900 focus:border-brand focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

export const SMALL_LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

export const PRIMARY_BTN =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900";

export const OUTLINE_BTN =
  "flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 px-6 py-4 text-base font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-900";

/* ─── The multi-field set ─────────────────────────────────────────────────────
 *
 * A step that shows a dozen fields at once cannot use BIG_INPUT. At `px-5 py-4 text-lg` plus a
 * `text-xs` label, the IUL personal-information step (18 fields) runs to roughly 2500px and the
 * agent scrolls MORE, not less — the opposite of the goal, which is that a client watching a
 * screen share can follow along.
 *
 * What actually buys legibility is the 2px border, the radius, and `text-lg` on the value. What
 * costs height is the padding and, counter-intuitively, the tiny label: a `text-xs` label above a
 * large input reads as a caption for something else. So these keep FE's borders and value size,
 * trim the padding, and invert the label to full size and semibold.
 */

export const FIELD_INPUT =
  "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-lg text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

/**
 * Left-aligned, unlike {@link SELECT_INPUT}. FE centres its selects because they sit in 2–3-up
 * grids (month/day/year, feet/inches) where centring balances the row; a full-width select in a
 * single column with centred text just looks broken.
 */
export const FIELD_SELECT =
  "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-lg font-medium text-gray-900 focus:border-brand focus:outline-none disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

export const FIELD_TEXTAREA = `${FIELD_INPUT} min-h-28 resize-y`;

/** The deliberate inversion of SMALL_LABEL — on a multi-field step the label IS the question. */
export const FIELD_LABEL =
  "mb-1.5 block text-base font-semibold text-gray-900 dark:text-gray-100";

/**
 * Amber rather than red, and applied to the border rather than the text.
 *
 * FE never colours an invalid input at all — it shows an amber line underneath, which works when
 * there is exactly one field on screen. With up to 18, the agent needs to *find* the bad one, so
 * the border carries the signal too. Amber because a half-typed phone number is not an error, it
 * is an unfinished thought, and red reads as "you broke something".
 */
export const INVALID_INPUT = "border-amber-400 focus:border-amber-500";

export const CARD =
  "rounded-2xl border-2 border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950";

/** The one gradient button — FE's submit, lifted out of its inline className. */
export const GRADIENT_BTN =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-accent px-6 py-4 text-base font-semibold text-white shadow-md shadow-brand/30 transition hover:opacity-95 disabled:opacity-60";
