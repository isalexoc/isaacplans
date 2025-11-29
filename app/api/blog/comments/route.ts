import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { blogComments, blogCommentLikes } from "@/lib/db/schema";
import { and, desc, eq, isNull, lt, count, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendCommentNotification } from "@/lib/email/notifications";
import { client } from "@/sanity/lib/client";

// GET /api/blog/comments?postId=...&parentId=...&cursor=...&limit=...
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const parentId = searchParams.get("parentId");
    const cursor = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(parseInt(limitParam || "10", 10), 50);

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "postId is required" },
        { status: 400 }
      );
    }

    const conditions = [
      eq(blogComments.postId, postId),
      eq(blogComments.status, "approved"),
    ];

    if (parentId) {
      conditions.push(eq(blogComments.parentId, parentId));
    } else {
      conditions.push(isNull(blogComments.parentId));
    }

    if (cursor) {
      conditions.push(lt(blogComments.createdAt, new Date(cursor)));
    }

    const items = await db
      .select()
      .from(blogComments)
      .where(and(...conditions))
      .orderBy(desc(blogComments.createdAt))
      .limit(limit + 1); // fetch one extra to determine next cursor

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const last = items[limit - 1];
      nextCursor = last.createdAt ? last.createdAt.toISOString() : null;
      items.length = limit;
    }

    // Get like counts for all comments
    const commentIds = items.map((item) => item.id);
    const likeCounts = commentIds.length > 0
      ? await db
          .select({
            commentId: blogCommentLikes.commentId,
            count: count(),
          })
          .from(blogCommentLikes)
          .where(inArray(blogCommentLikes.commentId, commentIds))
          .groupBy(blogCommentLikes.commentId)
      : [];

    const likeCountMap = new Map(
      likeCounts.map((lc) => [lc.commentId, Number(lc.count)])
    );

    // Get user data for all comment authors
    const userIds = [...new Set(items.map((item) => item.userId))];
    const clerk = await clerkClient();
    const userPromises = userIds.map((uid) =>
      clerk.users.getUser(uid).catch(() => null)
    );
    const clerkUsers = await Promise.all(userPromises);
    const userMap = new Map(
      clerkUsers
        .filter((u): u is NonNullable<typeof u> => u !== null)
        .map((u) => [
          u.id,
          {
            id: u.id,
            imageUrl: u.imageUrl || null,
            firstName: u.firstName || null,
            lastName: u.lastName || null,
            username: u.username || null,
            initials:
              u.firstName && u.lastName
                ? `${u.firstName[0]}${u.lastName[0]}`
                : u.firstName
                ? u.firstName[0]
                : u.username
                ? u.username[0].toUpperCase()
                : "?",
          },
        ])
    );

    // Check if current user liked any comments
    let userLikedMap = new Map<string, boolean>();
    if (userId && commentIds.length > 0) {
      const userLikes = await db
        .select()
        .from(blogCommentLikes)
        .where(
          and(
            eq(blogCommentLikes.userId, userId),
            inArray(blogCommentLikes.commentId, commentIds)
          )
        );
      userLikedMap = new Map(userLikes.map((ul) => [ul.commentId, true]));
    }

    // Enrich items with user data and like counts
    const enrichedItems = items.map((item) => {
      const user = userMap.get(item.userId);
      return {
        ...item,
        createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: item.updatedAt?.toISOString() || null,
        user: user || null,
        likeCount: likeCountMap.get(item.id) || 0,
        isLiked: userLikedMap.get(item.id) || false,
      };
    });

    return NextResponse.json({ success: true, items: enrichedItems, nextCursor });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/blog/comments
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postId, postSlug, content, parentId } = body ?? {};

    if (!postId || !postSlug || !content) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
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

    const id = nanoid();
    const now = new Date();

    await db.insert(blogComments).values({
      id,
      postId,
      postSlug,
      userId,
      parentId: parentId || null,
      body: trimmed,
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });

    // Send email notification asynchronously (don't await - fire and forget)
    // Only send for top-level comments (not replies)
    if (!parentId) {
      // Fetch post title from Sanity and get user info from Clerk
      Promise.all([
        // Fetch post title from Sanity
        client
          .fetch(
            `*[_type == "post" && _id == $postId][0]{ title, locale }`,
            { postId },
            { next: { revalidate: 0 } } // Don't cache for notifications
          )
          .catch(() => null),
        // Get user info from Clerk
        currentUser().catch(() => null),
      ])
        .then(([post, user]) => {
          if (post && post.title) {
            return sendCommentNotification({
              postTitle: post.title,
              postSlug,
              postLocale: post.locale || "en",
              commentBody: trimmed,
              commenterName: user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.firstName || user?.username || undefined,
              commenterEmail: user?.primaryEmailAddress?.emailAddress || undefined,
              commentId: id,
            });
          }
        })
        .catch((error) => {
          console.error("Error in comment notification background task:", error);
        });
    }

    return NextResponse.json({
      success: true,
      item: {
        id,
        postId,
        postSlug,
        userId,
        parentId: parentId || null,
        body: trimmed,
        status: "approved",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}


