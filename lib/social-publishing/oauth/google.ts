const BASE  = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
// Use the v4 API for account/location lookups — the newer split APIs
// (mybusinessaccountmanagement / mybusinessbusinessinformation) require
// explicit allowlisting and have a 0 QPM quota until approved.
const MYB   = "https://mybusiness.googleapis.com/v4";

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri:  process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/business.manage",
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `${BASE}?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_SECRET!,
      redirect_uri:  process.env.GOOGLE_OAUTH_REDIRECT_URI!,
      code,
      grant_type:    "authorization_code",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_SECRET!,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);
  return {
    accessToken: data.access_token,
    expiresAt:   new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Get the first GBP account + first location associated with the token.
 *
 * Set GOOGLE_BUSINESS_LOCATION_ID in your env to bypass the API lookup
 * (needed until the project is allowlisted for the Account Management API).
 * Format: "accounts/{accountId}/locations/{locationId}"
 */
export async function getGbpLocation(accessToken: string): Promise<{
  accountId: string;
  locationId: string;
  locationName: string;
}> {
  const envLocationId = process.env.GOOGLE_BUSINESS_LOCATION_ID;
  if (envLocationId) {
    const accountId = envLocationId.split("/locations/")[0] ?? envLocationId;
    return {
      accountId,
      locationId:   envLocationId,
      locationName: process.env.GOOGLE_BUSINESS_LOCATION_NAME ?? "Isaac Plans Insurance",
    };
  }

  const accountsRes = await fetch(`${MYB}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!accountsRes.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`GBP accounts API returned HTTP ${accountsRes.status} (not JSON). Set GOOGLE_BUSINESS_LOCATION_ID env var to bypass.`);
  }
  const accountsData = await accountsRes.json();
  if (accountsData.error) throw new Error(accountsData.error.message);
  if (!accountsData.accounts?.length) throw new Error("No Google Business accounts found");

  const account = accountsData.accounts[0];
  const accountId = account.name; // e.g. "accounts/123"

  const locsRes = await fetch(`${MYB}/${accountId}/locations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!locsRes.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`GBP locations API returned HTTP ${locsRes.status} (not JSON). Set GOOGLE_BUSINESS_LOCATION_ID env var to bypass.`);
  }
  const locsData = await locsRes.json();
  if (locsData.error) throw new Error(locsData.error.message);
  if (!locsData.locations?.length) throw new Error("No Google Business locations found");

  const loc = locsData.locations[0];
  return {
    accountId,
    locationId:   loc.name,
    locationName: loc.locationName ?? loc.name,
  };
}
