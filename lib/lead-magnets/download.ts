import "server-only";

import { createClient } from "next-sanity";
import { sendMetaCapiEvent, generateEventId } from "@/lib/meta-capi";
import { createContactCore } from "@/lib/create-contact/core";
import { WEB_RELEASED_TAG, WEB_VERIFIED_TAG } from "@/lib/lead-guard/tags";
import type { CreateContactContext } from "@/lib/create-contact/core";

const CRM_BASE = "https://services.leadconnectorhq.com";
const CRM_VERSION = "2021-07-28";

// Maps Sanity leadMagnet `category` values → create-contact payload key.
// Sanity stores kebab-case slugs; also accept the legacy camelCase forms used
// in consumer-guide-crm.ts so both flows stay in sync.
const CATEGORY_DATA_KEY: Record<string, string> = {
  // Sanity kebab-case values (canonical)
  aca: "acaData",
  "temporary-health-insurance": "shortTermMedicalData",
  "dental-vision": "dentalVisionData",
  "hospital-indemnity": "hospitalIndemnityData",
  iul: "iulLeadGenData",
  "final-expense": "finalExpenseData",
  // Legacy camelCase aliases (consumer-guide-crm.ts compat)
  shortTerm: "shortTermMedicalData",
  dentalVision: "dentalVisionData",
  hospitalIndemnity: "hospitalIndemnityData",
  finalExpense: "finalExpenseData",
};

function crmHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: CRM_VERSION,
  };
}

function getSanityReadClient() {
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    useCdn: false,
  });
}

function getSanityWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) throw new Error("SANITY_API_WRITE_TOKEN not set");
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token: process.env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });
}

const GUIDE_QUERY = `*[_type == "leadMagnet" && slug.current == $slug && status == "published"][0] {
  _id,
  category,
  generatedPdfUrl,
  leadFormSettings { agentCrmWorkflowId }
}`;


export type LeadMagnetResult = {
  status: number;
  body: Record<string, unknown>;
  /** The CRM step's outcome when one ran (Release needs it: a 200 still serves the PDF). */
  crm?: { status: number; contactId: string | null } | null;
};

function respond(body: Record<string, unknown>, init?: { status?: number }): LeadMagnetResult {
  return { status: init?.status ?? 200, body };
}

/**
 * A lead-magnet download (Sanity guide → PDF), after Lead Guard judged the browser's request.
 * Shared by /api/lead-magnets/download and Lead Guard's Release. `leadAllowed: false` (held or
 * blocked) still returns the PDF — public content — but creates no contact, enrolls no workflow,
 * sends no CAPI Lead and counts no download.
 */
