/**
 * Meta Conversions API (CAPI) Helper
 * 
 * Sends server-side events to Meta for better attribution and deduplication
 */

import { createHash } from "crypto";

/**
 * Hash a string using SHA-256 (required by Meta for PII)
 */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Normalize email for hashing (lowercase, trim)
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize phone for hashing (digits only, including country code)
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Normalize name for hashing (lowercase, trim)
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export interface MetaCapiEventOptions {
  pixelId: string;
  accessToken: string;
  eventName: string;
  eventId: string; // Must match Pixel eventID for deduplication
  eventSourceUrl: string;
  userAgent: string;
  ip?: string;
  fbp?: string; // Facebook browser ID cookie
  fbc?: string; // Facebook click ID cookie
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  customData?: Record<string, unknown>;
  testEventCode?: string; // Only for testing in Events Manager
}

/**
 * Send a Meta Conversions API event
 */
export async function sendMetaCapiEvent(options: MetaCapiEventOptions): Promise<any> {
  const {
    pixelId,
    accessToken,
    eventName,
    eventId,
    eventSourceUrl,
    userAgent,
    ip,
    fbp,
    fbc,
    email,
    phone,
    firstName,
    lastName,
    customData = {},
    testEventCode,
  } = options;

  const event_time = Math.floor(Date.now() / 1000);

  // Build user_data object (Meta requires hashed PII)
  const user_data: Record<string, any> = {
    client_user_agent: userAgent,
  };

  // Add IP if available (behind proxies, use first IP from x-forwarded-for)
  if (ip) {
    user_data.client_ip_address = ip.split(",")[0]?.trim();
  }

  // Add Facebook cookies if available (helps with matching)
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;

  // Hash and add PII (Meta requires SHA-256 hashing)
  if (email) {
    user_data.em = [sha256(normalizeEmail(email))];
  }
  if (phone) {
    user_data.ph = [sha256(normalizePhone(phone))];
  }
  if (firstName) {
    user_data.fn = [sha256(normalizeName(firstName))];
  }
  if (lastName) {
    user_data.ln = [sha256(normalizeName(lastName))];
  }

  // Build the event payload
  const payload: any = {
    data: [
      {
        event_name: eventName,
        event_time,
        action_source: "website",
        event_source_url: eventSourceUrl,
        event_id: eventId, // CRITICAL: Must match Pixel eventID for deduplication
        user_data,
        custom_data: customData,
      },
    ],
  };

  // Add test event code if provided (for testing in Events Manager)
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  // Meta Graph API endpoint
  const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (!response.ok) {
      const errorMessage = json?.error?.message || "Meta CAPI request failed";
      console.error("[Meta CAPI] Error:", errorMessage, json);
      throw new Error(`Meta CAPI failed: ${errorMessage}`);
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[Meta CAPI] Event sent successfully:", {
        eventName,
        eventId,
        events_received: json.events_received,
      });
    }

    return json;
  } catch (error) {
    console.error("[Meta CAPI] Failed to send event:", error);
    throw error;
  }
}

/**
 * Generate a unique event ID for deduplication
 * Should be called on the client side and passed to both Pixel and CAPI
 * Works in both browser and Node.js environments
 */
export function generateEventId(): string {
  // Browser: Use crypto.randomUUID if available
  if (typeof window !== "undefined" && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  
  // Node.js: Use crypto.randomUUID (Node 16+)
  if (typeof require !== "undefined") {
    try {
      const nodeCrypto = require("crypto");
      if (nodeCrypto.randomUUID) {
        return nodeCrypto.randomUUID();
      }
    } catch {
      // Fall through to fallback
    }
  }
  
  // Fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Get Facebook cookies from cookie string (client-side helper)
 */
export function getFacebookCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};

  const getCookie = (name: string): string | undefined => {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(name + "="))
      ?.split("=")[1];
  };

  return {
    fbp: getCookie("_fbp"),
    fbc: getCookie("_fbc"),
  };
}

