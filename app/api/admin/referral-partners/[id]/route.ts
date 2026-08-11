import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  deletePartner,
  getPartnerBySlug,
  getPartnerDashboard,
  updatePartner,
  type PartnerInput,
} from "@/lib/referral-partners/server";
import { slugifyPartnerName } from "@/lib/referral-partners/types";

/** Single referral partner: full dashboard read, edit, delete. Admin only. */

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  return null;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const data = await getPartnerDashboard(id);
    if (!data) {
      return NextResponse.json({ success: false, error: "Partner not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("[admin/referral-partners/:id]", error);
    return NextResponse.json({ success: false, error: "Failed to load partner" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const updates: Partial<PartnerInput> = {};

    if (body.companyName !== undefined) {
      const companyName = String(body.companyName).trim();
      if (!companyName) {
        return NextResponse.json(
          { success: false, error: "Company name cannot be empty" },
          { status: 400 }
        );
      }
      updates.companyName = companyName;
    }

    if (body.slug !== undefined) {
      const slug = slugifyPartnerName(String(body.slug).trim());
      if (!slug) {
        return NextResponse.json({ success: false, error: "Invalid slug" }, { status: 400 });
      }
      // Changing a slug breaks any link the partner already handed out, so only reject a genuine
      // collision with a DIFFERENT partner — re-saving the same slug is a no-op, not an error.
      const existing = await getPartnerBySlug(slug);
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { success: false, error: `The slug "${slug}" is already taken` },
          { status: 409 }
        );
      }
      updates.slug = slug;
    }

    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return NextResponse.json({ success: false, error: "Invalid email" }, { status: 400 });
      }
      updates.email = email;
    }

    if (body.commissionBps !== undefined) {
      const bps = Number(body.commissionBps);
      if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) {
        return NextResponse.json(
          { success: false, error: "Commission must be between 0% and 100%" },
          { status: 400 }
        );
      }
      updates.commissionBps = Math.round(bps);
    }

    for (const field of [
      "contactName",
      "contactTitle",
      "phone",
      "website",
      "logoUrl",
      "heroImageUrl",
      "sectionImageUrl",
      "accentColor",
      "headlineEn",
      "headlineEs",
      "introEn",
      "introEs",
      "audienceEn",
      "audienceEs",
      "notes",
    ] as const) {
      if (body[field] !== undefined) updates[field] = String(body[field]).trim();
    }

    if (body.defaultLocale !== undefined) {
      updates.defaultLocale = body.defaultLocale === "en" ? "en" : "es";
    }
    if (body.audienceKind !== undefined) {
      updates.audienceKind = body.audienceKind === "immigration" ? "immigration" : "general";
    }
    if (body.status !== undefined) {
      updates.status = body.status === "paused" ? "paused" : "active";
    }

    const partner = await updatePartner(id, updates);
    if (!partner) {
      return NextResponse.json({ success: false, error: "Partner not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, partner });
  } catch (error) {
    console.error("[admin/referral-partners/:id] update", error);
    return NextResponse.json({ success: false, error: "Failed to update partner" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    // Cascades to that partner's leads and clients — see the FKs in lib/db/schema.ts.
    await deletePartner(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/referral-partners/:id] delete", error);
    return NextResponse.json({ success: false, error: "Failed to delete partner" }, { status: 500 });
  }
}
