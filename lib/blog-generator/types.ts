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
