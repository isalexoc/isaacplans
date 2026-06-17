// ─── Portable Text (local fallback — @portabletext/types not installed) ───────

export interface PortableTextSpan {
  _type: "span";
  _key: string;
  text: string;
  marks: string[];
}

export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: string;
  children: PortableTextSpan[];
  markDefs: unknown[];
  listItem?: "bullet" | "number";
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export type LeadMagnetCategory =
  | "aca"
  | "temporary-health-insurance"
  | "dental-vision"
  | "hospital-indemnity"
  | "iul"
  | "final-expense"
  | "cancer-plans"
  | "heart-stroke"
  | "general"
  | "tips-guides"
  | "news";

export type LeadMagnetStatus = "draft" | "published" | "archived";
export type LeadMagnetLocale = "en" | "es";
export type LeadMagnetTone = "educational" | "conversational" | "urgent";

// ─── Prompt Input ─────────────────────────────────────────────────────────────

export interface LeadMagnetPromptInput {
  topic: string;
  category: LeadMagnetCategory;
  targetAudience: string;
  keyTopics: string[];
  tone: LeadMagnetTone;
  additionalContext?: string;
}

// ─── Outline ──────────────────────────────────────────────────────────────────

export interface LeadMagnetSection {
  sectionTitle: string;
  keyPoints: string[];
  content?: string;
  contentBlocks?: PortableTextBlock[];
  sectionImage?: string;
  wordCount?: number;
}

export interface LeadMagnetOutline {
  title: string;
  subtitle: string;
  targetAudience: string;
  category: LeadMagnetCategory;
  keyBenefits: string[];
  sections: LeadMagnetSection[];
  estimatedWordCount: number;
  estimatedPages: number;
}

// ─── Generated Content ────────────────────────────────────────────────────────

export interface GeneratedLeadMagnet {
  outline: LeadMagnetOutline;
  sections: LeadMagnetSection[];
  introduction: string;
  conclusion: string;
  introductionBlocks: PortableTextBlock[];
  conclusionBlocks: PortableTextBlock[];
}

// ─── Images ───────────────────────────────────────────────────────────────────

export interface PromoImages {
  square: string;     // 1080×1080
  landscape: string;  // 1200×630
}

export interface LeadMagnetImages {
  coverImage: string;
  sectionImages: string[];
  promoImages?: PromoImages;
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export interface LeadMagnetPublishInput {
  outline: LeadMagnetOutline;
  generatedContent: GeneratedLeadMagnet;
  images: LeadMagnetImages;
  pdfUrl: string;
  status: LeadMagnetStatus;
  originalPromptInput: LeadMagnetPromptInput;
}

export interface PublishedLeadMagnet {
  sanityDocumentId: string;
  slug: string;
  pdfUrl: string;
  publicUrl: string;
}

// ─── Bilingual Images ─────────────────────────────────────────────────────────

export interface BilingualLeadMagnetImages {
  en: LeadMagnetImages;
  es: LeadMagnetImages;
}

// ─── Image Regeneration ──────────────────────────────────────────────────────

export type LeadMagnetImageSlot = "cover" | `section-${number}`;

export interface LeadMagnetRegenerateImageRequest {
  locale: "en" | "es";
  slot: LeadMagnetImageSlot;
  outline: LeadMagnetOutline;
  promptInput?: LeadMagnetPromptInput;
  generatedContent?: GeneratedLeadMagnet;
}

export interface LeadMagnetRegenerateImageResponse {
  success: true;
  data: {
    locale: "en" | "es";
    slot: LeadMagnetImageSlot;
    imageUrl: string;
  };
}

export interface LeadMagnetRegenerateImageErrorResponse {
  success: false;
  error: string;
}

// ─── Translation ──────────────────────────────────────────────────────────────

export interface TranslatedLeadMagnet {
  outline: {
    title: string;
    subtitle: string;
    targetAudience: string;
    keyBenefits: string[];
    sections: Array<{ sectionTitle: string; keyPoints: string[] }>;
  };
  sections: Array<{
    sectionTitle: string;
    content: string;
    contentBlocks: PortableTextBlock[];
  }>;
  introduction: string;
  conclusion: string;
  introductionBlocks: PortableTextBlock[];
  conclusionBlocks: PortableTextBlock[];
  seo: { metaTitle: string; metaDescription: string; focusKeyword: string; keywords: string[] };
  leadFormSettings: { ctaHeadline: string; ctaSubtext: string; ctaButtonText: string; successMessage: string };
}

// ─── Bilingual Publishing ─────────────────────────────────────────────────────

export interface BilingualPublishedLeadMagnet {
  en: PublishedLeadMagnet;
  es: PublishedLeadMagnet;
}

export interface BilingualLeadMagnetPublishInput {
  outline: LeadMagnetOutline;
  generatedContent: GeneratedLeadMagnet;
  images: BilingualLeadMagnetImages;
  enPdfUrl: string;
  status: LeadMagnetStatus;
  originalPromptInput: LeadMagnetPromptInput;
  enSeoOverride: { metaTitle: string; metaDescription: string; focusKeyword: string };
  enLeadFormOverride: { ctaHeadline: string; ctaSubtext: string; ctaButtonText: string; successMessage: string };
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface LeadMagnetSuccessResponse<T> {
  success: true;
  data: T;
  warnings?: string[];
}

export interface LeadMagnetErrorResponse {
  success: false;
  error: string;
}

export type LeadMagnetApiResponse<T> =
  | LeadMagnetSuccessResponse<T>
  | LeadMagnetErrorResponse;
