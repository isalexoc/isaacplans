import { publishJob } from "@/lib/qstash/client";
import { setJobQstashMessageId } from "./video-job-store";

/** App path QStash calls back for each video-job tick. */
export const SOCIAL_VIDEO_QUEUE_PATH = "/api/queue/social-video";

/**
 * Publish one QStash tick for a video job and remember its message id (for cancel /
 * reschedule). Returns null when QStash is disabled/unconfigured — callers treat a null
 * as "durable path unavailable" and fall back accordingly.
 */
export async function enqueueVideoJobTick(
  jobId: string,
  opts?: { delaySeconds?: number; requestOrigin?: string },
): Promise<string | null> {
  const messageId = await publishJob({
    path: SOCIAL_VIDEO_QUEUE_PATH,
    body: { jobId },
    delaySeconds: opts?.delaySeconds,
    requestOrigin: opts?.requestOrigin,
  });
  if (messageId) await setJobQstashMessageId(jobId, messageId);
  return messageId;
}
