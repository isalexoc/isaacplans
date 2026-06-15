const BASE  = "https://threads.net/oauth/authorize";
const TOKEN = "https://graph.threads.net/oauth/access_token";
const GRAPH = "https://graph.threads.net/v1.0";

export function buildThreadsAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.THREADS_APP_ID!,
    redirect_uri:  process.env.THREADS_OAUTH_REDIRECT_URI!,
    scope:         "threads_basic,threads_content_publish",
    response_type: "code",
    state,
  });
  return `${BASE}?${params}`;
}

export async function exchangeThreadsCode(code: string): Promise<{
  accessToken: string;
  threadsUserId: string;
}> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.THREADS_APP_ID!,
      client_secret: process.env.THREADS_APP_SECRET!,
      redirect_uri:  process.env.THREADS_OAUTH_REDIRECT_URI!,
      code,
      grant_type:    "authorization_code",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_message ?? data.error);

  // Exchange for long-lived token
  const llRes = await fetch(
    `${GRAPH}/access_token?${new URLSearchParams({
      grant_type:        "th_exchange_token",
      client_secret:     process.env.THREADS_APP_SECRET!,
      access_token:      data.access_token,
    })}`
  );
  const llData = await llRes.json();
  if (llData.error) throw new Error(llData.error.message ?? "Token exchange failed");

  return { accessToken: llData.access_token, threadsUserId: String(data.user_id) };
}
