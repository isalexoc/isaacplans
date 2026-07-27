import cloudinary from "@/config/cloudinary";
import { getLicensePublicId } from "@/lib/agent-licenses";

/**
 * Fetches an agent license image from Cloudinary server-side.
 *
 * License assets use the `authenticated` delivery type — they refuse any
 * unsigned request. The signed URL is generated here with the API secret and
 * never leaves the server. Callers must already be authorized (the admin proxy
 * route via middleware, or a secret-guarded automation endpoint).
 *
 * The candidate chain mirrors /api/admin/license-image: on-the-fly
 * transformations may be blocked for authenticated assets (account-dependent),
 * so we fall back to the signed original, then to a legacy `upload` copy for
 * assets not yet flipped by scripts/privatize-license-images.ts.
 *
 * Returns null for unknown keys (Sanity is the whitelist) or when every
 * candidate fails.
 */
export async function fetchAgentLicenseImage(
  key: string,
  opts?: { width?: number; height?: number }
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const publicId = await getLicensePublicId(key);
  if (!publicId) return null;

  const width = opts?.width ?? 1200;
  const height = opts?.height ?? 800;

  const transformation = [
    { width, height, crop: "fit" as const, quality: "auto", fetch_format: "auto" },
  ];

  const candidates = [
    cloudinary.url(publicId, {
      resource_type: "image",
      type: "authenticated",
      sign_url: true,
      secure: true,
      transformation,
    }),
    cloudinary.url(publicId, {
      resource_type: "image",
      type: "authenticated",
      sign_url: true,
      secure: true,
    }),
    cloudinary.url(publicId, {
      resource_type: "image",
      type: "upload",
      sign_url: true,
      secure: true,
      transformation,
    }),
  ];

  for (const url of candidates) {
    const response = await fetch(url);
    if (!response.ok) continue;

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get("content-type") ?? "image/png",
    };
  }

  return null;
}

/**
 * Same as fetchAgentLicenseImage but returns a base64 `data:` URI, ready to
 * embed as an <img src> in a server-rendered (next/og) image.
 */
export async function fetchAgentLicenseImageDataUri(
  key: string,
  opts?: { width?: number; height?: number }
): Promise<string | null> {
  const result = await fetchAgentLicenseImage(key, opts);
  if (!result) return null;
  return `data:${result.contentType};base64,${result.buffer.toString("base64")}`;
}
