/**
 * Facebook Pixel Event Tracking Utility
 * 
 * This utility provides easy-to-use functions for tracking Facebook Pixel events.
 * All functions are safe to call even if the pixel hasn't loaded yet.
 */

declare global {
  interface Window {
    fbq: ((
      action: string,
      event: string,
      params?: Record<string, unknown>
    ) => void) & {
      q?: Array<any[]>;
    };
  }
}

/**
 * Check if Facebook Pixel is loaded and available
 */
function isPixelLoaded(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Generate a unique event ID for deduplication
 * Uses timestamp + random string to ensure uniqueness
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Track a standard Facebook Pixel event
 * 
 * @param eventName - The event name (e.g., 'Lead', 'CompleteRegistration', 'Subscribe')
 * @param params - Optional parameters to send with the event
 * @param includeEventId - Whether to include event_id for deduplication (default: true)
 * 
 * @example
 * trackEvent('Lead', { content_name: 'Contact Form' })
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
  includeEventId: boolean = true
): void {
  const eventParams = { ...params };
  
  // Add event_id for deduplication if not already present
  if (includeEventId && !eventParams.eventID) {
    eventParams.eventID = generateEventId();
  }
  
  if (isPixelLoaded()) {
    window.fbq("track", eventName, eventParams);
  } else {
    // Queue the event if pixel hasn't loaded yet
    if (typeof window !== "undefined") {
      if (!window.fbq) {
        window.fbq = function (...args: any[]) {
          (window.fbq.q = window.fbq.q || []).push(args);
        } as any;
        (window.fbq as any).q = [];
      }
      window.fbq("track", eventName, eventParams);
    }
  }
}

/**
 * Track a custom Facebook Pixel event
 * 
 * @param eventName - Custom event name
 * @param params - Optional parameters
 * 
 * @example
 * trackCustomEvent('GuideDownload', { guide_name: 'ACA Guide', category: 'Health Insurance' })
 */
export function trackCustomEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (isPixelLoaded()) {
    window.fbq("trackCustom", eventName, params || {});
  } else {
    // Queue the event if pixel hasn't loaded yet
    if (typeof window !== "undefined") {
      if (!window.fbq) {
        window.fbq = function (...args: any[]) {
          (window.fbq.q = window.fbq.q || []).push(args);
        } as any;
        (window.fbq as any).q = [];
      }
      window.fbq("trackCustom", eventName, params || {});
    }
  }
}

/**
 * Track a Lead event (when someone submits a form)
 * 
 * @param params - Additional parameters (content_name, value, currency, etc.)
 * Default value: $10 for guide downloads, $50 for quote requests
 */
export function trackLead(params?: {
  contentName?: string;
  value?: number;
  currency?: string;
  source?: string;
}): void {
  // Set default value based on source if not provided
  let value = params?.value;
  if (value === undefined) {
    if (params?.source === "consumer_guides" || params?.source === "blog_post") {
      value = 10; // Guide downloads
    } else {
      value = 50; // Quote requests / contact forms
    }
  }
  
  trackEvent("Lead", {
    content_name: params?.contentName,
    value: value,
    currency: params?.currency || "USD",
    source: params?.source,
  });
}

/**
 * Track a CompleteRegistration event (newsletter signup, account creation)
 * 
 * @param params - Additional parameters
 */
export function trackCompleteRegistration(params?: {
  contentName?: string;
  status?: string;
  source?: string;
}): void {
  trackEvent("CompleteRegistration", {
    content_name: params?.contentName,
    status: params?.status,
    source: params?.source,
  });
}

/**
 * Track a Subscribe event (newsletter subscription)
 * 
 * @param params - Additional parameters
 * Default value: $5 for newsletter subscriptions
 */
export function trackSubscribe(params?: {
  contentName?: string;
  source?: string;
  value?: number;
}): void {
  trackEvent("Subscribe", {
    content_name: params?.contentName,
    source: params?.source,
    value: params?.value ?? 5, // Default value for newsletter subscriptions
    currency: "USD",
  });
}

/**
 * Track a ViewContent event (when someone views a specific page/content)
 * 
 * @param params - Content details
 * Default value: $2 for service pages, $1 for blog posts
 */
export function trackViewContent(params?: {
  contentName?: string;
  contentCategory?: string;
  contentIds?: string[];
  value?: number;
  currency?: string;
}): void {
  // Set default value based on category if not provided
  let value = params?.value;
  if (value === undefined) {
    if (params?.contentCategory === "Service Page") {
      value = 2; // Service pages
    } else if (params?.contentCategory === "Blog Post") {
      value = 1; // Blog posts
    } else {
      value = 0; // Other content
    }
  }
  
  trackEvent("ViewContent", {
    content_name: params?.contentName,
    content_category: params?.contentCategory,
    content_ids: params?.contentIds,
    value: value,
    currency: params?.currency || "USD",
  });
}

/**
 * Track a Download event (guide downloads, PDF downloads, etc.)
 * 
 * @param params - Download details
 * Default value: $10 for guide downloads
 */
export function trackDownload(params?: {
  contentName?: string;
  contentCategory?: string;
  source?: string;
  value?: number;
}): void {
  trackEvent("Download", {
    content_name: params?.contentName,
    content_category: params?.contentCategory,
    source: params?.source,
    value: params?.value ?? 10, // Default value for guide downloads
    currency: "USD",
  });
}

/**
 * Track an InitiateCheckout event (when someone starts a checkout process)
 * 
 * @param params - Checkout details
 * Default value: $50 for quote requests
 */
export function trackInitiateCheckout(params?: {
  contentName?: string;
  value?: number;
  currency?: string;
}): void {
  trackEvent("InitiateCheckout", {
    content_name: params?.contentName,
    value: params?.value ?? 50, // Default value for quote requests
    currency: params?.currency || "USD",
  });
}
