const BASE = "https://www.facebook.com/dialog/oauth";
const GRAPH = "https://graph.facebook.com/v21.0";

export function buildMetaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    redirect_uri:  process.env.META_OAUTH_REDIRECT_URI!,
    scope:         "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish",
    state,
    response_type: "code",
  });
  return `${BASE}?${params}`;
}

/** Exchange short-lived code → short-lived user token → long-lived user token (60 days). */
export async function exchangeMetaCode(code: string): Promise<{
  userAccessToken: string;
  expiresAt: Date;
}> {
  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id:     process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri:  process.env.META_OAUTH_REDIRECT_URI!,
      code,
    })}`
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(tokenData.error.message);

  // Exchange for long-lived token
  const llRes = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type:        "fb_exchange_token",
      client_id:         process.env.META_APP_ID!,
      client_secret:     process.env.META_APP_SECRET!,
      fb_exchange_token: tokenData.access_token,
    })}`
  );
  const llData = await llRes.json();
  if (llData.error) throw new Error(llData.error.message);

  const expiresAt = new Date(Date.now() + (llData.expires_in ?? 5184000) * 1000);
  return { userAccessToken: llData.access_token, expiresAt };
}

/** Get all Facebook Pages the user manages; returns first one (agent typically has one page). */
export async function getPageToken(userAccessToken: string): Promise<{
  pageId: string;
  pageName: string;
  pageAccessToken: string;
}> {
  const res = await fetch(
    `${GRAPH}/me/accounts?access_token=${userAccessToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (!data.data?.length) throw new Error("No Facebook Pages found for this account");
  const page = data.data[0];
  return { pageId: page.id, pageName: page.name, pageAccessToken: page.access_token };
}

/** Derive Instagram Business Account ID from the connected Facebook Page. */
export async function getInstagramUserId(pageId: string, pageAccessToken: string): Promise<{
  igUserId: string;
  igUsername: string;
} | null> {
  const res = await fetch(
    `${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
  );
  const data = await res.json();
  if (!data.instagram_business_account?.id) return null;
  const igId = data.instagram_business_account.id;

  const profileRes = await fetch(
    `${GRAPH}/${igId}?fields=username&access_token=${pageAccessToken}`
  );
  const profile = await profileRes.json();
  return { igUserId: igId, igUsername: profile.username ?? igId };
}
