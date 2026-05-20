import crypto from "crypto";
import type { NextRequest } from "next/server";

/** GHL Ed25519 public key (X-GHL-Signature). */
const GHL_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

/** Legacy RSA public key (X-WH-Signature). */
const LEGACY_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSCFrm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfBcsedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpvuxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKUJ062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXpIocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzNh/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhCHULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJPQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAykT1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

function verifyLegacyRsa(payload: string, signature: string): boolean {
  if (!signature || signature === "N/A") return false;
  try {
    const verifier = crypto.createVerify("SHA256");
    verifier.update(payload);
    return verifier.verify(LEGACY_PUBLIC_KEY_PEM, signature, "base64");
  } catch {
    return false;
  }
}

function verifyGhlEd25519(payload: string, signature: string): boolean {
  if (!signature || signature === "N/A") return false;
  try {
    const payloadBuffer = Buffer.from(payload, "utf8");
    const signatureBuffer = Buffer.from(signature, "base64");
    return crypto.verify(null, payloadBuffer, GHL_PUBLIC_KEY_PEM, signatureBuffer);
  } catch {
    return false;
  }
}

export function verifyGhlWebhookSignature(
  rawBody: string,
  headers: Headers
): boolean {
  const ghlSig = headers.get("x-ghl-signature");
  const legacySig = headers.get("x-wh-signature");
  if (ghlSig && verifyGhlEd25519(rawBody, ghlSig)) return true;
  if (legacySig && verifyLegacyRsa(rawBody, legacySig)) return true;
  return false;
}

export type WebhookAuthResult =
  | { ok: true; method: "bearer" | "header" | "query" | "ghl_signature" | "legacy_signature" }
  | { ok: false; reason: string };

export function verifyCallSummaryWebhookAuthDetailed(
  req: NextRequest,
  rawBody: string,
  webhookSecret: string | null
): WebhookAuthResult {
  if (webhookSecret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${webhookSecret}`) return { ok: true, method: "bearer" };

    const headerToken = req.headers.get("x-call-summary-secret");
    if (headerToken === webhookSecret) return { ok: true, method: "header" };

    const queryToken = req.nextUrl.searchParams.get("token");
    if (queryToken === webhookSecret) return { ok: true, method: "query" };
  }

  const ghlSig = req.headers.get("x-ghl-signature");
  const legacySig = req.headers.get("x-wh-signature");
  if (ghlSig && verifyGhlEd25519(rawBody, ghlSig)) return { ok: true, method: "ghl_signature" };
  if (legacySig && verifyLegacyRsa(rawBody, legacySig)) return { ok: true, method: "legacy_signature" };

  if (webhookSecret) {
    return { ok: false, reason: "secret_mismatch_and_no_valid_ghl_signature" };
  }
  if (ghlSig || legacySig) {
    return { ok: false, reason: "ghl_signature_invalid" };
  }
  return { ok: false, reason: "no_auth_credentials" };
}

export function verifyCallSummaryWebhookAuth(
  req: NextRequest,
  rawBody: string,
  webhookSecret: string | null
): boolean {
  return verifyCallSummaryWebhookAuthDetailed(req, rawBody, webhookSecret).ok;
}
