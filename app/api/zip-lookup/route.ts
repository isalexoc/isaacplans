import { NextRequest, NextResponse } from "next/server";

/**
 * Resolves US ZIP → state using Zippopotam (public, no API key).
 * @see https://www.zippopotam.us
 */
export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip")?.trim() ?? "";
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "invalid_zip" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      next: { revalidate: 86400 },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const data = (await res.json()) as {
      places?: Array<{
        state?: string;
        "state abbreviation"?: string;
        "place name"?: string;
      }>;
    };

    const place = data.places?.[0];
    const stateAbbr = place?.["state abbreviation"]?.trim();
    const stateName = place?.state?.trim();

    if (!stateAbbr) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      state: stateAbbr,
      stateName: stateName ?? stateAbbr,
      placeName: place?.["place name"]?.trim(),
    });
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
