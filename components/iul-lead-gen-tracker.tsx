"use client";

import { useEffect } from "react";
import { trackViewContent } from "@/lib/facebook-pixel";

/**
 * Client component to track ViewContent events on IUL lead gen landing page
 */
export default function IULLeadGenTracker() {
  useEffect(() => {
    trackViewContent({
      contentName: "IUL Lead Generation Landing Page",
      contentCategory: "Lead Generation Page",
      contentIds: ["iul_lead_gen"],
      value: 5,
    });
  }, []);

  return null; // This component doesn't render anything
}
