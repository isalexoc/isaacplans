const BASE = "https://www.facebook.com/dialog/oauth";
const GRAPH = "https://graph.facebook.com/v21.0";

export function buildMetaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    redirect_uri:  process.env.META_OAUTH_REDIRECT_URI!,
    scope:         "pages_show_list,pages_manage_posts,pages_read_engagement",
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

/** Get all Facebook Pages the user manages; returns first one. */
export async function getPageToken(userAccessToken: string): Promise<{
  pageId: string;
  pageName: string;
  pageAccessToken: string;
}> {
  // 1. Standard endpoint — works for most personal-account page admins
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token&limit=25&access_token=${userAccessToken}`
  );
  const data = await res.json();

  if (data.error) {
    console.error("[getPageToken] /me/accounts API error:", data.error);
    throw new Error(`Facebook API error: ${data.error.message}`);
  }

  if (data.data?.length) {
    const page = data.data[0];
    return { pageId: page.id, pageName: page.name, pageAccessToken: page.access_token };
  }

  // 2. Fetch user ID, then try /{userId}/accounts — sometimes differs from /me for Business accounts
  const meRes = await fetch(`${GRAPH}/me?fields=id,name&access_token=${userAccessToken}`);
  const meData = await meRes.json();
  console.error("[getPageToken] /me/accounts returned 0 pages. User info:", meData, "Raw /me/accounts:", data);

  if (!meData.error && meData.id) {
    const res2 = await fetch(
      `${GRAPH}/${meData.id}/accounts?fields=id,name,access_token&limit=25&access_token=${userAccessToken}`
    );
    const data2 = await res2.json();
    if (!data2.error && data2.data?.length) {
      const page = data2.data[0];
      return { pageId: page.id, pageName: page.name, pageAccessToken: page.access_token };
    }
    console.error("[getPageToken] /{userId}/accounts also empty:", data2);
  }

  throw new Error(
    `No Facebook Pages found. In the Facebook permission dialog, click "Edit Settings" ` +
    `and explicitly select your Business Page — don't just click "Continue as [Name]". ` +
    `Also confirm your Facebook account is an Admin of the Page.`
  );
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
