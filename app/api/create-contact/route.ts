import { NextRequest, NextResponse } from "next/server";
import { sendMetaCapiEvent } from "@/lib/meta-capi";
import {
  agentCrmFetchContactById,
  agentCrmFindContactByEmail,
  agentCrmFindContactByPhone,
  agentCrmIsDuplicateContactError,
  type AgentCrmCreateContactErrorBody,
} from "@/lib/agent-crm-contacts";

/** Parse LeadConnector JSON error bodies (duplicate contact, etc.). */
function parseLeadConnectorErrorJson(text: string): {
  message?: string;
  meta?: { contactId?: string; matchingField?: string; contactName?: string };
} | null {
  try {
    return JSON.parse(text) as {
      message?: string;
      meta?: { contactId?: string; matchingField?: string; contactName?: string };
    };
  } catch {
    return null;
  }
}

function isLocationDuplicateContactsError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("does not allow duplicated contacts") ||
    m.includes("does not allow duplicate") ||
    m.includes("duplicated contacts")
  );
}

/** Best-effort client IP for Meta CAPI (Vercel / proxies). */
function getClientIpFromRequest(request: NextRequest): string | undefined {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = request.headers.get("cf-connecting-ip");
  if (cf?.trim()) return cf.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return undefined;
}

type CreateContactMetaBody = {
  eventId?: string;
  eventSourceUrl?: string;
  fbp?: string;
  fbc?: string;
};

type OptLeadBlob = Record<string, unknown> | undefined;

