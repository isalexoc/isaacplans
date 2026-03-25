import type { Guide } from "@/components/guide-card";

export type GuideCategory = Guide["category"];

/** Map Sanity blog `category` slug to consumer-guide CRM category (workflow routing). */
export function mapBlogCategoryToGuideCategory(raw?: string): GuideCategory {
  if (!raw?.trim()) return "aca";
  const k = raw.trim().toLowerCase().replace(/_/g, "-");
  const map: Record<string, GuideCategory> = {
    aca: "aca",
    "short-term-medical": "shortTerm",
    shortterm: "shortTerm",
    "dental-vision": "dentalVision",
    dentalvision: "dentalVision",
    "hospital-indemnity": "hospitalIndemnity",
    hospitalindemnity: "hospitalIndemnity",
    iul: "iul",
    "final-expense": "finalExpense",
    finalexpense: "finalExpense",
    "cancer-plans": "aca",
    "heart-stroke": "aca",
    general: "aca",
    "tips-guides": "aca",
    news: "aca",
  };
  return map[k] ?? "aca";
}

export type GuideLeadFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  marketingConsent: boolean;
};

type BuildBodyParams = Omit<GuideLeadFormValues, "phone"> & {
  /** E.164 phone, e.g. +15551234567 */
  phoneE164: string;
  locale: string;
  guideId: string;
  guideName: string;
  category: GuideCategory;
  meta?: {
    eventId?: string;
    fbp?: string;
    fbc?: string;
    eventSourceUrl?: string;
  };
};

/**
 * Maps consumer guide category to the same CRM payload shapes as full product pages
 * so `create-contact` applies AGENT_CRM_WORKFLOW_ACA, _STM, _DENTAL, _HI, _IUL, _FINALE.
 */
export function buildGuideLeadCrmBody(params: BuildBodyParams): Record<string, unknown> {
  const {
    firstName,
    lastName,
    email,
    phoneE164,
    locale,
    guideId,
    guideName,
    category,
    smsConsent,
    marketingConsent,
    meta,
  } = params;

  const language = locale.startsWith("es") ? "es" : "en";
  const guideFields = {
    language,
    smsConsent,
    marketingConsent,
    source: "consumer_guides",
    guideId,
    guideName,
  };

  const specialty: Record<string, unknown> = (() => {
    switch (category) {
      case "aca":
        return { acaData: guideFields };
      case "shortTerm":
        return { shortTermMedicalData: guideFields };
      case "dentalVision":
        return { dentalVisionData: guideFields };
      case "hospitalIndemnity":
        return { hospitalIndemnityData: guideFields };
      case "finalExpense":
        return { finalExpenseData: guideFields };
      case "iul":
        return {
          iulLeadGenData: {
            ...guideFields,
            source: "consumer_guides",
          },
        };
      default: {
        const _exhaustive: never = category;
        return _exhaustive;
      }
    }
  })();

  return {
    firstName,
    lastName,
    email,
    phone: phoneE164,
    ...specialty,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
}
