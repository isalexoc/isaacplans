export interface YouTubeMetadata {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  thumbnailUrl: string;
  durationSeconds: number;
  publishedAt: string;
  url: string;
}

export interface YouTubeExtractionResult {
  metadata: YouTubeMetadata;
  transcript: string;
  transcriptLanguage: string;
  extractedAt: string;
}

export interface ExtractResponse {
  success: true;
  data: YouTubeExtractionResult;
}

export interface ExtractErrorResponse {
  success: false;
  error: string;
}

// --- Phase 2 types ---

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

export type BlogCategory =
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

export const VALID_CATEGORIES: BlogCategory[] = [
  "aca",
  "temporary-health-insurance",
  "dental-vision",
  "hospital-indemnity",
  "iul",
  "final-expense",
  "cancer-plans",
  "heart-stroke",
  "general",
  "tips-guides",
  "news",
];

export interface GeneratedBlogContent {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  bodyBlocks: PortableTextBlock[];
  category: BlogCategory;
  tags: string[];
  readingTime: number;
  seo: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    keywords: string[];
  };
}

export interface GenerateRequest {
  extraction: YouTubeExtractionResult;
}

export interface GenerateResponse {
  success: true;
  data: GeneratedBlogContent;
}

export interface GenerateErrorResponse {
  success: false;
  error: string;
}

// --- Phase 3 types ---

export interface TranslatedBlogContent {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  bodyBlocks: PortableTextBlock[];
  tags: string[];
  seo: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    keywords: string[];
  };
}

export interface SanityPublishResult {
  enPostId: string;
  esPostId: string;
  enSlug: string;
  esSlug: string;
}

export interface PublishRequest {
  content: GeneratedBlogContent;
  extraction: YouTubeExtractionResult;
  cta?: CTASettings;
  status?: "draft" | "published";
  images?: BilingualImages;
}

export interface PublishResponse {
  success: true;
  data: SanityPublishResult;
}

export interface PublishErrorResponse {
  success: false;
  error: string;
}

// --- Phase 5 types ---

export interface CTASettings {
  enableCTA: boolean;
  ctaType: "quote" | "consultation" | "contact";
  ctaText: string;
  ctaPosition: "top" | "middle" | "bottom" | "floating";
}

// --- Phase 6 types ---

export interface GeneratedImage {
  assetId: string;
  url: string;
  prompt: string;
  revisedPrompt: string;
  alt: string;
}

export interface GeneratedImages {
  featured: GeneratedImage;
  body: [GeneratedImage, GeneratedImage, GeneratedImage];
}

export interface BilingualImages {
  en: GeneratedImages;
  es: GeneratedImages;
}

export interface GenerateImagesRequest {
  content: GeneratedBlogContent;
}

export interface GenerateImagesResponse {
  success: true;
  data: BilingualImages;
}

export interface GenerateImagesErrorResponse {
  success: false;
  error: string;
}

export type RegenerateField = "title" | "excerpt" | "body";

export interface RegenerateRequest {
  field: RegenerateField;
  extraction: YouTubeExtractionResult;
  currentContent: GeneratedBlogContent;
}

export interface RegenerateResponse {
  success: true;
  data: { field: RegenerateField; value: string };
}

export interface RegenerateErrorResponse {
  success: false;
  error: string;
}
