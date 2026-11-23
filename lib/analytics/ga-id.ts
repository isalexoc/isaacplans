/**
 * The site's Google Analytics 4 measurement id. Public: every page that loads GA ships it.
 *
 * One definition for the layout (which loads GA and its privacy guard) and for anything that has
 * to switch GA off on the page it is on.
 */
export const GA_MEASUREMENT_ID = "G-5SDTGH29ER";

/** GA's own opt-out flag: once `window[GA_DISABLE_FLAG]` is true, gtag sends nothing more. */
export const GA_DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;

/**
 * Set by `holdGaOff()`. The layout's privacy guard re-decides GA's opt-out on every path change
 * (and on mount, in whatever order effects happen to run), so a page that must keep GA off checks
 * in here and the guard never switches it back on.
 */
export const GA_HOLD_FLAG = "__gaPrivacyHold";

/** Keep GA off for the rest of this page's life, whatever the privacy guard decides later. */
export function holdGaOff(): void {
  const w = window as unknown as Record<string, boolean>;
  w[GA_HOLD_FLAG] = true;
  w[GA_DISABLE_FLAG] = true;
}