export async function processLeadMagnetDownload(
  body: Record<string, unknown>,
  opts: {
    visitor: { ip?: string; ua?: string } | null;
    leadAllowed: boolean;
    /** Set by Lead Guard's Release: the consent record keeps the original submit time. */
    released?: CreateContactContext["released"];
  }
): Promise<LeadMagnetResult> {
  try {
    const {
      firstName: rawFirst,
      lastName: rawLast,
      name,
      email,
      phone,
      slug,
      locale,
      smsConsent,
      marketingConsent,
    } = body as {
      firstName?: string;
      lastName?: string;
      name?: string;
      email?: string;
      phone?: string;
      slug?: string;
      locale?: string;
      smsConsent?: boolean;
      marketingConsent?: boolean;
    };

    // Resolve firstName / lastName — accept split fields or legacy full name
    const resolvedFirst = rawFirst?.trim() || (name?.trim().split(/\s+/)[0] ?? "");
    const resolvedLast =
      rawLast?.trim() ||
      (name?.trim().split(/\s+/).slice(1).join(" ") || resolvedFirst);

    // 1. Validate inputs
    if (!resolvedFirst) {
      return respond({ success: false, error: "First name is required." }, { status: 400 });
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return respond({ success: false, error: "Email address is required." }, { status: 400 });
    }
    if (!slug?.trim()) {
      return respond({ success: false, error: "Guide slug is required." }, { status: 400 });
    }

    // 2. Fetch guide from Sanity
    const guide = await getSanityReadClient().fetch<{
      _id: string;
      category: string;
      generatedPdfUrl: string;
      leadFormSettings: { agentCrmWorkflowId?: string } | null;
    } | null>(GUIDE_QUERY, { slug: slug.trim() });

    if (!guide?.generatedPdfUrl) {
      return respond({ success: false, error: "Guide not found." }, { status: 404 });
    }

    if (!opts.leadAllowed) {
      return { status: 200, body: { success: true, data: { pdfUrl: guide.generatedPdfUrl } } };
    }

    const firstName = resolvedFirst;
    const lastName = resolvedLast;
    const normalizedEmail = email.trim().toLowerCase();
    const cleanedSlug = slug.trim();

    // 3. Create Agent CRM contact via /api/create-contact (non-fatal)
    // Routes through the shared contact handler so tags, custom fields, duplicate detection,
    // and category-specific workflow enrollment all work the same as landing page forms.
    let contactId: string | null = null;
    let crmOutcome: { status: number; contactId: string | null } | null = null;
    try {
      if (phone?.trim()) {
        const dataKey = CATEGORY_DATA_KEY[guide.category ?? ""] ?? (() => {
          console.error(
            `[lead-magnet/download] Unknown guide category "${guide.category}" for slug "${cleanedSlug}" — falling back to finalExpenseData. Fix the category in Sanity.`
          );
          return "finalExpenseData";
        })();
        const leadTypeData = {
          language: locale?.startsWith("es") ? "es" : "en",
          source: `lead-magnet-${cleanedSlug}`,
          smsConsent: smsConsent ?? false,
          marketingConsent: marketingConsent ?? false,
        };

        // In-process (no HTTP hop): Lead Guard already judged the visitor.
        const crm = await createContactCore(
          {
            firstName,
            lastName,
            email: normalizedEmail,
            phone: phone.trim(),
            [dataKey]: leadTypeData,
          },
          {
            visitor: opts.visitor,
            extraTags: opts.released ? [WEB_VERIFIED_TAG, WEB_RELEASED_TAG] : [WEB_VERIFIED_TAG],
            released: opts.released ?? null,
          }
        );
        contactId = (crm.body as { contactId?: string })?.contactId ?? null;
        crmOutcome = { status: crm.status, contactId };
        if (crm.status >= 400) {
          console.warn("[lead-magnet/download] CRM contact creation failed:", crm.status);
        }
      }
    } catch (err) {
      console.error("[lead-magnet/download] CRM contact error (non-fatal):", err);
    }

    // 4. Trigger guide-specific workflow from Sanity leadFormSettings (non-fatal)
    // Category workflows are already handled by /api/create-contact above.
    try {
      const piToken = process.env.AGENT_CRM_PI;
      const locationId = process.env.AGENT_CRM_LOCATION_ID;
      const workflowId = guide.leadFormSettings?.agentCrmWorkflowId;
      if (piToken && locationId && workflowId && contactId) {
        const wfRes = await fetch(
          `${CRM_BASE}/contacts/${contactId}/workflow/${workflowId}?locationId=${locationId}`,
          { method: "POST", headers: crmHeaders(piToken) }
        );
        if (!wfRes.ok) {
          console.warn("[lead-magnet/download] Guide workflow enrollment failed (non-fatal):", wfRes.status);
        }
      }
    } catch (err) {
      console.error("[lead-magnet/download] Workflow error (non-fatal):", err);
    }

    // 5. Meta CAPI Lead event (non-fatal)
    try {
      const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
      const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
      if (pixelId && accessToken) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";
        await sendMetaCapiEvent({
          pixelId,
          accessToken,
          eventName: "Lead",
          eventId: generateEventId(),
          eventSourceUrl: `${siteUrl}/en/lead-magnets/${cleanedSlug}`,
          userAgent: opts.visitor?.ua ?? "",
          ip: opts.visitor?.ip,
          email: normalizedEmail,
          ...(phone?.trim() ? { phone: phone.trim() } : {}),
          firstName,
          lastName,
          customData: { content_name: cleanedSlug, content_category: guide.category },
          testEventCode: process.env.META_TEST_EVENT_CODE,
        });
      }
    } catch (err) {
      console.error("[lead-magnet/download] Meta CAPI error (non-fatal):", err);
    }

    // 6. Increment downloadCount in Sanity (non-fatal)
    try {
      await getSanityWriteClient().patch(guide._id).inc({ downloadCount: 1 }).commit();
    } catch (err) {
      console.error("[lead-magnet/download] downloadCount increment error (non-fatal):", err);
    }

    // 7. Return PDF URL
    return { ...respond({ success: true, data: { pdfUrl: guide.generatedPdfUrl } }), crm: crmOutcome };
  } catch (err) {
    console.error("[lead-magnet/download] Unexpected error:", err);
    return respond(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
