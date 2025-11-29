import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogComments, blogCommentLikes } from "@/lib/db/schema";
import { and, eq, count } from "drizzle-orm";
import { nanoid } from "nanoid";

// POST /api/blog/comments/[id]/like - toggle like on a comment
export async function POST(
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

    const { id: commentId } = await params;

    // Get the comment to check ownership
    const comment = await db
      .select()
      .from(blogComments)
      .where(eq(blogComments.id, commentId))
      .limit(1);

    if (comment.length === 0) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 }
      );
    }

    // Prevent users from liking their own comments (industry standard)
    if (comment[0].userId === userId) {
      return NextResponse.json(
        { success: false, error: "Cannot like your own comment" },
        { status: 400 }
      );
    }

    // Check if user already liked this comment
    const existingLike = await db
      .select()
      .from(blogCommentLikes)
      .where(
        and(
          eq(blogCommentLikes.commentId, commentId),
          eq(blogCommentLikes.userId, userId)
        )
      )
      .limit(1);

    let liked: boolean;

    if (existingLike.length > 0) {
      // Unlike: Delete the like
      await db
        .delete(blogCommentLikes)
        .where(
          and(
            eq(blogCommentLikes.commentId, commentId),
            eq(blogCommentLikes.userId, userId)
          )
        );
      liked = false;
    } else {
      // Like: Create new like record
      await db.insert(blogCommentLikes).values({
        id: nanoid(),
        commentId,
        userId,
      });
      liked = true;
    }

    // Get updated like count
    const likeCountResult = await db
      .select({ count: count() })
      .from(blogCommentLikes)
      .where(eq(blogCommentLikes.commentId, commentId));

    const likeCount = likeCountResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      liked,
      count: likeCount,
    });
  } catch (error) {
    console.error("Error toggling comment like:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/blog/comments/[id]/like - get like status and count
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id: commentId } = await params;

    // Get like count
    const likeCountResult = await db
      .select({ count: count() })
      .from(blogCommentLikes)
      .where(eq(blogCommentLikes.commentId, commentId));

    const likeCount = Number(likeCountResult[0]?.count || 0);

    // Check if user liked (if authenticated)
    let liked = false;
    if (userId) {
      const userLike = await db
        .select()
        .from(blogCommentLikes)
        .where(
          and(
            eq(blogCommentLikes.commentId, commentId),
            eq(blogCommentLikes.userId, userId)
          )
        )
        .limit(1);

      liked = userLike.length > 0;
    }

    return NextResponse.json({
      success: true,
      liked,
      count: likeCount,
    });
  } catch (error) {
    console.error("Error fetching comment like:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

