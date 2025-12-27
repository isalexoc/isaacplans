"use client";

import Script from "next/script";
import React, { useEffect, useRef, useState } from "react";

interface MetaPixelBaseProps {
  pixelId: string;
  advancedMatchingData?: Record<string, unknown> | null;
}

// Global initialization lock (shared across all component instances)
const GLOBAL_INIT_LOCK = "__fbPixelGlobalInit";

export default function MetaPixelBase({ pixelId, advancedMatchingData }: MetaPixelBaseProps) {
  if (!pixelId) return null;
  
  const initAttemptedRef = useRef(false);

  // ✅ CRITICAL: Initialize pixel only once globally
  // This prevents multiple init calls even if component re-renders or mounts multiple times
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // IMMEDIATE CHECK: If already initialized, return immediately (no async waiting)
    const globalLock = (window as any)[GLOBAL_INIT_LOCK] || {};
    if (globalLock[pixelId] === true || globalLock[pixelId] === "DONE") {
      return; // Already initialized globally or in progress - exit immediately
    }
    
    // Check Meta's internal state immediately (if fbq already exists)
    const fbqAny = window.fbq as any;
    if (fbqAny && typeof fbqAny === "function") {
      // fbq exists - check if pixel is already initialized
      if (fbqAny._pixels && fbqAny._pixels[pixelId]) {
        // Already initialized - set lock and exit
        (window as any)[GLOBAL_INIT_LOCK] = { ...globalLock, [pixelId]: true };
        return;
      }
      
      // Check if init is already in queue
      if (fbqAny.q && Array.isArray(fbqAny.q)) {
        const initInQueue = fbqAny.q.some((item: any[]) => 
          item && Array.isArray(item) && item[0] === "init" && item[1] === pixelId
        );
        if (initInQueue) {
          (window as any)[GLOBAL_INIT_LOCK] = { ...globalLock, [pixelId]: true };
          return; // Init already queued
        }
      }
    }
    
    // If we get here, pixel needs to be initialized
    // Set lock IMMEDIATELY to prevent other instances from initializing
    (window as any)[GLOBAL_INIT_LOCK] = { ...globalLock, [pixelId]: true };
    initAttemptedRef.current = true;

    // Helper function to actually initialize
    const doInit = () => {
      // Final safety check before calling init
      const finalLock = (window as any)[GLOBAL_INIT_LOCK] || {};
      if (finalLock[pixelId] && finalLock[pixelId] === "DONE") {
        return; // Already initialized
      }
      
      const fbqCheck = window.fbq as any;
      if (fbqCheck && fbqCheck._pixels && fbqCheck._pixels[pixelId]) {
        // Already initialized - mark as done
        (window as any)[GLOBAL_INIT_LOCK] = { ...finalLock, [pixelId]: "DONE" };
        return;
      }
      
      try {
        if (advancedMatchingData && Object.keys(advancedMatchingData).length > 0) {
          window.fbq("init", pixelId, advancedMatchingData);
        } else {
          window.fbq("init", pixelId);
        }
        
        // Mark as done
        (window as any)[GLOBAL_INIT_LOCK] = { ...finalLock, [pixelId]: "DONE" };
        
        if (process.env.NODE_ENV === "development") {
          console.log("[Meta Pixel] Initialized pixel:", pixelId);
        }
      } catch (error) {
        // If init fails, reset lock so it can retry
        console.error("[Meta Pixel] Init failed:", error);
        const lock = (window as any)[GLOBAL_INIT_LOCK] || {};
        delete lock[pixelId];
        (window as any)[GLOBAL_INIT_LOCK] = lock;
        initAttemptedRef.current = false;
      }
    };

    // If fbq already exists, initialize immediately
    if (typeof window.fbq === "function") {
      doInit();
      return;
    }

    // Otherwise, wait for fbq to be available (pixel script loads asynchronously)
    let checkCount = 0;
    const maxChecks = 100; // 5 seconds max (50ms * 100)
    
    const checkFbq = setInterval(() => {
      checkCount++;
      
      if (typeof window.fbq === "function") {
        clearInterval(checkFbq);
        doInit();
      } else if (checkCount >= maxChecks) {
        // Timeout: stop checking and reset lock
        clearInterval(checkFbq);
        console.warn("[Meta Pixel] Timeout waiting for fbq to load");
        const lock = (window as any)[GLOBAL_INIT_LOCK] || {};
        delete lock[pixelId];
        (window as any)[GLOBAL_INIT_LOCK] = lock;
        initAttemptedRef.current = false;
      }
    }, 50);

    return () => {
      clearInterval(checkFbq);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelId]); // Only depend on pixelId - advancedMatchingData changes don't trigger re-init

  // Only render Script if it doesn't already exist in DOM
  // This prevents duplicate script tags even if component re-renders
  const [shouldRenderScript, setShouldRenderScript] = useState(() => {
    if (typeof window === "undefined") return true;
    // Check synchronously on first render
    return !document.querySelector('script[src*="fbevents.js"]');
  });

  return (
    <>
      {/* Next.js Script component with same id will only load once */}
      {shouldRenderScript && (
        <Script
          id="meta-pixel"
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
            `.trim(),
          }}
        />
      )}
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

