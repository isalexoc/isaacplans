import { NextRequest, NextResponse } from "next/server";

// Temporary in-memory analytics store until database is set up
const analyticsStore: Array<{
  id: string;
  guideId: string;
  eventType: string;
  email?: string;
  phone?: string;
  source?: string;
  campaign?: string;
  userAgent?: string;
  referrer?: string;
  createdAt: Date;
}> = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guideId, eventType, email, phone, source, campaign } = body;

    if (!guideId || !eventType) {
      return NextResponse.json(
        { error: "Guide ID and event type required" },
        { status: 400 }
      );
    }

    // TODO: Uncomment once drizzle-orm is installed
    // const { db } = await import("@/lib/db");
    // const { guideAnalytics } = await import("@/lib/db/schema");
    // await db.insert(guideAnalytics).values({
    //   id: `analytics_${Date.now()}_${Math.random()}`,
    //   guideId,
    //   eventType,
    //   email: email || null,
    //   phone: phone || null,
    //   source: source || null,
    //   campaign: campaign || null,
    //   userAgent: request.headers.get("user-agent") || null,
    //   referrer: request.headers.get("referer") || null,
    // });

    // Temporary: Store in memory
    analyticsStore.push({
      id: `analytics_${Date.now()}_${Math.random()}`,
      guideId,
      eventType,
      email,
      phone,
      source,
      campaign,
      userAgent: request.headers.get("user-agent") || undefined,
      referrer: request.headers.get("referer") || undefined,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking analytics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint for admin analytics (optional - add authentication)
export async function GET(request: NextRequest) {
  // TODO: Add authentication for admin access
  // Return aggregated analytics data
  return NextResponse.json({ message: "Analytics endpoint - add authentication" });
}

