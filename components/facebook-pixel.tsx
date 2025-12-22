"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { getStoredAdvancedMatchingData, prepareAdvancedMatchingData } from "@/lib/facebook-pixel";

declare global {
  interface Window {
    fbq: ((
      action: string,
      event: string,
      params?: Record<string, unknown>
    ) => void) & {
      q?: Array<any[]>;
      loaded?: boolean;
    };
  }
}

interface FacebookPixelProps {
  pixelId: string;
}

export default function FacebookPixel({ pixelId }: FacebookPixelProps) {
  const pathname = usePathname();
  const isInitialMount = useRef(true);
  const pixelLoaded = useRef(false);

  // Get stored user data for advanced matching
  const advancedMatchingData = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stored = getStoredAdvancedMatchingData();
    const prepared = prepareAdvancedMatchingData(stored);
    // Only return if we have at least one field
    return Object.keys(prepared).length > 0 ? prepared : null;
  }, []);

  // Track page views on route changes (but not on initial load - handled by script)
  useEffect(() => {
    // Skip initial page view (handled by script)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Wait for pixel to be ready before tracking
    const trackPageView = () => {
      if (typeof window !== "undefined" && window.fbq && pixelLoaded.current) {
        try {
          window.fbq("track", "PageView");
        } catch (error) {
          console.error("[Facebook Pixel] Error tracking PageView:", error);
        }
      } else {
        // Retry after a short delay if pixel isn't ready
        setTimeout(trackPageView, 100);
      }
    };

    trackPageView();
  }, [pathname]);

  // Monitor pixel loading status
  useEffect(() => {
    const checkPixelLoaded = setInterval(() => {
      if (typeof window !== "undefined" && window.fbq && typeof window.fbq === "function") {
        if (window.fbq.loaded) {
          pixelLoaded.current = true;
          clearInterval(checkPixelLoaded);
        }
      }
    }, 100);

    // Cleanup after 10 seconds
    setTimeout(() => clearInterval(checkPixelLoaded), 10000);

    return () => clearInterval(checkPixelLoaded);
  }, []);

  if (!pixelId) {
    return null;
  }

  // Build the init call with advanced matching data if available
  const initCall = advancedMatchingData
    ? `fbq('init', '${pixelId}', ${JSON.stringify(advancedMatchingData)});`
    : `fbq('init', '${pixelId}');`;

  return (
    <>
      {/* Facebook Pixel Code - Standard implementation */}
      <Script
        id="facebook-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            ${initCall}
          `,
        }}
        onLoad={() => {
          // Mark pixel as loaded and track PageView
          if (typeof window !== "undefined" && window.fbq) {
            pixelLoaded.current = true;
            if (window.fbq) {
              window.fbq.loaded = true;
            }
            // Small delay to ensure pixel is fully initialized
            setTimeout(() => {
              if (window.fbq && typeof window.fbq === "function") {
                try {
                  window.fbq("track", "PageView");
                  if (process.env.NODE_ENV === "development") {
                    console.log("[Facebook Pixel] Initialized and PageView tracked");
                  }
                } catch (error) {
                  console.error("[Facebook Pixel] Error tracking PageView:", error);
                }
              }
            }, 100);
          }
        }}
        onError={(e) => {
          console.error("[Facebook Pixel] Script load error:", e);
        }}
      />
      {/* Noscript fallback for users with JavaScript disabled */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
