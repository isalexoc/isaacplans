/**
 * Facebook Pixel Event Tracking Utility
 * 
 * This utility provides easy-to-use functions for tracking Facebook Pixel events.
 * All functions are safe to call even if the pixel hasn't loaded yet.
 */

declare global {
  interface Window {
    fbq: (...args: any[]) => void & {
      q?: Array<any[]>;
      loaded?: boolean;
    };
  }
}

/**
 * User data interface for advanced matching
 */
export interface AdvancedMatchingData {
  em?: string; // Email (lowercase, unhashed or SHA-256 hashed)
  fn?: string; // First name (lowercase)
  ln?: string; // Last name (lowercase)
  ph?: string; // Phone (digits only, including country code)
  external_id?: string; // External ID
  ge?: string; // Gender (f or m)
  db?: string; // Birthdate (YYYYMMDD)
  ct?: string; // City (lowercase, no spaces)
  st?: string; // State (lowercase two-letter code)
  zp?: string; // Zip code
  country?: string; // Country (lowercase two-letter code)
}

/**
 * Hash a string using SHA-256
 * Used for advanced matching when data needs to be hashed
 */
async function hashSHA256(text: string): Promise<string> {
  // Use Web Crypto API if available (browser)
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  
  // Fallback: return original text (shouldn't happen in browser)
  return text;
}

/**
 * Normalize and prepare user data for advanced matching
 * - Lowercases emails, names, cities
 * - Removes spaces from cities
 * - Formats phone numbers (digits only)
 */
export function prepareAdvancedMatchingData(
  data: Partial<AdvancedMatchingData>
): Partial<AdvancedMatchingData> {
  const prepared: Partial<AdvancedMatchingData> = {};

  if (data.em) {
    // Email: lowercase, pixel will hash automatically if unhashed
    prepared.em = data.em.toLowerCase().trim();
  }

  if (data.fn) {
    // First name: lowercase
    prepared.fn = data.fn.toLowerCase().trim();
  }

  if (data.ln) {
    // Last name: lowercase
    prepared.ln = data.ln.toLowerCase().trim();
  }

  if (data.ph) {
    // Phone: digits only
    prepared.ph = data.ph.replace(/\D/g, "");
  }

  if (data.ct) {
    // City: lowercase, no spaces
    prepared.ct = data.ct.toLowerCase().replace(/\s+/g, "");
  }

  if (data.st) {
    // State: lowercase
    prepared.st = data.st.toLowerCase().trim();
  }

  if (data.country) {
    // Country: lowercase
    prepared.country = data.country.toLowerCase().trim();
  }

  // Pass through other fields as-is
  if (data.external_id) prepared.external_id = data.external_id;
  if (data.ge) prepared.ge = data.ge.toLowerCase();
  if (data.db) prepared.db = data.db;
  if (data.zp) prepared.zp = data.zp;

  return prepared;
}

/**
 * Update Facebook Pixel with user data for advanced matching
 * Call this when you have user information (e.g., after form submission)
 * 
 * @param userData - User data for advanced matching
 */
export async function updateAdvancedMatching(
  userData: Partial<AdvancedMatchingData>
): Promise<void> {
  if (typeof window === "undefined") return;

  const prepared = prepareAdvancedMatchingData(userData);

  // Store in localStorage for future page loads
  if (prepared.em) {
    localStorage.setItem("fb_am_email", prepared.em);
  }
  if (prepared.fn) {
    localStorage.setItem("fb_am_fn", prepared.fn);
  }
  if (prepared.ln) {
    localStorage.setItem("fb_am_ln", prepared.ln);
  }
  if (prepared.ph) {
    localStorage.setItem("fb_am_ph", prepared.ph);
  }

  // If pixel is already loaded, update it
  if (isPixelLoaded() && Object.keys(prepared).length > 0) {
    // Note: Advanced matching data should ideally be set in fbq('init')
    // But we can also set it via fbq('init') again or use setUserData (if available)
    // For now, we'll store it and it will be used on next page load
    console.log("[Facebook Pixel] Advanced matching data prepared:", Object.keys(prepared));
  }
}

