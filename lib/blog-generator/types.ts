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
