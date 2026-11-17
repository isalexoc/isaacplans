"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isPrivatePagePath } from "@/lib/private-pages";

export default function MetaPixelPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.fbq !== "function") return;
    // A client's data page (its URL is a credential): never reported, even after a client-side
    // navigation from a page where the Pixel did load.
    if (isPrivatePagePath(pathname)) return;

    // Small delay to ensure route change is complete
    const timeoutId = setTimeout(() => {
      window.fbq("track", "PageView");
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}
