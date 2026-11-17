"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isPrivatePagePath } from "@/lib/private-pages";

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
    (window as unknown as Record<string, boolean>)[`ga-disable-${gaId}`] = isPrivatePagePath(pathname);
  }, [gaId, pathname]);
  return null;
}
