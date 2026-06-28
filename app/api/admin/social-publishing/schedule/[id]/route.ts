import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  cancelPost,
  reschedulePost,
  getScheduledPostById,
  setQstashMessageId,
} from "@/lib/social-publishing/scheduler";
import { publishJob, cancelJob } from "@/lib/qstash/client";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Read the QStash id before cancelling so we can also cancel the scheduled delivery.
  const existing = await getScheduledPostById(id);
  const ok = await cancelPost(id, userId);
  if (!ok) return NextResponse.json({ error: "Post not found or cannot be cancelled" }, { status: 404 });

  await cancelJob(existing?.qstashMessageId);
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

  const existing = await getScheduledPostById(id);
  const ok = await reschedulePost(id, userId, scheduledFor);
  if (!ok) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Replace the QStash scheduled delivery: cancel the old one, publish a new one.
  await cancelJob(existing?.qstashMessageId);
  const messageId = await publishJob({
    path: "/api/queue/social-publish",
    body: { scheduledPostId: id },
    notBefore: Math.floor(scheduledFor.getTime() / 1000),
    requestOrigin: req.nextUrl.origin,
    retries: 3,
  });
  await setQstashMessageId(id, messageId);

  return NextResponse.json({ success: true });
}
