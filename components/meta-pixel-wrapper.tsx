"use client";

import { useMemo } from "react";
import MetaPixelBase from "./meta-pixel-base";
import MetaPixelPageView from "./meta-pixel-pageview";
import { getStoredAdvancedMatchingData, prepareAdvancedMatchingData } from "@/lib/facebook-pixel";

interface MetaPixelWrapperProps {
  pixelId: string;
}

export default function MetaPixelWrapper({ pixelId }: MetaPixelWrapperProps) {
  // Get stored user data for advanced matching
  const advancedMatchingData = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stored = getStoredAdvancedMatchingData();
    const prepared = prepareAdvancedMatchingData(stored);
    return Object.keys(prepared).length > 0 ? prepared : null;
  }, []);

  return (
    <>
      <MetaPixelBase pixelId={pixelId} advancedMatchingData={advancedMatchingData} />
      <MetaPixelPageView />
    </>
  );
}

