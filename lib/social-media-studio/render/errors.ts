/**
 * Error raised by a render provider for a *permanent* failure — a misconfiguration or
 * client error (bad/mismatched API key, disabled account, malformed request) that retrying
 * will never fix. The video-job worker treats these as terminal instead of burning 4 retries
 * (each of which re-runs the expensive storyboard rebuild + TTS prep).
 */
export class RenderPermanentError extends Error {
  readonly statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "RenderPermanentError";
    this.statusCode = statusCode;
  }
}
