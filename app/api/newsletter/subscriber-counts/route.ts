import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

export const maxDuration = 10;

// GET /api/newsletter/subscriber-counts
// Returns confirmed subscriber counts grouped by locale.
// Requires Clerk authentication (admin use only — called from Sanity Studio action).
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [enResult, esResult] = await Promise.all([
      db
        .select({ count: count() })
        .from(newsletterSubscribers)
        .where(
          and(
            eq(newsletterSubscribers.status, "confirmed"),
            eq(newsletterSubscribers.locale, "en")
          )
        ),
      db
        .select({ count: count() })
        .from(newsletterSubscribers)
        .where(
          and(
            eq(newsletterSubscribers.status, "confirmed"),
            eq(newsletterSubscribers.locale, "es")
          )
        ),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        en: enResult[0]?.count ?? 0,
        es: esResult[0]?.count ?? 0,
      },
    });
  } catch (error: any) {
    console.error("[NEWSLETTER] Error fetching subscriber counts:", error.message);
    return NextResponse.json(
      { success: false, error: "Failed to fetch subscriber counts" },
      { status: 500 }
    );
  }
}
