import { NextRequest, NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { sendMetaCapiEvent, generateEventId } from "@/lib/meta-capi";

const CRM_BASE = "https://services.leadconnectorhq.com";
const CRM_VERSION = "2021-07-28";

const CATEGORY_DATA_KEY: Record<string, string> = {
  aca: "acaData",
  shortTerm: "shortTermMedicalData",
  dentalVision: "dentalVisionData",
  hospitalIndemnity: "hospitalIndemnityData",
  iul: "iulLeadGenData",
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

function getClientIp(req: NextRequest): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip")?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    undefined
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
      return NextResponse.json({ success: false, error: "First name is required." }, { status: 400 });
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ success: false, error: "Email address is required." }, { status: 400 });
    }
    if (!slug?.trim()) {
      return NextResponse.json({ success: false, error: "Guide slug is required." }, { status: 400 });
    }

    // 2. Fetch guide from Sanity
    const guide = await getSanityReadClient().fetch<{
      _id: string;
      category: string;
      generatedPdfUrl: string;
      leadFormSettings: { agentCrmWorkflowId?: string } | null;
    } | null>(GUIDE_QUERY, { slug: slug.trim() });

    if (!guide?.generatedPdfUrl) {
      return NextResponse.json({ success: false, error: "Guide not found." }, { status: 404 });
    }

    const firstName = resolvedFirst;
    const lastName = resolvedLast;
    const normalizedEmail = email.trim().toLowerCase();
    const cleanedSlug = slug.trim();

    // 3. Create Agent CRM contact via /api/create-contact (non-fatal)
    // Routes through the shared contact handler so tags, custom fields, duplicate detection,
    // and category-specific workflow enrollment all work the same as landing page forms.
    let contactId: string | null = null;
    try {
      if (phone?.trim()) {
        const siteUrl =
          process.env.NODE_ENV === "development"
            ? `http://localhost:${process.env.PORT || 3000}`
            : process.env.NEXT_PUBLIC_SITE_URL ||
              (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
              "http://localhost:3000";

        const dataKey = CATEGORY_DATA_KEY[guide.category] ?? "finalExpenseData";
        const leadTypeData = {
          language: locale?.startsWith("es") ? "es" : "en",
          source: `lead-magnet-${cleanedSlug}`,
          smsConsent: smsConsent ?? false,
          marketingConsent: marketingConsent ?? false,
        };

        const crmRes = await fetch(`${siteUrl}/api/create-contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            email: normalizedEmail,
            phone: phone.trim(),
            [dataKey]: leadTypeData,
          }),
        });
        const crmData = await crmRes.json().catch(() => ({}));
        contactId = (crmData as { contactId?: string })?.contactId ?? null;
        if (!crmRes.ok) {
          console.warn("[lead-magnet/download] CRM contact creation failed:", crmRes.status, crmData);
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
          userAgent: request.headers.get("user-agent") ?? "",
          ip: getClientIp(request),
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
    return NextResponse.json({ success: true, data: { pdfUrl: guide.generatedPdfUrl } });
  } catch (err) {
    console.error("[lead-magnet/download] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
