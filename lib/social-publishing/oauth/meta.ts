const BASE = "https://www.facebook.com/dialog/oauth";
const GRAPH = "https://graph.facebook.com/v21.0";

export function buildMetaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID!,
    redirect_uri:  process.env.META_OAUTH_REDIRECT_URI!,
    scope:         "pages_show_list,pages_manage_posts,pages_read_engagement,business_management",
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
  // 0. Check granted permissions so we can give a precise error if pages_show_list is missing
  const permRes = await fetch(`${GRAPH}/me/permissions?access_token=${userAccessToken}`);
  const permData = await permRes.json();
  const grantedPerms: string[] = (permData.data ?? [])
    .filter((p: { permission: string; status: string }) => p.status === "granted")
    .map((p: { permission: string }) => p.permission);
  console.error("[getPageToken] Granted permissions:", grantedPerms);

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

  console.error("[getPageToken] /me/accounts returned 0 pages. Granted perms:", grantedPerms);

  // 2. Business Manager fallback — pages owned by a Business account
  const bizRes = await fetch(
    `${GRAPH}/me/businesses?fields=id,name,owned_pages{id,name,access_token}&limit=10&access_token=${userAccessToken}`
  );
  const bizData = await bizRes.json();
  console.error("[getPageToken] /me/businesses:", JSON.stringify(bizData).slice(0, 500));

  if (!bizData.error) {
    for (const biz of bizData.data ?? []) {
      const pages = biz.owned_pages?.data ?? [];
      if (pages.length) {
        const page = pages[0];
        return { pageId: page.id, pageName: page.name, pageAccessToken: page.access_token };
      }
    }
  }

  if (!grantedPerms.includes("pages_show_list")) {
    throw new Error(
      `Facebook did not grant the "pages_show_list" permission. ` +
      `When reconnecting, look for the page-selection step in the Facebook dialog ` +
      `and make sure to select your Business Page before clicking Continue.`
    );
  }

  throw new Error(
    `No Facebook Pages found. Your token has pages_show_list but no pages are returned. ` +
    `Make sure your Facebook account (Isaac Orraiz) is listed as a Page Admin directly — ` +
    `not just a Business Manager user. Check facebook.com/pages to see which pages you admin.`
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
