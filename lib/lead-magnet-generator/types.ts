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

export interface LeadMagnetImages {
  coverImage: string;
  sectionImages: string[];
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
