import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cancelPost, reschedulePost } from "@/lib/social-publishing/scheduler";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await cancelPost(id, userId);
  if (!ok) return NextResponse.json({ error: "Post not found or cannot be cancelled" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json() as { scheduledFor: string };
  if (!body.scheduledFor) return NextResponse.json({ error: "scheduledFor required" }, { status: 400 });
  const scheduledFor = new Date(body.scheduledFor);
  if (isNaN(scheduledFor.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const ok = await reschedulePost(id, userId, scheduledFor);
  if (!ok) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
