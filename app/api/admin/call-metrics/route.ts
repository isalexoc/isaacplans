import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, like, sql } from "drizzle-orm";
import { getIsAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { callSummaryProcessed } from "@/lib/db/schema";

const ALLOWED_DAYS = new Set([7, 30, 90]);

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  const daysParam = Number.parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [dispositionCounts, lobCounts, completedResult, skippedNoAnswerResult] = await Promise.all([
      db
        .select({ disposition: callSummaryProcessed.disposition, count: sql<number>`count(*)::int` })
        .from(callSummaryProcessed)
        .where(and(eq(callSummaryProcessed.status, "completed"), gte(callSummaryProcessed.processedAt, cutoff)))
        .groupBy(callSummaryProcessed.disposition),
      db
        .select({ lineOfBusiness: callSummaryProcessed.lineOfBusiness, count: sql<number>`count(*)::int` })
        .from(callSummaryProcessed)
        .where(and(eq(callSummaryProcessed.status, "completed"), gte(callSummaryProcessed.processedAt, cutoff)))
        .groupBy(callSummaryProcessed.lineOfBusiness),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(callSummaryProcessed)
        .where(and(eq(callSummaryProcessed.status, "completed"), gte(callSummaryProcessed.processedAt, cutoff))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(callSummaryProcessed)
        .where(
          and(
            eq(callSummaryProcessed.status, "skipped"),
            gte(callSummaryProcessed.processedAt, cutoff),
            like(callSummaryProcessed.errorMessage, "call_status_%")
          )
        ),
    ]);

    const completed = completedResult[0]?.count ?? 0;
    const skippedNoAnswer = skippedNoAnswerResult[0]?.count ?? 0;
    const totalDialAttempts = completed + skippedNoAnswer;
    const contactRate = totalDialAttempts > 0 ? completed / totalDialAttempts : null;

    return NextResponse.json({
      success: true,
      days,
      totalCallEvents: totalDialAttempts,
      completed,
      skippedNoAnswer,
      contactRate,
      dispositionCounts: dispositionCounts
        .filter((r) => r.disposition)
        .map((r) => ({ key: r.disposition as string, count: r.count })),
      lineOfBusinessCounts: lobCounts
        .filter((r) => r.lineOfBusiness)
        .map((r) => ({ key: r.lineOfBusiness as string, count: r.count })),
    });
  } catch (error) {
    console.error("[admin/call-metrics]", error);
    return NextResponse.json({ success: false, error: "Failed to load call metrics" }, { status: 500 });
  }
}
