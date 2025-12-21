"use client";

import { useEffect } from "react";
import { trackViewContent } from "@/lib/facebook-pixel";

interface ServicePageTrackerProps {
  serviceName: string;
  serviceCategory: string;
}

/**
 * Client component to track ViewContent events on service pages
 * Should be placed at the top of service page components
 */
export default function ServicePageTracker({
  serviceName,
  serviceCategory,
}: ServicePageTrackerProps) {
  useEffect(() => {
    trackViewContent({
      contentName: serviceName,
      contentCategory: "Service Page",
      contentIds: [serviceCategory],
    });
  }, [serviceName, serviceCategory]);

  return null; // This component doesn't render anything
}
