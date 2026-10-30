import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { listImpactEnrollmentStatuses } from "@/lib/impact-enrollment/server";

const CONTACT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IDS = 100;

// GET /api/admin/impact-enrollment?contactIds=a,b,c — admin only: which of these contacts already got
// the Impact welcome, for the dashboard's "Sent" badges.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (!(await getIsAdmin())) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const contactIds = (request.nextUrl.searchParams.get("contactIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => CONTACT_ID.test(id))
      .slice(0, MAX_IDS);

    const statuses = await listImpactEnrollmentStatuses(contactIds);
    return NextResponse.json({ success: true, statuses });
  } catch (error) {
    console.error("[impact-enrollment] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load statuses" }, { status: 500 });
  }
}
