import { cache } from "react";
import { client } from "@/sanity/lib/client";

/**
 * Agent license metadata from Sanity (`agentLicense` documents).
 *
 * Sanity stores only metadata — the license images themselves live in
 * Cloudinary with authenticated delivery and are served exclusively through
 * the admin-gated /api/admin/license-image proxy. This module is also the
 * whitelist for that proxy: only keys resolvable here can be requested.
 *
 * The page render path must only ever call getAgentLicenseStates() — its
 * query selects just { code, name }, so Cloudinary public IDs never enter
 * the RSC payload. getLicensePublicId() is for the API route only.
 */

const licensesFetchOptions = {
  next: { revalidate: 3600, tags: ["agent-licenses"] },
};

export const AGENT_LICENSE_STATES_QUERY = `*[_type == "agentLicense" && active == true && licenseType == "state"] | order(order asc) {
  "code": state->code,
  "name": state->name
}`;

/** States with an active license — feeds the presentation dropdown. */
export const getAgentLicenseStates = cache(
  async (): Promise<{ code: string; name: string }[]> => {
    try {
      const states = await client.fetch<{ code: string | null; name: string | null }[]>(
        AGENT_LICENSE_STATES_QUERY,
        {},
        licensesFetchOptions
      );
      return states.filter(
        (state): state is { code: string; name: string } => Boolean(state.code && state.name)
      );
    } catch (error) {
      console.error("Failed to fetch agent license states from Sanity:", error);
      return [];
    }
  }
);

export interface AdminAgentLicense {
  key: string;
  name: string;
  active: boolean;
}

/** All licenses (active + inactive) for the admin management page — no public IDs. */
export const AGENT_LICENSES_ADMIN_QUERY = `*[_type == "agentLicense"] | order(order asc) {
  "key": select(licenseType == "drivers" => "drivers", state->code),
  "name": select(licenseType == "drivers" => "Driver's License", state->name),
  "active": active != false
}`;

export const getAgentLicensesForAdmin = cache(async (): Promise<AdminAgentLicense[]> => {
  try {
    const rows = await client.fetch<{ key: string | null; name: string | null; active: boolean }[]>(
      AGENT_LICENSES_ADMIN_QUERY,
      {},
      licensesFetchOptions
    );
    return rows.filter((row): row is AdminAgentLicense => Boolean(row.key && row.name));
  } catch (error) {
    console.error("Failed to fetch agent licenses for admin:", error);
    return [];
  }
});

export const LICENSE_PUBLIC_ID_QUERY = `*[_type == "agentLicense" && active == true && (
  ($key == "drivers" && licenseType == "drivers") ||
  (licenseType == "state" && state->code == $key)
)][0].cloudinaryPublicId`;

/**
 * Resolve a license key ("drivers" or a 2-letter state code) to its Cloudinary
 * public ID. Returns null for unknown keys — Sanity is the whitelist.
 */
export async function getLicensePublicId(key: string): Promise<string | null> {
  const normalizedKey = key === "drivers" ? "drivers" : key.toUpperCase();
  try {
    const publicId = await client.fetch<string | null>(
      LICENSE_PUBLIC_ID_QUERY,
      { key: normalizedKey },
      licensesFetchOptions
    );
    return publicId ?? null;
  } catch (error) {
    console.error("Failed to resolve license public ID from Sanity:", error);
    return null;
  }
}
