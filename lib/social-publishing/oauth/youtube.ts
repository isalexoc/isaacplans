const BASE  = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

export function buildYouTubeAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri:  process.env.YOUTUBE_OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `${BASE}?${params}`;
}

export async function exchangeYouTubeCode(code: string): Promise<{
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
      redirect_uri:  process.env.YOUTUBE_OAUTH_REDIRECT_URI!,
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

export async function refreshYouTubeToken(refreshToken: string): Promise<{
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

export async function getYouTubeChannelInfo(accessToken: string): Promise<{
  channelId: string;
  channelTitle: string;
}> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "Failed to fetch YouTube channel info");
  const channel = data.items?.[0];
  if (!channel) throw new Error("No YouTube channel found for this account");
  return {
    channelId:    channel.id,
    channelTitle: channel.snippet?.title ?? channel.id,
  };
}
