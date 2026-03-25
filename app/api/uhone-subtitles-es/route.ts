import { NextResponse } from "next/server";

/** Default Spanish WebVTT on Cloudinary (raw); timings already include 3s lead-in. */
const DEFAULT_VTT_URL =
  "https://res.cloudinary.com/isaacdev/raw/upload/v1774445937/uhone_golden_rule_es_delayed_3s_vqmzvg.vtt";

function pickVttUrl(): string {
  const candidates = [
    process.env.UHONE_STM_VTT_ES_URL,
    process.env.NEXT_PUBLIC_UHONE_STM_VTT_ES_URL,
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    const t = c.trim();
    // Same-origin proxy only fetches allowlisted Cloudinary URLs (avoid SSRF).
    if (t.startsWith("https://res.cloudinary.com/isaacdev/")) {
      return t;
    }
  }
  return DEFAULT_VTT_URL;
}

/**
 * Proxies Spanish WebVTT from Cloudinary so the browser loads captions same-origin
 * (required for <track> — cross-origin .vtt often fails without permissive CORS).
 */
export async function GET() {
  const url = pickVttUrl();
  try {
    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Subtitle fetch failed" },
        { status: 502 }
      );
    }
    const text = await res.text();
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Subtitle fetch failed" },
      { status: 502 }
    );
  }
}
