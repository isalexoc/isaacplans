import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getScheduledPostsInRange } from "@/lib/social-publishing/scheduler";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const fromStr = searchParams.get("from");
  const toStr   = searchParams.get("to");

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from and to query params required" }, { status: 400 });
  }

  const from = new Date(fromStr);
  const to   = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const posts = await getScheduledPostsInRange(from, to);
  // Filter to current user only
  const userPosts = posts.filter((p) => p.userId === userId);

  return NextResponse.json({ success: true, data: userPosts });
}
