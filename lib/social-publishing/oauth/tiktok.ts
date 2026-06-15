import { createHash, randomBytes } from "crypto";

const BASE  = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildTikTokAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_key:             process.env.TIKTOK_CLIENT_KEY!,
    redirect_uri:           process.env.TIKTOK_REDIRECT_URI!,
    response_type:          "code",
    scope:                  "user.info.basic,video.upload,video.publish",
    state,
    code_challenge:         codeChallenge,
    code_challenge_method:  "S256",
  });
  return `${BASE}?${params}`;
}

export async function exchangeTikTokCode(code: string, codeVerifier: string): Promise<{
  accessToken: string;
  refreshToken: string;
  openId: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key:    process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      redirect_uri:  process.env.TIKTOK_REDIRECT_URI!,
      code,
      grant_type:    "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);
  return {
    accessToken:      data.access_token,
    refreshToken:     data.refresh_token,
    openId:           data.open_id,
    accessExpiresAt:  new Date(Date.now() + data.expires_in * 1000),
    refreshExpiresAt: new Date(Date.now() + (data.refresh_expires_in ?? 31536000) * 1000),
  };
}

export async function refreshTikTokToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
}> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key:    process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description ?? data.error);
  return {
    accessToken:     data.access_token,
    refreshToken:    data.refresh_token,
    accessExpiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getTikTokDisplayName(accessToken: string, openId: string): Promise<string> {
  const res = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  return data.data?.user?.display_name ?? openId;
}