/** Meta CAPI Lead: new contacts always; duplicate-merge path only for final-expense-get-covered-ads uses same eventId as Pixel for deduplication */
async function trySendMetaLeadCapiLead(
  request: NextRequest,
  opts: {
    meta: CreateContactMetaBody | undefined;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    isNewContact: boolean;
    shortTermMedicalData?: OptLeadBlob;
    contactPageData?: OptLeadBlob;
    acaData?: OptLeadBlob;
    dentalVisionData?: OptLeadBlob;
    hospitalIndemnityData?: OptLeadBlob;
    finalExpenseData?: OptLeadBlob;
    getCoveredFastData?: OptLeadBlob;
    iulLeadGenData?: OptLeadBlob;
  }
): Promise<boolean> {
  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const testEventCode = process.env.META_TEST_EVENT_CODE;

  const {
    meta,
    email,
    phone,
    firstName,
    lastName,
    isNewContact,
    shortTermMedicalData,
    contactPageData,
    acaData,
    dentalVisionData,
    hospitalIndemnityData,
    finalExpenseData,
    getCoveredFastData,
    iulLeadGenData,
  } = opts;

  const feSource =
    typeof finalExpenseData?.source === "string" ? finalExpenseData.source : undefined;
  const isFinalExpenseGetCoveredAds = feSource === "final_expense_get_covered_ads";
  const allowDuplicateMergeCapi = !isNewContact && isFinalExpenseGetCoveredAds;

  const willSend = !!(
    pixelId &&
    accessToken &&
    meta?.eventId &&
    meta?.eventSourceUrl &&
    (isNewContact || allowDuplicateMergeCapi)
  );

  console.log("[Meta CAPI] Check:", {
    hasPixelId: !!pixelId,
    hasAccessToken: !!accessToken,
    hasEventId: !!meta?.eventId,
    hasEventSourceUrl: !!meta?.eventSourceUrl,
    isNewContact,
    allowDuplicateMergeCapi,
    isFinalExpenseGetCoveredAds,
    willSend,
  });

  if (!willSend) {
    console.log(
      "[Meta CAPI] Skipped - missing env/meta, or not eligible (new contact vs duplicate FE get-covered CAPI)"
    );
    return false;
  }

  try {
    const userAgent = request.headers.get("user-agent") || "";
    const ip = getClientIpFromRequest(request);

    const value = 100;
    const source = isFinalExpenseGetCoveredAds
      ? "final_expense_get_covered_ads"
      : shortTermMedicalData
        ? "short_term_medical"
        : acaData
          ? "aca"
          : contactPageData
            ? "contact_page"
            : dentalVisionData
              ? "dental_vision"
              : hospitalIndemnityData
                ? "hospital_indemnity"
                : finalExpenseData
                  ? "final_expense"
                  : getCoveredFastData
                    ? "get_covered_fast"
                    : "iul_lead_gen";

    const contentName = isFinalExpenseGetCoveredAds
      ? "Final expense get covered (VA ads)"
      : shortTermMedicalData
        ? "Short Term Medical Lead"
        : acaData
          ? "ACA Lead"
          : contactPageData
            ? "Contact Page Lead"
            : dentalVisionData
              ? "Dental & Vision Lead"
              : hospitalIndemnityData
                ? "Hospital Indemnity Lead"
                : finalExpenseData
                  ? "Final Expense Lead"
                  : getCoveredFastData
                    ? "Get Covered Fast funnel"
                    : "IUL Lead Generation Campaign";

    const customData: Record<string, unknown> = {
      content_name: contentName,
      currency: "USD",
      value: value,
      source,
    };
    if (isFinalExpenseGetCoveredAds) {
      customData.lead_event_source = "fe_get_covered_funnel";
    }

    console.log("[Meta CAPI] Sending event:", {
      eventId: meta!.eventId,
      eventName: "Lead",
      email: `${email.slice(0, 3)}***`,
      hasFbp: !!meta?.fbp,
      hasFbc: !!meta?.fbc,
      contentName,
      source,
      duplicateMergePath: allowDuplicateMergeCapi,
    });

    await sendMetaCapiEvent({
      pixelId: pixelId!,
      accessToken: accessToken!,
      eventName: "Lead",
      eventId: meta!.eventId!,
      eventSourceUrl: meta!.eventSourceUrl!,
      userAgent,
      ip,
      fbp: meta?.fbp,
      fbc: meta?.fbc,
      email,
      phone,
      firstName,
      lastName,
      customData,
      testEventCode,
    });

    console.log("[Meta CAPI] Event sent successfully");
    return true;
  } catch (capiError) {
    console.error("[Meta CAPI] Failed to send event (non-blocking):", capiError);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const piToken = process.env.AGENT_CRM_PI;
    const locationId = process.env.AGENT_CRM_LOCATION_ID;
    
    if (!piToken) {
      return NextResponse.json(
        { 
          success: false,
          error: "Agent CRM Private Integration token not found",
          hint: "Make sure AGENT_CRM_PI is set in your .env.local file"
        },
        { status: 500 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        { 
          success: false,
          error: "Location ID not found",
          hint: "Make sure AGENT_CRM_LOCATION_ID is set in your .env.local file"
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, phone, iulLeadGenData, shortTermMedicalData, contactPageData, acaData, dentalVisionData, hospitalIndemnityData, finalExpenseData, getCoveredFastData, meta } = body;

    // [Workflow Debug] Log incoming lead type - helps trace why IUL workflow may be assigned
    console.log("[create-contact] Incoming request lead type:", {
      hasIulLeadGenData: !!iulLeadGenData,
      hasShortTermMedicalData: !!shortTermMedicalData,
      hasContactPageData: !!contactPageData,
      hasAcaData: !!acaData,
      hasDentalVisionData: !!dentalVisionData,
      hasHospitalIndemnityData: !!hospitalIndemnityData,
      hasFinalExpenseData: !!finalExpenseData,
      hasGetCoveredFastData: !!getCoveredFastData,
      iulLeadGenDataKeys: iulLeadGenData ? Object.keys(iulLeadGenData) : [],
      shortTermMedicalDataKeys: shortTermMedicalData ? Object.keys(shortTermMedicalData) : [],
      contactPageDataKeys: contactPageData ? Object.keys(contactPageData) : [],
      acaDataKeys: acaData ? Object.keys(acaData) : [],
      dentalVisionDataKeys: dentalVisionData ? Object.keys(dentalVisionData) : [],
      hospitalIndemnityDataKeys: hospitalIndemnityData ? Object.keys(hospitalIndemnityData) : [],
      finalExpenseDataKeys: finalExpenseData ? Object.keys(finalExpenseData) : [],
      leadSource: shortTermMedicalData
        ? "short_term_medical"
        : contactPageData
          ? "contact_page"
          : acaData
            ? "aca"
            : dentalVisionData
              ? "dental_vision"
              : hospitalIndemnityData
                ? "hospital_indemnity"
                : finalExpenseData
                  ? "final_expense"
                  : getCoveredFastData
                    ? "get_covered_fast"
                    : iulLeadGenData
                      ? "iul_lead_gen"
                      : "other",
    });

    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json(
        { 
          success: false,
          error: "Missing required fields",
          required: ["firstName", "lastName", "email", "phone"]
        },
        { status: 400 }
      );
    }

    const baseUrl = 'https://services.leadconnectorhq.com';
    
    // Look for single custom field: lead_source_details (stores formatted lead data for all website lead types)
    let leadSourceDetailsFieldId: string | null = null;
    let leadSourceDetailsFieldKey: string | null = null;
    
    try {
      const customFieldsResponse = await fetch(`${baseUrl}/locations/${locationId}/customFields`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${piToken}`,
          'Version': '2021-07-28',
        },
      });
      
      if (customFieldsResponse.ok) {
        const customFieldsData = await customFieldsResponse.json();
        const customFields = customFieldsData.customFields || customFieldsData;
        
        if (Array.isArray(customFields)) {
          for (const field of customFields) {
            const fieldName = field.name?.toLowerCase() || '';
            const fieldKey = field.key?.toLowerCase() || '';
            
            if (!leadSourceDetailsFieldId && (
              fieldKey === 'lead_source_details' ||
              fieldKey.replace(/[_\s-]/g, '') === 'leadsourcedetails' ||
              (fieldName.includes('lead') && fieldName.includes('source') && fieldName.includes('detail'))
            )) {
              leadSourceDetailsFieldId = field.id;
              leadSourceDetailsFieldKey = field.key || field.name;
              console.log('Found lead_source_details field:', { id: field.id, key: field.key, name: field.name });
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch custom fields, will try without IDs:', err);
    }
    
    // Build formatted lead details for lead_source_details (single field for all lead types)
    const customFieldsArray: Array<{ id: string; key?: string; field_value: string | string[] }> = [];
    let leadDetailsText: string | null = null;
    
    if (iulLeadGenData) {
      const formatInvestments = (investments: string[] | undefined): string => {
        if (!investments || !Array.isArray(investments) || investments.length === 0) return 'None';
        return investments.join(', ');
      };
      const langRaw = iulLeadGenData.language;
      const languageDisplay =
        typeof langRaw === 'string' && langRaw.toLowerCase().startsWith('es')
          ? 'Spanish (Español)'
          : typeof langRaw === 'string' && langRaw.toLowerCase().startsWith('en')
            ? 'English'
            : langRaw || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      const smsConsent = iulLeadGenData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = iulLeadGenData.marketingConsent === true ? 'Yes' : 'No';
      const hasExtendedQuizFields = !!(
        iulLeadGenData.retirementTimeline ||
        (iulLeadGenData.investments && iulLeadGenData.investments.length > 0) ||
        iulLeadGenData.monthlySavings ||
        iulLeadGenData.state ||
        iulLeadGenData.age
      );

      if (hasExtendedQuizFields) {
        leadDetailsText = [
          'IUL Lead Generation Form Data',
          '============================',
          '',
          `Language: ${languageDisplay}`,
          `Retirement Timeline: ${iulLeadGenData.retirementTimeline || 'Not provided'}`,
          `Current Investments: ${formatInvestments(iulLeadGenData.investments)}`,
          `Monthly Savings: ${iulLeadGenData.monthlySavings || 'Not provided'}`,
          `Age: ${iulLeadGenData.age || 'Not provided'}`,
          `State: ${iulLeadGenData.state || 'Not provided'}`,
          '',
          `Submitted: ${new Date().toLocaleString()}`,
        ].join('\n');
      } else {
        leadDetailsText = [
          'IUL Lead',
          '========',
          '',
          'Contact:',
          `  Name: ${firstName} ${lastName}`,
          `  Email: ${email}`,
          `  Phone: ${phone}`,
          '',
          'Lead Details:',
          `  Source: ${iulLeadGenData.source || 'iul'}`,
          `  Language: ${languageDisplay}`,
          `  SMS Consent: ${smsConsent}`,
          `  Marketing Consent: ${marketingConsent}`,
          `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
          '',
          `Submitted: ${submittedAt}`,
        ].join('\n');
      }
    } else if (shortTermMedicalData) {
      const languageDisplay = shortTermMedicalData.language === 'es' ? 'Spanish (Español)' : 
                              shortTermMedicalData.language === 'en' ? 'English' : shortTermMedicalData.language || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      const smsConsent = shortTermMedicalData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = shortTermMedicalData.marketingConsent === true ? 'Yes' : 'No';
      leadDetailsText = [
        'Short Term Medical Lead',
        '======================',
        '',
        'Contact:',
        `  Name: ${firstName} ${lastName}`,
        `  Email: ${email}`,
        `  Phone: ${phone}`,
        '',
        'Lead Details:',
        `  Source: ${shortTermMedicalData.source || 'short_term_medical_page'}`,
        `  Language: ${languageDisplay}`,
        `  SMS Consent: ${smsConsent}`,
        `  Marketing Consent: ${marketingConsent}`,
        `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
        '',
        `Submitted: ${submittedAt}`,
      ].join('\n');
    } else if (contactPageData) {
      const languageDisplay = contactPageData.language === 'es' ? 'Spanish (Español)' : 
                              contactPageData.language === 'en' ? 'English' : contactPageData.language || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      const smsConsent = contactPageData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = contactPageData.marketingConsent === true ? 'Yes' : 'No';
      leadDetailsText = [
        'Contact Page Lead',
        '==================',
        '',
        'Contact:',
        `  Name: ${firstName} ${lastName}`,
        `  Email: ${email}`,
        `  Phone: ${phone}`,
        '',
        'Lead Details:',
        `  Source: ${contactPageData.source || 'contact_page'}`,
        `  Language: ${languageDisplay}`,
        `  SMS Consent: ${smsConsent}`,
        `  Marketing Consent: ${marketingConsent}`,
        `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
        '',
        `Submitted: ${submittedAt}`,
      ].join('\n');
    } else if (acaData) {
      const languageDisplay = acaData.language === 'es' ? 'Spanish (Español)' :
                              acaData.language === 'en' ? 'English' : acaData.language || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      const smsConsent = acaData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = acaData.marketingConsent === true ? 'Yes' : 'No';
      leadDetailsText = [
        'ACA Lead',
        '========',
        '',
        'Contact:',
        `  Name: ${firstName} ${lastName}`,
        `  Email: ${email}`,
        `  Phone: ${phone}`,
        '',
        'Lead Details:',
        `  Source: ${acaData.source || 'aca_page'}`,
        `  Language: ${languageDisplay}`,
        `  SMS Consent: ${smsConsent}`,
        `  Marketing Consent: ${marketingConsent}`,
        `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
        '',
        `Submitted: ${submittedAt}`,
      ].join('\n');
    } else if (dentalVisionData) {
      const languageDisplay = dentalVisionData.language === 'es' ? 'Spanish (Español)' :
                              dentalVisionData.language === 'en' ? 'English' : dentalVisionData.language || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      const smsConsent = dentalVisionData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = dentalVisionData.marketingConsent === true ? 'Yes' : 'No';
      leadDetailsText = [
        'Dental & Vision Lead',
        '===================',
        '',
        'Contact:',
        `  Name: ${firstName} ${lastName}`,
        `  Email: ${email}`,
        `  Phone: ${phone}`,
        '',
        'Lead Details:',
        `  Source: ${dentalVisionData.source || 'dental_vision_page'}`,
        `  Language: ${languageDisplay}`,
        `  SMS Consent: ${smsConsent}`,
        `  Marketing Consent: ${marketingConsent}`,
        `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
        '',
        `Submitted: ${submittedAt}`,
      ].join('\n');
    } else if (hospitalIndemnityData) {
      const languageDisplay = hospitalIndemnityData.language === 'es' ? 'Spanish (Español)' :
                              hospitalIndemnityData.language === 'en' ? 'English' : hospitalIndemnityData.language || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      const smsConsent = hospitalIndemnityData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = hospitalIndemnityData.marketingConsent === true ? 'Yes' : 'No';
      leadDetailsText = [
        'Hospital Indemnity Lead',
        '======================',
        '',
        'Contact:',
        `  Name: ${firstName} ${lastName}`,
        `  Email: ${email}`,
        `  Phone: ${phone}`,
        '',
        'Lead Details:',
        `  Source: ${hospitalIndemnityData.source || 'hospital_indemnity_page'}`,
        `  Language: ${languageDisplay}`,
        `  SMS Consent: ${smsConsent}`,
        `  Marketing Consent: ${marketingConsent}`,
        `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
        '',
        `Submitted: ${submittedAt}`,
      ].join('\n');
    } else if (finalExpenseData) {
      const languageDisplay = finalExpenseData.language === 'es' ? 'Spanish (Español)' :
                              finalExpenseData.language === 'en' ? 'English' : finalExpenseData.language || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      const smsConsent = finalExpenseData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = finalExpenseData.marketingConsent === true ? 'Yes' : 'No';
      const campaignLine = finalExpenseData.campaign
        ? `  Campaign: ${finalExpenseData.campaign}\n`
        : '';
      const regionLine = finalExpenseData.targetRegion
        ? `  Target region: ${finalExpenseData.targetRegion}\n`
        : '';
      leadDetailsText = [
        'Final Expense Lead',
        '==================',
        '',
        'Contact:',
        `  Name: ${firstName} ${lastName}`,
        `  Email: ${email}`,
        `  Phone: ${phone}`,
        '',
        'Lead Details:',
        `  Source: ${finalExpenseData.source || 'final_expense_page'}`,
        campaignLine,
        regionLine,
        `  Language: ${languageDisplay}`,
        `  SMS Consent: ${smsConsent}`,
        `  Marketing Consent: ${marketingConsent}`,
        `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
        '',
        `Submitted: ${submittedAt}`,
      ].join('\n');
    } else if (getCoveredFastData) {
      const languageDisplay = getCoveredFastData.language === 'es' ? 'Spanish (Español)' :
                              getCoveredFastData.language === 'en' ? 'English' : getCoveredFastData.language || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      const smsConsent = getCoveredFastData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = getCoveredFastData.marketingConsent === true ? 'Yes' : 'No';
      const answersLines = getCoveredFastData.answers && typeof getCoveredFastData.answers === 'object'
        ? Object.entries(getCoveredFastData.answers as Record<string, string>)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n')
        : '  (none)';
      leadDetailsText = [
        'Get Covered Fast funnel',
        '=======================',
        '',
        'Contact:',
        `  Name: ${firstName} ${lastName}`,
        `  Email: ${email}`,
        `  Phone: ${phone}`,
        '',
        'Quiz answers:',
        answersLines,
        '',
        'Routing:',
        `  Recommended primary: ${getCoveredFastData.recommendedRoute || 'Not provided'}`,
        `  Recommended secondary: ${getCoveredFastData.recommendedSecondary || 'Not provided'}`,
        `  ZIP: ${getCoveredFastData.zip || 'Not provided'}`,
        `  State: ${getCoveredFastData.state || 'Not provided'}`,
        '',
        'Lead Details:',
        `  Source: ${getCoveredFastData.source || 'get_covered_fast'}`,
        `  Language: ${languageDisplay}`,
        `  SMS Consent: ${smsConsent}`,
        `  Marketing Consent: ${marketingConsent}`,
        `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
        '',
        `Submitted: ${submittedAt}`,
      ].join('\n');
    }

    if (leadDetailsText) {
      const guideMetaSource =
        acaData ||
        shortTermMedicalData ||
        contactPageData ||
        dentalVisionData ||
        hospitalIndemnityData ||
        finalExpenseData ||
        getCoveredFastData ||
        iulLeadGenData;
      const gd = guideMetaSource as
        | { guideName?: string; guideId?: string }
        | undefined;
      if (gd && (gd.guideName || gd.guideId)) {
        leadDetailsText = `${leadDetailsText}\n\nConsumer guide download:\n${gd.guideName ? `  Guide: ${gd.guideName}\n` : ""}${gd.guideId ? `  Guide ID: ${gd.guideId}` : ""}`;
      }
    }
    
    if (leadDetailsText && leadSourceDetailsFieldId) {
      customFieldsArray.push({
        id: leadSourceDetailsFieldId,
        key: leadSourceDetailsFieldKey || undefined,
        field_value: leadDetailsText,
      });
    }
    
    // Build tags for Short Term Medical leads
    const stmTags: string[] = [];
    if (shortTermMedicalData) {
      stmTags.push('Short Term Medical Lead');
      stmTags.push(shortTermMedicalData.language === 'es' ? 'Spanish' : 'English');
    }

    // Build tags for Contact Page leads
    const contactPageTags: string[] = [];
    if (contactPageData) {
      contactPageTags.push('Contact Page Lead');
      contactPageTags.push(contactPageData.language === 'es' ? 'Spanish' : 'English');
    }

    // Build tags for ACA page leads
    const acaTags: string[] = [];
    if (acaData) {
      acaTags.push('ACA Lead');
      acaTags.push(acaData.language === 'es' ? 'Spanish' : 'English');
    }

    // Build tags for Dental & Vision page leads
    const dentalVisionTags: string[] = [];
    if (dentalVisionData) {
      dentalVisionTags.push('Dental & Vision Lead');
      dentalVisionTags.push(dentalVisionData.language === 'es' ? 'Spanish' : 'English');
    }

    // Build tags for Hospital Indemnity page leads
    const hospitalIndemnityTags: string[] = [];
    if (hospitalIndemnityData) {
      hospitalIndemnityTags.push('Hospital Indemnity Lead');
      hospitalIndemnityTags.push(hospitalIndemnityData.language === 'es' ? 'Spanish' : 'English');
    }

    // Build tags for IUL leads (modal CTA + /iul/quote) — CRM sequences branch on "Spanish" vs "English"
    const iulLeadGenTags: string[] = [];
    if (iulLeadGenData) {
      iulLeadGenTags.push('IUL Lead');
      iulLeadGenTags.push(iulLeadGenData.language === 'es' ? 'Spanish' : 'English');
    }

    // Build tags for Final Expense page CTA leads (CRM workflows branch on fe_get_covered_funnel)
    const finalExpenseTags: string[] = [];
    if (finalExpenseData) {
      finalExpenseTags.push('Final Expense Lead');
      finalExpenseTags.push(finalExpenseData.language === 'es' ? 'Spanish' : 'English');
      finalExpenseTags.push("fe_get_covered_funnel");
      if (finalExpenseData.language === "es") {
        finalExpenseTags.push("fe_senior_life_spanish");
      }
    }

    // Build tags for Get Covered Fast funnel leads
    const getCoveredFastTags: string[] = [];
    if (getCoveredFastData) {
      getCoveredFastTags.push('Get Covered Fast Lead');
      getCoveredFastTags.push(getCoveredFastData.language === 'es' ? 'Spanish' : 'English');
    }

    // Determine lead source for CRM routing (prevents IUL workflow from auto-triggering on specialty page leads)
    const leadSource = shortTermMedicalData
      ? "short_term_medical"
      : contactPageData
        ? "contact_page"
        : acaData
          ? "aca"
          : dentalVisionData
            ? "dental_vision"
            : hospitalIndemnityData
              ? "hospital_indemnity"
              : finalExpenseData
                ? "final_expense"
                : getCoveredFastData
                  ? "get_covered_fast"
                  : iulLeadGenData
                    ? "iul_lead_gen"
                    : "website";

    // Create contact payload with customFields, tags, and source
    const contactPayload: any = {
      firstName,
      lastName,
      email,
      phone,
      locationId,
      source: leadSource,
    };
    
    // Add customFields if we have any
    if (customFieldsArray.length > 0) {
      contactPayload.customFields = customFieldsArray;
    }
    
    // Add tags for STM leads
    if (stmTags.length > 0) {
      contactPayload.tags = stmTags;
    }
    // Add tags for Contact Page leads
    if (contactPageTags.length > 0) {
      contactPayload.tags = [...(contactPayload.tags || []), ...contactPageTags];
    }
    // Add tags for ACA leads
    if (acaTags.length > 0) {
      contactPayload.tags = [...(contactPayload.tags || []), ...acaTags];
    }
    // Add tags for Dental & Vision leads
    if (dentalVisionTags.length > 0) {
      contactPayload.tags = [...(contactPayload.tags || []), ...dentalVisionTags];
    }
    // Add tags for Hospital Indemnity leads
    if (hospitalIndemnityTags.length > 0) {
      contactPayload.tags = [...(contactPayload.tags || []), ...hospitalIndemnityTags];
    }
    // Add tags for IUL lead gen
    if (iulLeadGenTags.length > 0) {
      contactPayload.tags = [...(contactPayload.tags || []), ...iulLeadGenTags];
    }
    // Add tags for Final Expense leads
    if (finalExpenseTags.length > 0) {
      contactPayload.tags = [...(contactPayload.tags || []), ...finalExpenseTags];
    }
    // Add tags for Get Covered Fast funnel
    if (getCoveredFastTags.length > 0) {
      contactPayload.tags = [...(contactPayload.tags || []), ...getCoveredFastTags];
    }

    const consumerGuideTagSources = [
      acaData,
      shortTermMedicalData,
      contactPageData,
      dentalVisionData,
      hospitalIndemnityData,
      finalExpenseData,
      getCoveredFastData,
      iulLeadGenData,
    ];
    const hasConsumerGuideDownload = consumerGuideTagSources.some(
      (d) => d && ((d as { guideId?: string }).guideId || (d as { guideName?: string }).guideName)
    );
    if (hasConsumerGuideDownload) {
      contactPayload.tags = [...(contactPayload.tags || []), "Consumer Guide Download"];
    }
    
    console.log('Creating contact with payload:', JSON.stringify(contactPayload, null, 2));
    
    // Create contact with custom fields in one request
    const createResponse = await fetch(`${baseUrl}/contacts/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${piToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify(contactPayload),
    });

    const createResponseText = await createResponse.text();
    let createResponseData;
    
    try {
      createResponseData = JSON.parse(createResponseText);
    } catch {
      createResponseData = { raw: createResponseText };
    }

    if (!createResponse.ok) {
      // Normalize duplicate detection via shared helper.
      const errBody = (createResponseData ?? {}) as AgentCrmCreateContactErrorBody;
      const errorMessageRaw =
        createResponseData?.message || createResponseData?.error || "";
      const errorMessage =
        typeof errorMessageRaw === "string"
          ? errorMessageRaw
          : Array.isArray(errorMessageRaw)
            ? errorMessageRaw.join(" ")
            : "";
      const isDuplicateError = agentCrmIsDuplicateContactError(
        createResponse.status,
        errBody
      );

      console.warn("[create-contact] LeadConnector POST /contacts/ failed:", {
        httpStatus: createResponse.status,
        statusText: createResponse.statusText,
        classifiedAsDuplicate: isDuplicateError,
        messageString: errorMessage || undefined,
        meta: errBody.meta,
        bodySnippet:
          typeof createResponseText === "string"
            ? createResponseText.slice(0, 4000)
            : undefined,
      });

      if (isDuplicateError) {
        console.log(
          "[create-contact] Duplicate create detected, resolving existing contact..."
        );

        let existingContactId: string | null = null;
        const duplicateMetaId = errBody?.meta?.contactId;

        // 1) Fast path: duplicate error often includes meta.contactId.
        if (duplicateMetaId) {
          const full = await agentCrmFetchContactById(
            duplicateMetaId,
            locationId,
            piToken
          );
          existingContactId = full?.id ?? duplicateMetaId;
          console.log("[create-contact] Resolved duplicate via meta.contactId:", {
            duplicateMetaId,
            found: !!full,
          });
        }

        // 2) Fallback: robust POST /contacts/search by email.
        if (!existingContactId) {
          const found = await agentCrmFindContactByEmail(
            email,
            locationId,
            piToken,
            "[create-contact]"
          );
          existingContactId = found?.id ?? null;
        }

        // 3) Last resort: search by phone (duplicate keyed on phone, email mismatch, search quirks).
        if (!existingContactId && phone) {
          const byPhone = await agentCrmFindContactByPhone(
            phone,
            locationId,
            piToken,
            "[create-contact]"
          );
          existingContactId = byPhone?.id ?? null;
        }

        if (existingContactId) {
          // Update the existing contact with custom fields and tags (for STM leads)
          console.log("[create-contact] Found existing contact, updating (no workflow enrollment - early return):", {
            contactId: existingContactId,
            hasShortTermMedicalData: !!shortTermMedicalData,
            hasContactPageData: !!contactPageData,
            hasAcaData: !!acaData,
            hasDentalVisionData: !!dentalVisionData,
            hasHospitalIndemnityData: !!hospitalIndemnityData,
            hasIulLeadGenData: !!iulLeadGenData,
            hasFinalExpenseData: !!finalExpenseData,
          });

          const incomingTags = [
            ...stmTags,
            ...contactPageTags,
            ...acaTags,
            ...dentalVisionTags,
            ...hospitalIndemnityTags,
            ...iulLeadGenTags,
            ...finalExpenseTags,
          ];

          const buildMergePayload = async (
            mergeContactId: string,
            includePhone: boolean,
            includeEmail: boolean,
            includeCustomFields: boolean
          ): Promise<Record<string, unknown>> => {
            const existingRow = await agentCrmFetchContactById(
              mergeContactId,
              locationId,
              piToken
            );
            const priorTags = existingRow?.tags ?? [];
            const mergedTags = [...new Set([...priorTags, ...incomingTags])];
            const p: Record<string, unknown> = {
              firstName,
              lastName,
            };
            if (includeEmail) {
              p.email = email;
            }
            if (includePhone) {
              p.phone = phone;
            }
            if (includeCustomFields && customFieldsArray.length > 0) {
              p.customFields = customFieldsArray;
            }
            if (mergedTags.length > 0) {
              p.tags = mergedTags;
            }
            return p;
          };

          const putHeaders = {
            Accept: "application/json",
            Authorization: `Bearer ${piToken}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          } as const;

          const putTo = (contactId: string, payload: Record<string, unknown>) =>
            fetch(
              `${baseUrl}/contacts/${encodeURIComponent(
                contactId
              )}?${new URLSearchParams({ locationId })}`,
              {
                method: "PUT",
                headers: putHeaders,
                body: JSON.stringify(payload),
              }
            );

          try {
            let targetId = existingContactId;
            let includePhone = true;
            let includeEmail = true;
            let includeCf = true;

            let updateResponse: Response | null = null;

            /**
             * Split-duplicate case: email on contact A, phone on contact B.
             * Follow meta.contactId and adjust which fields we send (omit phone/email when API says they belong on another record).
             */
            for (let attempt = 0; attempt < 12; attempt++) {
              updateResponse = await putTo(
                targetId,
                await buildMergePayload(
                  targetId,
                  includePhone,
                  includeEmail,
                  includeCf
                )
              );

              if (updateResponse.ok) {
                break;
              }

              const errTxt = await updateResponse.text();
              const parsed = parseLeadConnectorErrorJson(errTxt);

              if (
                updateResponse.status === 400 &&
                isLocationDuplicateContactsError(parsed?.message) &&
                parsed?.meta
              ) {
                const nextId = parsed.meta.contactId;
                const mf = (parsed.meta.matchingField || "").toLowerCase();

                if (nextId && nextId !== targetId) {
                  console.log(
                    "[create-contact] Duplicate policy: switching merge target",
                    {
                      from: targetId,
                      to: nextId,
                      matchingField: parsed.meta.matchingField,
                    }
                  );
                  targetId = nextId;
                  if (mf.includes("phone")) {
                    includePhone = false;
                  }
                  if (mf.includes("email")) {
                    // API points at the contact that owns this email — update that record with the submitted email.
                    includeEmail = true;
                  }
                  continue;
                }

                if (mf.includes("phone")) {
                  includePhone = false;
                  continue;
                }
                if (mf.includes("email")) {
                  includeEmail = false;
                  continue;
                }
              }

              if (includeCf) {
                console.warn(
                  "[create-contact] Merge PUT failed; retrying without custom fields:",
                  updateResponse.status,
                  errTxt.slice(0, 400)
                );
                includeCf = false;
                continue;
              }

              console.warn(
                "[create-contact] Merge PUT failed (no more duplicate redirects):",
                updateResponse.status,
                errTxt.slice(0, 500)
              );
              break;
            }

            if (!updateResponse?.ok) {
              updateResponse = await putTo(
                targetId,
                await buildMergePayload(targetId, includePhone, includeEmail, false)
              );
            }

            if (!updateResponse.ok) {
              updateResponse = await putTo(
                targetId,
                await buildMergePayload(
                  targetId,
                  false,
                  includeEmail,
                  false
                )
              );
            }

            if (!updateResponse.ok) {
              updateResponse = await putTo(
                targetId,
                await buildMergePayload(targetId, false, false, false)
              );
            }

            if (!updateResponse.ok) {
              const bare: Record<string, unknown> = { firstName, lastName };
              if (includeEmail) bare.email = email;
              updateResponse = await putTo(targetId, bare);
            }

            if (updateResponse.ok) {
              console.log(
                "[create-contact] Successfully updated existing contact (duplicate path)",
                { contactId: targetId }
              );
              const capiDispatched = await trySendMetaLeadCapiLead(request, {
                meta: meta as CreateContactMetaBody | undefined,
                email,
                phone,
                firstName,
                lastName,
                isNewContact: false,
                shortTermMedicalData,
                contactPageData,
                acaData,
                dentalVisionData,
                hospitalIndemnityData,
                finalExpenseData,
                getCoveredFastData,
                iulLeadGenData,
              });
              return NextResponse.json({
                success: true,
                message: "Contact updated successfully!",
                contactId: targetId,
                isExisting: true,
                capiDispatched,
              });
            }

            const finalErr = await updateResponse.text().catch(() => "");
            console.error(
              "[create-contact] All duplicate merge PUT attempts failed:",
              finalErr
            );
            return NextResponse.json(
              {
                success: false,
                error:
                  "This email or phone is already on file, but we could not refresh the contact. Please try again.",
                contactId: targetId,
                isExisting: true,
              },
              { status: 502 }
            );
          } catch (updateErr) {
            console.error("[create-contact] Duplicate merge PUT error:", updateErr);
            return NextResponse.json(
              {
                success: false,
                error:
                  "This email or phone is already on file, but the update failed. Please try again.",
                contactId: existingContactId,
                isExisting: true,
              },
              { status: 502 }
            );
          }
        }

        // Duplicate reported but could not resolve contact id.
        // Return an error so clients can retry, instead of false-success with missing contactId.
        console.error(
          "[create-contact] Duplicate reported but contact ID could not be resolved.",
          {
            status: createResponse.status,
            errorMessage,
            duplicateMetaId: errBody?.meta?.contactId ?? null,
          }
        );
        return NextResponse.json(
          {
            success: false,
            error:
              "Duplicate contact was reported but could not be resolved. Please retry.",
            status: createResponse.status,
          },
          { status: 409 }
        );
      }
      
      // For other errors, return the error
      console.error('Failed to create contact:', createResponseData);
      return NextResponse.json({
        success: false,
        error: `Failed to create contact: ${errorMessage || createResponse.statusText}`,
        details: createResponseData,
        status: createResponse.status,
      }, { status: createResponse.status });
    }

    const contactId = createResponseData.contact?.id || createResponseData.id;
    const isNewContact = true; // This is a new contact (we just created it)

    if (shortTermMedicalData || contactPageData || acaData || dentalVisionData || hospitalIndemnityData || finalExpenseData || getCoveredFastData) {
      console.log("[create-contact] Specialty lead (incl. Final Expense / Get Covered Fast) created - will NOT add to generic Notification / IUL where excluded (contactId:", contactId, ")");
    }

    // Helper function to add contact to a workflow
    const addContactToWorkflow = async (workflowId: string, workflowName: string): Promise<void> => {
      if (!workflowId || !contactId) {
        return;
      }

      try {
        // Add contact to workflow
        // LeadConnector API: POST /contacts/{contactId}/workflow/{workflowId}?locationId={locationId}
        // Based on documentation: https://marketplace.gohighlevel.com/docs/ghl/workflows/get-workflow
        const workflowResponse = await fetch(`${baseUrl}/contacts/${contactId}/workflow/${workflowId}?locationId=${locationId}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${piToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28',
          },
        });

        if (workflowResponse.ok) {
          const workflowData = await workflowResponse.json().catch(() => ({}));
          console.log(`[Workflow] Successfully added contact ${contactId} to ${workflowName} workflow (${workflowId})`);
          if (process.env.NODE_ENV === "development") {
            console.log('[Workflow] Response:', workflowData);
          }
        } else {
          const workflowErrorText = await workflowResponse.text();
          console.warn(`[Workflow] Failed to add contact to ${workflowName} workflow (non-blocking):`, {
            workflowId,
            status: workflowResponse.status,
            statusText: workflowResponse.statusText,
            error: workflowErrorText,
          });
        }
      } catch (workflowError) {
        // Log error but don't fail the request - workflow activation is non-critical
        console.error(`[Workflow] Error activating ${workflowName} workflow (non-blocking):`, workflowError);
      }
    };

    // Step 1: Activate notification workflow FIRST (if configured) - skip for specialty page leads, IUL, and Final Expense (tagged fe_get_covered_funnel instead)
    const notificationWorkflowId = process.env.AGENT_CRM_WORKFLOW_NOTIFICATION;
    const willAddNotification = !!(
      notificationWorkflowId &&
      contactId &&
      !shortTermMedicalData &&
      !contactPageData &&
      !acaData &&
      !dentalVisionData &&
      !hospitalIndemnityData &&
      !iulLeadGenData &&
      !finalExpenseData &&
      !getCoveredFastData
    );
    console.log("[create-contact] Notification workflow:", {
      workflowId: notificationWorkflowId ?? "not configured",
      willAdd: willAddNotification,
      reason: !notificationWorkflowId
        ? "no env"
        : !contactId
          ? "no contactId"
          : iulLeadGenData
            ? "IUL lead — use AGENT_CRM_WORKFLOW_IUL only"
            : finalExpenseData
              ? "Final Expense lead — tagged fe_get_covered_funnel (no notification workflow)"
              : shortTermMedicalData || contactPageData || acaData || dentalVisionData || hospitalIndemnityData
                ? "specialty page lead - skipped"
                : "generic website lead",
    });
    if (willAddNotification) {
      await addContactToWorkflow(notificationWorkflowId, "Notification");
    }

    // Step 2: IUL lead workflow — single workflow; CRM can branch EN/ES via language / tags inside the workflow
    const iulWorkflowId = process.env.AGENT_CRM_WORKFLOW_IUL;
    const language = iulLeadGenData?.language || shortTermMedicalData?.language || acaData?.language || dentalVisionData?.language || hospitalIndemnityData?.language || 'en';
    const iulLangLabel =
      typeof language === "string" && language.toLowerCase().startsWith("es")
        ? "es"
        : "en";
    const iulConditionMet = !!(iulLeadGenData && !shortTermMedicalData && !contactPageData && !acaData && !dentalVisionData && !hospitalIndemnityData && !finalExpenseData && !getCoveredFastData);
    const willAddIul = !!(iulConditionMet && iulWorkflowId && contactId);

    console.log("[create-contact] IUL workflow decision:", {
      iulConditionMet,
      hasIulLeadGenData: !!iulLeadGenData,
      hasShortTermMedicalData: !!shortTermMedicalData,
      language,
      iulLangLabel,
      workflowId: iulWorkflowId ?? "not configured",
      willAddIul,
      reason: !iulConditionMet
        ? shortTermMedicalData || contactPageData || acaData || dentalVisionData || hospitalIndemnityData
          ? "specialty page lead - iulConditionMet is false"
          : "no iulLeadGenData"
        : !iulWorkflowId
          ? "AGENT_CRM_WORKFLOW_IUL not set"
          : "IUL lead — adding to workflow",
    });

    if (willAddIul) {
      await addContactToWorkflow(iulWorkflowId!, `IUL (${iulLangLabel})`);
    } else if (shortTermMedicalData || contactPageData || acaData || dentalVisionData || hospitalIndemnityData) {
      console.log("[create-contact] IUL workflow NOT added - specialty page lead (contactId:", contactId, ")");
    }

    // Step 3: Short Term Medical — one workflow; CRM branches EN/ES (e.g. via tags) inside that workflow
    const stmWorkflowId = process.env.AGENT_CRM_WORKFLOW_STM;
    const stmLanguage = shortTermMedicalData?.language === "es" ? "es" : "en";
    const willAddStm = !!(shortTermMedicalData && contactId && stmWorkflowId);

    console.log("[create-contact] STM workflow decision:", {
      hasShortTermMedicalData: !!shortTermMedicalData,
      stmLanguage,
      workflowId: stmWorkflowId ?? "not configured",
      willAddStm,
      reason: !shortTermMedicalData
        ? "not an STM lead"
        : !stmWorkflowId
          ? "AGENT_CRM_WORKFLOW_STM not set"
          : "STM lead — adding to workflow",
    });

    if (willAddStm) {
      await addContactToWorkflow(stmWorkflowId!, `STM (${stmLanguage})`);
    }

    // Step 4: Contact page — one workflow; CRM can branch EN/ES via tags / internal logic
    const contactWorkflowId = process.env.AGENT_CRM_WORKFLOW_CONTACT;
    const contactLanguage = contactPageData?.language === "es" ? "es" : "en";
    const willAddContactPage = !!(
      contactPageData &&
      !shortTermMedicalData &&
      !acaData &&
      !dentalVisionData &&
      !hospitalIndemnityData &&
      !getCoveredFastData &&
      contactId &&
      contactWorkflowId
    );

    console.log("[create-contact] Contact page workflow decision:", {
      hasContactPageData: !!contactPageData,
      contactLanguage,
      workflowId: contactWorkflowId ?? "not configured",
      willAddContactPage,
      reason: !contactPageData
        ? "not a contact-page lead"
        : shortTermMedicalData || acaData || dentalVisionData || hospitalIndemnityData
          ? "other lead type — skipped"
          : !contactWorkflowId
            ? "AGENT_CRM_WORKFLOW_CONTACT not set"
            : "contact-page lead — adding to workflow",
    });

    if (willAddContactPage) {
      await addContactToWorkflow(contactWorkflowId!, `Contact page (${contactLanguage})`);
    }

    // Get Covered Fast funnel — same contact workflow as /contact (tags differentiate the lead)
    const gcfLanguage = getCoveredFastData?.language === "es" ? "es" : "en";
    const willAddGetCoveredFast = !!(
      getCoveredFastData &&
      contactId &&
      contactWorkflowId &&
      !contactPageData
    );

    console.log("[create-contact] Get Covered Fast workflow decision:", {
      hasGetCoveredFastData: !!getCoveredFastData,
      gcfLanguage,
      workflowId: contactWorkflowId ?? "not configured",
      willAddGetCoveredFast,
      reason: !getCoveredFastData
        ? "not a Get Covered Fast lead"
        : contactPageData
          ? "contact-page payload also present — skipped"
          : !contactWorkflowId
            ? "AGENT_CRM_WORKFLOW_CONTACT not set"
            : "Get Covered Fast — adding to contact workflow",
    });

    if (willAddGetCoveredFast) {
      await addContactToWorkflow(contactWorkflowId!, `Get covered fast (${gcfLanguage})`);
    }

    // Step 5: ACA page — dedicated workflow
    const acaWorkflowId = process.env.AGENT_CRM_WORKFLOW_ACA;
    const acaLanguage = acaData?.language === "es" ? "es" : "en";
    const willAddAca = !!(
      acaData &&
      !shortTermMedicalData &&
      !contactPageData &&
      !dentalVisionData &&
      !hospitalIndemnityData &&
      contactId &&
      acaWorkflowId
    );

    console.log("[create-contact] ACA workflow decision:", {
      hasAcaData: !!acaData,
      acaLanguage,
      workflowId: acaWorkflowId ?? "not configured",
      willAddAca,
      reason: !acaData
        ? "not an ACA lead"
        : shortTermMedicalData || contactPageData || dentalVisionData || hospitalIndemnityData
          ? "other lead type — skipped"
          : !acaWorkflowId
            ? "AGENT_CRM_WORKFLOW_ACA not set"
            : "ACA lead — adding to workflow",
    });

    if (willAddAca) {
      await addContactToWorkflow(acaWorkflowId!, `ACA (${acaLanguage})`);
    }

    // Step 6: Dental & Vision — dedicated workflow
    const dentalWorkflowId = process.env.AGENT_CRM_WORKFLOW_DENTAL;
    const dentalLanguage = dentalVisionData?.language === "es" ? "es" : "en";
    const willAddDentalVision = !!(
      dentalVisionData &&
      !shortTermMedicalData &&
      !contactPageData &&
      !acaData &&
      !hospitalIndemnityData &&
      contactId &&
      dentalWorkflowId
    );

    console.log("[create-contact] Dental & Vision workflow decision:", {
      hasDentalVisionData: !!dentalVisionData,
      dentalLanguage,
      workflowId: dentalWorkflowId ?? "not configured",
      willAddDentalVision,
      reason: !dentalVisionData
        ? "not a Dental & Vision lead"
        : shortTermMedicalData || contactPageData || acaData || hospitalIndemnityData
          ? "other lead type — skipped"
          : !dentalWorkflowId
            ? "AGENT_CRM_WORKFLOW_DENTAL not set"
            : "Dental & Vision lead — adding to workflow",
    });

    if (willAddDentalVision) {
      await addContactToWorkflow(dentalWorkflowId!, `Dental & Vision (${dentalLanguage})`);
    }

    // Step 7: Hospital Indemnity — dedicated workflow
    const hiWorkflowId = process.env.AGENT_CRM_WORKFLOW_HI;
    const hiLanguage = hospitalIndemnityData?.language === "es" ? "es" : "en";
    const willAddHospitalIndemnity = !!(
      hospitalIndemnityData &&
      !shortTermMedicalData &&
      !contactPageData &&
      !acaData &&
      !dentalVisionData &&
      contactId &&
      hiWorkflowId
    );

    console.log("[create-contact] Hospital Indemnity workflow decision:", {
      hasHospitalIndemnityData: !!hospitalIndemnityData,
      hiLanguage,
      workflowId: hiWorkflowId ?? "not configured",
      willAddHospitalIndemnity,
      reason: !hospitalIndemnityData
        ? "not a Hospital Indemnity lead"
        : shortTermMedicalData || contactPageData || acaData || dentalVisionData
          ? "other lead type — skipped"
          : !hiWorkflowId
            ? "AGENT_CRM_WORKFLOW_HI not set"
            : "Hospital Indemnity lead — adding to workflow",
    });

    if (willAddHospitalIndemnity) {
      await addContactToWorkflow(hiWorkflowId!, `Hospital Indemnity (${hiLanguage})`);
    }

    // Final Expense leads: fe_get_covered_funnel tag only (no AGENT_CRM_WORKFLOW_FINALE enrollment)

    // Meta CAPI Lead — newly created row; FE get-covered duplicate-merge path sends CAPI in duplicate branch helper
    const capiDispatched = await trySendMetaLeadCapiLead(request, {
      meta: meta as CreateContactMetaBody | undefined,
      email,
      phone,
      firstName,
      lastName,
      isNewContact,
      shortTermMedicalData,
      contactPageData,
      acaData,
      dentalVisionData,
      hospitalIndemnityData,
      finalExpenseData,
      getCoveredFastData,
      iulLeadGenData,
    });

    // Success!
    return NextResponse.json({
      success: true,
      message: "Contact created successfully!",
      contact: createResponseData.contact || createResponseData,
      contactId: contactId,
      isExisting: false,
      capiDispatched,
    });

  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to create contact",
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

