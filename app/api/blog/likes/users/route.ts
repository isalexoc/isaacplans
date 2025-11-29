import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogLikes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/blog/likes/users?postId=...&limit=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(parseInt(limitParam || "5", 10), 10); // Max 10 users

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "postId is required" },
        { status: 400 }
      );
    }

    // Get user IDs who liked the post, ordered by most recent
    const likes = await db
      .select({
        userId: blogLikes.userId,
        createdAt: blogLikes.createdAt,
      })
      .from(blogLikes)
      .where(eq(blogLikes.postId, postId))
      .orderBy(desc(blogLikes.createdAt))
      .limit(limit);

    if (likes.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
        totalCount: 0,
      });
    }

    // Fetch user data from Clerk
    const userIds = likes.map((like) => like.userId);
    const clerk = await clerkClient();
    
    // Fetch users in parallel
    const userPromises = userIds.map((userId) =>
      clerk.users.getUser(userId).catch(() => null)
    );
    
    const clerkUsers = await Promise.all(userPromises);
    
    // Map to user data with fallbacks
    const users = clerkUsers
      .filter((user): user is NonNullable<typeof user> => user !== null)
      .map((user) => ({
        id: user.id,
        imageUrl: user.imageUrl || null,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        username: user.username || null,
        // Generate initials for fallback
        initials: user.firstName && user.lastName
          ? `${user.firstName[0]}${user.lastName[0]}`
          : user.firstName
          ? user.firstName[0]
          : user.username
          ? user.username[0].toUpperCase()
          : "?",
      }));

    // Get total count
    const totalCountResult = await db
      .select()
      .from(blogLikes)
      .where(eq(blogLikes.postId, postId));
    
    const totalCount = totalCountResult.length;

    return NextResponse.json({
      success: true,
      users,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching like users:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

