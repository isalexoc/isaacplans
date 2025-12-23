"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function MetaPixelPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.fbq !== "function") return;

    // Small delay to ensure route change is complete
    const timeoutId = setTimeout(() => {
      window.fbq("track", "PageView");
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}

