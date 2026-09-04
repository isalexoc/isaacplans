import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getLiveObjectionsConfig } from "@/lib/live-objections/config";

/**
 * Mints one ElevenLabs single-use token so the browser can open a Scribe v2 Realtime socket
 * directly, without ever seeing ELEVENLABS_API_KEY.
 *
 * Browser-direct is not a shortcut, it is the only shape that works here: Vercel serverless cannot
 * hold a long-lived inbound socket, so there is no way to proxy realtime audio through this app.
 * It is also the vendor's own documented path — their client-side streaming guide says "Never
 * expose your API key to the client" and hands you this token endpoint instead.
 *
 * The token expires after 15 minutes and is consumed on first use, so the client asks for a fresh
 * one per socket: one to arm, plus one per reconnect. That is by design, not waste — a leaked
 * token buys fifteen minutes of transcription and nothing else.
 *
 * Middleware already enforces admin on /api/admin/*; the auth() check below is defence in depth,
 * the same belt-and-braces as app/api/admin/call-study/sign/route.ts.
 */
export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = getLiveObjectionsConfig();
  if (!config.apiKey) {
    console.error("[live-objections/token] ELEVENLABS_API_KEY is not set");
    return NextResponse.json(
      { success: false, error: "Live listening is not configured on this deployment." },
      { status: 500 }
    );
  }
  if (!config.enabled) {
    return NextResponse.json(
      { success: false, error: "Live listening is switched off (LIVE_OBJECTIONS_ENABLED)." },
      { status: 403 }
    );
  }

  let res: Response;
  try {
    res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "xi-api-key": config.apiKey },
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    console.error("[live-objections/token] could not reach ElevenLabs:", message);
    return NextResponse.json(
      { success: false, error: "Could not reach ElevenLabs." },
      { status: 502 }
    );
  }

  const text = await res.text();
  if (!res.ok) {
    // Logged, never returned: their validation errors are genuinely useful when debugging, but the
    // browser gets a status code only. A 401 here means the key is wrong; a 403 usually means the
    // Scribe terms have not been accepted on the account.
    console.error(`[live-objections/token] rejected (${res.status}):`, text.slice(0, 300));
    return NextResponse.json(
      { success: false, error: `ElevenLabs refused the token request (${res.status}).` },
      { status: 502 }
    );
  }

  let token: string | null = null;
  try {
    const body = JSON.parse(text) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : null;
  } catch {
    /* fall through to the null check */
  }
  if (!token) {
    return NextResponse.json(
      { success: false, error: "ElevenLabs returned no token." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    token,
    wsUrl: config.wsUrl,
    model: config.model,
    maxSessionMinutes: config.maxSessionMinutes,
  });
}
