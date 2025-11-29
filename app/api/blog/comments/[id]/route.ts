import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogComments } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// PATCH /api/blog/comments/[id] - update user's own comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { content } = body ?? {};

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Content is required" },
        { status: 400 }
      );
    }

    const trimmed = String(content).trim();
    if (!trimmed) {
      return NextResponse.json(
        { success: false, error: "Comment cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmed.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Comment is too long" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(blogComments)
      .set({ 
        body: trimmed,
        updatedAt: new Date(),
      })
      .where(and(eq(blogComments.id, id), eq(blogComments.userId, userId)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: "Comment not found or unauthorized" },
        { status: 404 }
      );
    }

    const comment = updated[0];
    return NextResponse.json({
      success: true,
      item: {
        ...comment,
        createdAt: comment.createdAt?.toISOString(),
        updatedAt: comment.updatedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/blog/comments/[id] - soft-hide user's own comment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    await db
      .update(blogComments)
      .set({ status: "hidden" })
      .where(and(eq(blogComments.id, id), eq(blogComments.userId, userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}


