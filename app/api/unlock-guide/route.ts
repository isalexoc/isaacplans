import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Temporary in-memory store until database is set up
const guideUnlocksStore = new Map<string, Set<string>>(); // identifier -> Set<guideIds>

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guideId, email, phone, source, campaign } = body;

    if (!guideId || (!email && !phone)) {
      return NextResponse.json(
        { error: "Guide ID and contact info (email or phone) required" },
        { status: 400 }
      );
    }

    // TODO: Uncomment once drizzle-orm is installed
    // const { db } = await import("@/lib/db");
    // const { guideUnlocks, guideAnalytics } = await import("@/lib/db/schema");
    // const { eq, and } = await import("drizzle-orm");

    const identifier = email || phone!;
    
    // Temporary: Use in-memory store until database is set up
    if (!guideUnlocksStore.has(identifier)) {
      guideUnlocksStore.set(identifier, new Set());
    }
    
    const userUnlocks = guideUnlocksStore.get(identifier)!;
    
    // Check if already unlocked
    if (userUnlocks.has(guideId)) {
      return NextResponse.json({ 
        success: true, 
        unlocked: true,
        guideId,
        alreadyUnlocked: true
      });
    }

    // Add to unlock store
    userUnlocks.add(guideId);

    // TODO: Replace with database operations once dependencies are installed
    // const unlockId = `${guideId}_${identifier}_${Date.now()}`;
    // await db.insert(guideUnlocks).values({
    //   id: unlockId,
    //   guideId,
    //   email: email || null,
    //   phone: phone || null,
    //   source: source || null,
    //   campaign: campaign || null,
    // });
    // await db.insert(guideAnalytics).values({
    //   id: `analytics_${Date.now()}_${Math.random()}`,
    //   guideId,
    //   eventType: "unlock",
    //   email: email || null,
    //   phone: phone || null,
    //   source: source || null,
    //   campaign: campaign || null,
    //   userAgent: request.headers.get("user-agent") || null,
    //   referrer: request.headers.get("referer") || null,
    // });

    // Set cookie for session persistence
    const cookieStore = await cookies();
    const cookieKey = `unlocked_guides_${identifier}`;
    const existingCookie = cookieStore.get(cookieKey);
    const existingUnlocks = existingCookie?.value 
      ? JSON.parse(existingCookie.value) 
      : [];
    
    if (!existingUnlocks.includes(guideId)) {
      existingUnlocks.push(guideId);
    }

    cookieStore.set(cookieKey, JSON.stringify(existingUnlocks), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: "/",
    });

    return NextResponse.json({ 
      success: true, 
      unlocked: true,
      guideId 
    });
  } catch (error) {
    console.error("Error unlocking guide:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const guideId = searchParams.get("guideId");
    const email = searchParams.get("email");
    const phone = searchParams.get("phone");
    const checkAny = searchParams.get("any") === "true"; // Check if user has unlocked ANY guide

    if (!email && !phone) {
      return NextResponse.json(
        { error: "Contact info (email or phone) required" },
        { status: 400 }
      );
    }

    const identifier = email || phone!;
    const userUnlocks = guideUnlocksStore.get(identifier);

    // Check if user has unlocked ANY guide
    if (checkAny) {
      const hasAnyUnlock = userUnlocks && userUnlocks.size > 0;
      return NextResponse.json({ 
        hasUnlockedAny: hasAnyUnlock,
        unlockedGuides: hasAnyUnlock ? Array.from(userUnlocks) : []
      });
    }

    // Check specific guide (original logic)
    if (!guideId) {
      return NextResponse.json(
        { error: "Guide ID required when checking specific guide" },
        { status: 400 }
      );
    }

    // TODO: Replace with database query once dependencies are installed
    // const result = await db
    //   .select()
    //   .from(guideUnlocks)
    //   .where(
    //     and(
    //       eq(guideUnlocks.guideId, guideId),
    //       email ? eq(guideUnlocks.email, email) : eq(guideUnlocks.phone, phone!)
    //     )
    //   )
    //   .limit(1);
    // return NextResponse.json({ unlocked: result.length > 0 });

    // Temporary: Use in-memory store
    const unlocked = userUnlocks?.has(guideId) || false;
    
    return NextResponse.json({ unlocked });
  } catch (error) {
    console.error("Error checking unlock status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

