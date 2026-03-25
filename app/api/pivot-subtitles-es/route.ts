import { NextResponse } from "next/server";

/** Default Spanish WebVTT on Cloudinary (raw) for Pivot Health STM video */
const DEFAULT_VTT_URL =
  "https://res.cloudinary.com/isaacdev/raw/upload/v1774456700/pivot_health_es_b4fqr3.vtt";

function pickVttUrl(): string {
  const candidates = [
    process.env.PIVOT_STM_VTT_ES_URL,
    process.env.NEXT_PUBLIC_PIVOT_STM_VTT_ES_URL,
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    const t = c.trim();
    if (t.startsWith("https://res.cloudinary.com/isaacdev/")) {
      return t;
    }
  }
  return DEFAULT_VTT_URL;
}

/** Proxies Spanish WebVTT for same-origin <track> loading (CORS). */
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
