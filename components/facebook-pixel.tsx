"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { getStoredAdvancedMatchingData, prepareAdvancedMatchingData } from "@/lib/facebook-pixel";

interface FacebookPixelProps {
  pixelId: string;
}

export default function FacebookPixel({ pixelId }: FacebookPixelProps) {
  const pathname = usePathname();
  const initializedRef = useRef(false);

  // Get stored user data for advanced matching
  const advancedMatchingData = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stored = getStoredAdvancedMatchingData();
    const prepared = prepareAdvancedMatchingData(stored);
    return Object.keys(prepared).length > 0 ? prepared : null;
  }, []);

  // Initialize Facebook Pixel - Only once globally
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Use a global lock to prevent concurrent initializations
    const globalLockKey = "__fbPixelInitializing";
    if ((window as any)[globalLockKey]) {
      // Another component is initializing, wait and check again
      if (process.env.NODE_ENV === "development") {
        console.log("[Facebook Pixel] Another initialization in progress, skipping");
      }
      return;
    }
    
    // Check if pixel is already initialized globally
    const scriptExists = document.querySelector('script[src*="fbevents.js"]');
    const fbqExists = window.fbq && typeof window.fbq === "function";
    const fbqAny = window.fbq as any;
    
    // Check if init was already called for this pixel ID
    const initAlreadyCalled = (window as any).__fbPixelInitCalled === pixelId;
    
    // If script exists AND init was called, pixel is fully initialized
    // OR if script exists AND fbq is loaded (script processed the queue)
    const isFullyInitialized = scriptExists && fbqExists && (
      initAlreadyCalled || 
      (fbqAny?.loaded === true || fbqAny?.callMethod !== undefined)
    );
    
    if (isFullyInitialized) {
      // Pixel already initialized globally, mark this component as initialized
      initializedRef.current = true;
      if (process.env.NODE_ENV === "development") {
        console.log("[Facebook Pixel] Pixel already initialized, skipping init", {
          scriptInDOM: !!scriptExists,
          fbqLoaded: fbqAny?.loaded,
          callMethod: !!fbqAny?.callMethod,
          initCalled: initAlreadyCalled
        });
      }
      return;
    }

    // Don't initialize twice in the same component instance
    if (initializedRef.current) {
      (window as any)[globalLockKey] = false;
      return;
    }
    
    // Set global lock to prevent concurrent initializations
    (window as any)[globalLockKey] = true;
    
    try {
      // Helper function to insert script into DOM
      const insertScript = () => {
      const scriptUrl = "https://connect.facebook.net/en_US/fbevents.js";
      
      // Check if script already exists
      let existingScript = document.querySelector(`script[src*="fbevents.js"]`) as HTMLScriptElement;
      if (existingScript) {
        if (process.env.NODE_ENV === "development") {
          console.log("[Facebook Pixel] Script already exists in DOM");
        }
        return existingScript;
      }

      // Create and insert script
      const script = document.createElement("script");
      script.async = true;
      script.src = scriptUrl;
      script.id = "facebook-pixel-script";
      
      script.onload = () => {
        const fbqAny = window.fbq as any;
        if (fbqAny) {
          fbqAny.loaded = true;
        }
        if (process.env.NODE_ENV === "development") {
          console.log("[Facebook Pixel] Script loaded successfully");
        }
      };
      
      script.onerror = () => {
        console.error("[Facebook Pixel] Failed to load script");
      };
      
      // Insert into head - try multiple methods to ensure it works
      try {
        const firstScript = document.getElementsByTagName("script")[0];
        if (firstScript && firstScript.parentNode) {
          firstScript.parentNode.insertBefore(script, firstScript);
        } else if (document.head) {
          document.head.appendChild(script);
        } else {
          // Fallback: append to body if head doesn't exist
          document.body.appendChild(script);
        }
        
        // Verify insertion
        const verifyScript = document.querySelector(`script[src*="fbevents.js"]`);
        if (process.env.NODE_ENV === "development") {
          console.log("[Facebook Pixel] Script inserted in DOM:", !!verifyScript);
        }
        
        if (!verifyScript) {
          console.error("[Facebook Pixel] Script insertion failed - script not found in DOM");
        }
        
        return script;
      } catch (error) {
        console.error("[Facebook Pixel] Error inserting script:", error);
        return null;
      }
      };

      // Initialize fbq queue function if it doesn't exist
      if (!window.fbq) {
        const f = window;
        
        // Initialize fbq queue function (exact Facebook pattern)
        const n = (f.fbq = function(...args: any[]) {
          (n as any).callMethod
            ? (n as any).callMethod.apply(n, args)
            : (n as any).queue.push(args);
        } as any);
        
        if (!(f as any)._fbq) (f as any)._fbq = n;
        (n as any).push = n;
        (n as any).loaded = false;
        (n as any).version = "2.0";
        (n as any).queue = [];
      }

      // Insert script into DOM (only if it doesn't exist)
      const insertedScript = insertScript();
      
      // Only call init if it hasn't been called yet for this pixel ID
      if (!initAlreadyCalled) {
        // Mark that init will be called for this pixel ID BEFORE calling it
        // This prevents other components from calling init at the same time
        (window as any).__fbPixelInitCalled = pixelId;
        
        // Queue init call (only once, when first initializing)
        // This will be processed when the script loads
        if (advancedMatchingData) {
          window.fbq("init", pixelId, advancedMatchingData);
        } else {
          window.fbq("init", pixelId);
        }
        
        if (process.env.NODE_ENV === "development") {
          console.log("[Facebook Pixel] Init queued for pixel ID:", pixelId);
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log("[Facebook Pixel] Init already called for this pixel, skipping");
        }
      }

      initializedRef.current = true;

      if (process.env.NODE_ENV === "development") {
        console.log("[Facebook Pixel] Initialized with ID:", pixelId);
      }
    } catch (error) {
      console.error("[Facebook Pixel] Error during initialization:", error);
    } finally {
      // Always release the global lock
      (window as any)[globalLockKey] = false;
    }
  }, [pixelId, advancedMatchingData]);

  // Track PageView on route changes and initial load
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Function to check if script is in DOM (don't re-insert to avoid duplicates)
    const checkScriptInDOM = () => {
      if (!window.fbq || typeof window.fbq !== "function") {
        return false;
      }
      
      const scriptExists = document.querySelector('script[src*="fbevents.js"]');
      return !!scriptExists;
    };
    
    // Function to track PageView
    const trackPageView = () => {
      if (!window.fbq || typeof window.fbq !== "function") {
        return false;
      }
      
      // Check if script is in DOM (but don't re-insert to avoid duplicates)
      const scriptInDOM = checkScriptInDOM();
      
      if (!scriptInDOM && process.env.NODE_ENV === "development") {
        console.warn("[Facebook Pixel] Script not in DOM when tracking, but fbq exists - event will be queued");
      }
      
      try {
        // Call track - fbq will queue if script not loaded, or send immediately if loaded
        window.fbq("track", "PageView");
        if (process.env.NODE_ENV === "development") {
          const fbqAny = window.fbq as any;
          const scriptExists = document.querySelector('script[src*="fbevents.js"]');
          console.log("[Facebook Pixel] PageView tracked for:", pathname, {
            scriptInDOM: !!scriptExists,
            fbqLoaded: fbqAny?.loaded,
            callMethod: !!fbqAny?.callMethod,
            queueLength: fbqAny?.q?.length || 0
          });
        }
        return true;
      } catch (error) {
        console.error("[Facebook Pixel] Error tracking PageView:", error);
        return false;
      }
    };
    
    // Wait a bit before first attempt to ensure route change is complete
    const initialDelay = setTimeout(() => {
      // Try to track - fbq will handle queuing if needed
      if (trackPageView()) {
        return;
      }
      
      // If not ready, retry a few times
      let retries = 0;
      const maxRetries = 15;
      const retryInterval = 100;
      
      const retryIntervalId = setInterval(() => {
        retries++;
        if (trackPageView() || retries >= maxRetries) {
          clearInterval(retryIntervalId);
          if (retries >= maxRetries && process.env.NODE_ENV === "development") {
            const scriptExists = document.querySelector('script[src*="fbevents.js"]');
            const fbqAny = window.fbq as any;
            console.warn("[Facebook Pixel] PageView tracking failed after retries for:", pathname, {
              scriptInDOM: !!scriptExists,
              fbqExists: !!window.fbq,
              fbqLoaded: fbqAny?.loaded,
              callMethod: !!fbqAny?.callMethod
            });
          }
        }
      }, retryInterval);
    }, 300);
    
    return () => {
      clearTimeout(initialDelay);
    };
  }, [pathname]);

  if (!pixelId) {
    return null;
  }

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
