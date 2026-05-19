import { LEAVE_BEHIND_COMPARE_MIN_HEIGHT, LEAVE_BEHIND_COMPARE_WIDTH, LEAVE_BEHIND_SINGLE_CARD_WIDTH } from "@/lib/leave-behind-assets";

/** Extra pixels so agent footer and descenders are not clipped in PNG export. */
export const LEAVE_BEHIND_SINGLE_CARD_CAPTURE_PADDING = 32;

export function measureLeaveBehindSingleCardCapture(el: HTMLElement): {
  width: number;
  height: number;
} {
  const width = LEAVE_BEHIND_SINGLE_CARD_WIDTH;
  const height =
    Math.ceil(
      Math.max(el.scrollHeight, el.offsetHeight, el.clientHeight, el.getBoundingClientRect().height)
    ) + LEAVE_BEHIND_SINGLE_CARD_CAPTURE_PADDING;

  return { width, height };
}

export function measureLeaveBehindCompareCapture(el: HTMLElement): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(el.scrollWidth, el.offsetWidth, LEAVE_BEHIND_COMPARE_WIDTH),
    height: Math.max(
      el.scrollHeight,
      el.offsetHeight,
      el.clientHeight,
      LEAVE_BEHIND_COMPARE_MIN_HEIGHT
    ),
  };
}
