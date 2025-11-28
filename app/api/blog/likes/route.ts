import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogLikes } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postId, postSlug } = body;

    if (!postId || !postSlug) {
      return NextResponse.json(
        { error: "Post ID and slug required" },
        { status: 400 }
      );
    }

    // Check if user already liked this post
    const existingLike = await db
      .select()
      .from(blogLikes)
      .where(
        and(
          eq(blogLikes.postId, postId),
          eq(blogLikes.userId, userId)
        )
      )
      .limit(1);

    let liked: boolean;
    
    if (existingLike.length > 0) {
      // Unlike: Delete the like
      await db
        .delete(blogLikes)
        .where(
          and(
            eq(blogLikes.postId, postId),
            eq(blogLikes.userId, userId)
          )
        );
      liked = false;
    } else {
      // Like: Create new like record
      await db.insert(blogLikes).values({
        id: `like_${postId}_${userId}_${Date.now()}`,
        postId,
        postSlug,
        userId,
      });
      liked = true;
    }

    // Get updated like count
    const likeCountResult = await db
      .select({ count: count() })
      .from(blogLikes)
      .where(eq(blogLikes.postId, postId));

    const likeCount = likeCountResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      liked,
      count: likeCount,
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user liked and get count
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "Post ID required" },
        { status: 400 }
      );
    }

    // Get like count
    const likeCountResult = await db
      .select({ count: count() })
      .from(blogLikes)
      .where(eq(blogLikes.postId, postId));

    const likeCount = likeCountResult[0]?.count || 0;

    // Check if user liked (if authenticated)
    let liked = false;
    if (userId) {
      const userLike = await db
        .select()
        .from(blogLikes)
        .where(
          and(
            eq(blogLikes.postId, postId),
            eq(blogLikes.userId, userId)
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
    console.error("Error fetching likes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

