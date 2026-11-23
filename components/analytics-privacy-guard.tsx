"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isPrivatePagePath } from "@/lib/private-pages";
import { GA_HOLD_FLAG } from "@/lib/analytics/ga-id";

/**
 * Switches Google Analytics off while the visitor is on a private page (a client's form, a secure
 * link, /admin), using GA's own opt-out flag, `window['ga-disable-<id>']`.
 *
 * The layout already leaves GA out of a page loaded directly as private. This covers the other
 * way in: GA loaded on a public page, then a client-side navigation into a private one, where
 * GA would otherwise report the tokenized URL as a page view.
 */
export default function AnalyticsPrivacyGuard({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const w = window as unknown as Record<string, boolean>;
    // A page that called holdGaOff() (the admin's quote-image box on /impact) keeps GA off.
    w[`ga-disable-${gaId}`] = isPrivatePagePath(pathname) || w[GA_HOLD_FLAG] === true;
  }, [gaId, pathname]);
  return null;
}