/**
 * Get stored advanced matching data from localStorage
 */
export function getStoredAdvancedMatchingData(): Partial<AdvancedMatchingData> {
  if (typeof window === "undefined") return {};

  const data: Partial<AdvancedMatchingData> = {};

  const email = localStorage.getItem("fb_am_email");
  const firstName = localStorage.getItem("fb_am_fn");
  const lastName = localStorage.getItem("fb_am_ln");
  const phone = localStorage.getItem("fb_am_ph");

  if (email) data.em = email;
  if (firstName) data.fn = firstName;
  if (lastName) data.ln = lastName;
  if (phone) data.ph = phone;

  return data;
}

/**
 * Check if Facebook Pixel is loaded and available
 */
function isPixelLoaded(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Generate or retrieve session ID (persists for the browser session)
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  
  const storageKey = "fb_pixel_session_id";
  let sessionId = sessionStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}

/**
 * Generate a unique screen/step ID
 */
function generateScreenId(stepName?: string): string {
  const prefix = stepName ? stepName.toLowerCase().replace(/\s+/g, "-") : "screen";
  return `id-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get comprehensive event parameters (similar to competitor implementation)
 * Includes session tracking, screen info, UTM parameters, etc.
 */
export function getComprehensiveEventParams(additionalParams?: Record<string, unknown>): Record<string, unknown> {
  if (typeof window === "undefined") {
    return additionalParams || {};
  }

  const params: Record<string, unknown> = {
    // Session tracking
    session_id: getSessionId(),
    
    // Screen/viewport info
    screen_width: window.screen?.width || 0,
    screen_height: window.screen?.height || 0,
    
    // Page info
    host: window.location.hostname,
    path: window.location.pathname,
    hash: window.location.hash || "Not Set",
    origin: window.location.origin,
    referrer: document.referrer || "Not Set",
    title: document.title || "Not Set",
    
    // UTM parameters
    utm_source: getUrlParameter("utm_source") || "Not Set",
    utm_medium: getUrlParameter("utm_medium") || "Not Set",
    utm_campaign: getUrlParameter("utm_campaign") || "Not Set",
    utm_content: getUrlParameter("utm_content") || "Not Set",
    utm_term: getUrlParameter("utm_term") || "Not Set",
    
    // Form/flow context
    flow_id: "iul_lead_gen_flow",
    is_embedded: false,
    
    // Add any additional parameters
    ...(additionalParams || {}),
  };

  return params;
}

/**
 * Get URL parameter value
 */
function getUrlParameter(name: string): string | null {
  if (typeof window === "undefined") return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Generate a unique event ID for deduplication
 * Uses timestamp + random string to ensure uniqueness
 */
function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Safe wrapper to call fbq - only calls if fbq exists (never creates it)
 * Handles all fbq call patterns: track, trackCustom, etc.
 */
function safeFbqCall(action: string, ...args: any[]): void {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") return;
  // Use Function.prototype.apply to handle variable arguments safely
  (window.fbq as any).apply(null, [action, ...args]);
}

/**
 * Track a standard Facebook Pixel event
 * 
 * @param eventName - The event name (e.g., 'Lead', 'CompleteRegistration', 'Subscribe')
 * @param params - Optional parameters to send with the event
 * @param eventID - Optional event ID for CAPI deduplication (if not provided, will be auto-generated)
 * @returns The event ID used (for potential reuse)
 * 
 * @example
 * trackEvent('Lead', { content_name: 'Contact Form' })
 * 
 * @example With custom eventID for CAPI deduplication
 * const eventId = generateEventId();
 * trackEvent('Lead', { content_name: 'Contact Form' }, eventId);
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
  eventID?: string
): string {
  const id = eventID ?? generateEventId();
  const eventParams = { ...(params || {}) };

  // ✅ CRITICAL: eventID must be passed in the 4th argument (options object)
  // This is required for proper deduplication with CAPI
  safeFbqCall("track", eventName, eventParams, { eventID: id });

  return id;
}

/**
 * Track a custom Facebook Pixel event with comprehensive parameters
 * 
 * @param eventName - Custom event name
 * @param params - Optional parameters (will be merged with comprehensive params)
 * @param includeComprehensiveParams - Whether to include comprehensive tracking params (default: true)
 * 
 * @example
 * trackCustomEvent('GuideDownload', { guide_name: 'ACA Guide', category: 'Health Insurance' })
 */
export function trackCustomEvent(
  eventName: string,
  params?: Record<string, unknown>,
  includeComprehensiveParams: boolean = true
): void {
  if (typeof window === "undefined") return;

  try {
    // Merge comprehensive parameters with custom parameters
    const eventParams = includeComprehensiveParams
      ? {
          ...getComprehensiveEventParams(),
          event: "CustomEvent",
          customEventLabel: eventName,
          ...(params || {}),
        }
      : params || {};

    // Safe call - fbq will queue if not loaded, or send immediately if loaded
    safeFbqCall("trackCustom", eventName, eventParams);
    
    // Development logging (only in browser console, not in production)
    if (process.env.NODE_ENV === "development") {
      const isLoaded = isPixelLoaded();
      console.log(
        `[Facebook Pixel] Custom event ${isLoaded ? "tracked" : "queued"}: ${eventName}`,
        eventParams
      );
    }
  } catch (error) {
    console.error(`[Facebook Pixel] Error tracking custom event ${eventName}:`, error);
  }
}

/**
 * Track a Lead event (when someone submits a form)
 * 
 * ⚠️ IMPORTANT: Do NOT pass PII (email, phone, name) in params.
 * Advanced matching data should be set via fbq('init') or stored for next page load.
 * 
 * @param params - Additional parameters (content_name, value, currency, etc.)
 * Default value: $10 for guide downloads, $50 for quote requests
 * @param eventID - Optional event ID for CAPI deduplication (if not provided, will be auto-generated)
 * @returns The event ID used (for potential reuse with CAPI)
 * 
 * @example
 * trackLead({ contentName: 'Contact Form', source: 'iul_lead_gen' })
 * 
 * @example With custom eventID for CAPI deduplication
 * const eventId = generateEventId();
 * trackLead({ contentName: 'Contact Form', source: 'iul_lead_gen' }, eventId);
 */
export function trackLead(
  params?: {
    contentName?: string;
    value?: number;
    currency?: string;
    source?: string;
  },
  eventID?: string
): string {
  // Set default value based on source if not provided
  let value = params?.value;
  if (value === undefined) {
    if (params?.source === "consumer_guides" || params?.source === "blog_post") {
      value = 10; // Guide downloads
    } else {
      value = 50; // Quote requests / contact forms
    }
  }
  
  const eventParams: Record<string, unknown> = {
    content_name: params?.contentName,
    value: value,
    currency: params?.currency || "USD",
    source: params?.source,
  };

  // ✅ eventID is now passed as 3rd argument (will be moved to 4th arg options in trackEvent)
  return trackEvent("Lead", eventParams, eventID);
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
 * ⚠️ IMPORTANT: Do NOT pass PII (email, phone, name) in params.
 * Advanced matching data should be set via fbq('init') or stored for next page load.
 * 
 * @param params - Additional parameters
 * Default value: $5 for newsletter subscriptions
 */
export function trackSubscribe(
  params?: {
    contentName?: string;
    source?: string;
    value?: number;
  }
): void {
  const eventParams: Record<string, unknown> = {
    content_name: params?.contentName,
    source: params?.source,
    value: params?.value ?? 5, // Default value for newsletter subscriptions
    currency: "USD",
  };

  trackEvent("Subscribe", eventParams);
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
