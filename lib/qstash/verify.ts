/**
 * Verifies inbound QStash deliveries via the `Upstash-Signature` header.
 *
 * Follow the repo's webhook convention: read the raw body first, verify, then
 * parse. Endpoints called by QStash use this instead of the CRON_SECRET bearer.
 */
import type { NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import { getQStashConfig, isQStashReceiveConfigured, resolveTargetBaseUrl } from "./config";

let receiver: Receiver | null = null;

function getReceiver(): Receiver | null {
  const config = getQStashConfig();
  if (!config.currentSigningKey || !config.nextSigningKey) return null;
  if (!receiver) {
    receiver = new Receiver({
      currentSigningKey: config.currentSigningKey,
      nextSigningKey: config.nextSigningKey,
    });
  }
  return receiver;
}

/**
 * Verify a QStash request. Returns true only when the signature is valid against
 * the URL we published to. Returns false when receiving is unconfigured.
 */
export async function verifyQStashRequest(req: NextRequest, rawBody: string): Promise<boolean> {
  if (!isQStashReceiveConfigured()) return false;

  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  const rcv = getReceiver();
  if (!rcv) return false;

  // Reconstruct the exact URL QStash signed (matches `${baseUrl}${path}` from publishJob).
  const url = `${resolveTargetBaseUrl(req.nextUrl.origin) ?? req.nextUrl.origin}${req.nextUrl.pathname}`;

  try {
    return await rcv.verify({ body: rawBody, signature, url });
  } catch (err) {
    console.warn("[qstash] signature verification failed", { error: err });
    return false;
  }
}
