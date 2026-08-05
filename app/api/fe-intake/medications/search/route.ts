import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Proxies NIH's free, keyless RxTerms Clinical Table Search Service for medication-name
 * autocomplete. Server-side so there's no CORS/browser-key concern. Response shape is the
 * standard Clinical Table format: [totalResults, displayNames[], extraData|null, displayRows[]] —
 * we only need the display-name array. No RxCUI is needed since the "what's it for" step is a
 * static curated condition list, not a live drug-class lookup.
 */

const RXTERMS_BASE = "https://clinicaltables.nlm.nih.gov/api/rxterms/v1/search";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const url = `${RXTERMS_BASE}?terms=${encodeURIComponent(q)}&maxList=20`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn("[fe-intake] RxTerms search failed:", res.status);
      return NextResponse.json({ success: true, results: [] });
    }
    const data = (await res.json()) as unknown;
    const names = Array.isArray(data) && Array.isArray(data[1]) ? (data[1] as unknown[]) : [];
    const results = Array.from(
      new Set(names.filter((n): n is string => typeof n === "string" && n.trim().length > 0))
    );

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.warn("[fe-intake] Medication search error:", error);
    // Never block the form on a flaky external API — the client falls back to free text.
    return NextResponse.json({ success: true, results: [] });
  }
}
