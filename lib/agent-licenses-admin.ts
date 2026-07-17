import { createClient } from "next-sanity";

/**
 * Write-side helper for agent licenses (used by the admin upload route).
 * Read helpers live in lib/agent-licenses.ts.
 */

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token: process.env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });
}

/** Resolve a Sanity state document _id by 2-letter code (null if unknown). */
export async function getStateIdByCode(code: string): Promise<string | null> {
  const client = getWriteClient();
  return client.fetch<string | null>(`*[_type == "state" && code == $code][0]._id`, {
    code: code.toUpperCase(),
  });
}

/**
 * Create-or-update the agentLicense doc for a license key ("az" … "drivers"),
 * pointing it at a freshly uploaded Cloudinary asset. Uses the same
 * deterministic _ids as scripts/add-agent-licenses-to-sanity.ts, so existing
 * docs keep their state reference and order — only the image swaps.
 */
export async function upsertAgentLicense(params: {
  key: string; // lowercase: "az" | ... | "drivers"
  stateId: string | null; // Sanity state._id, null for drivers
  publicId: string; // new Cloudinary public_id (authenticated delivery)
}): Promise<void> {
  const client = getWriteClient();
  const _id = `agentLicense-${params.key}`;

  const order = await client.fetch<number>(`count(*[_type == "agentLicense"])`);
  await client.createIfNotExists({
    _id,
    _type: "agentLicense",
    licenseType: params.key === "drivers" ? "drivers" : "state",
    ...(params.stateId ? { state: { _type: "reference", _ref: params.stateId } } : {}),
    cloudinaryPublicId: params.publicId,
    active: true,
    order,
  });
  await client.patch(_id).set({ cloudinaryPublicId: params.publicId, active: true }).commit();
}
