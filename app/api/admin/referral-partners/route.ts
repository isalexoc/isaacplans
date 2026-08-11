import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  createPartner,
  getPartnerBySlug,
  listPartnersWithSummaries,
} from "@/lib/referral-partners/server";
import { DEFAULT_COMMISSION_BPS, slugifyPartnerName } from "@/lib/referral-partners/types";

/** Referral partner list + create. Admin only (middleware gates /api/admin, re-checked here). */

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

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const partners = await listPartnersWithSummaries();
    return NextResponse.json({ success: true, partners });
  } catch (error) {
    console.error("[admin/referral-partners]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load referral partners" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();

    const companyName = String(body.companyName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!companyName) {
      return NextResponse.json(
        { success: false, error: "Company name is required" },
        { status: 400 }
      );
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid partner email is required — it's how they sign in" },
        { status: 400 }
      );
    }

    const slug = slugifyPartnerName(String(body.slug ?? "").trim() || companyName);
    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Could not build a URL slug from that name" },
        { status: 400 }
      );
    }
    if (await getPartnerBySlug(slug)) {
      return NextResponse.json(
        { success: false, error: `The slug "${slug}" is already taken` },
        { status: 409 }
      );
    }

    const commissionBps = Number.isFinite(Number(body.commissionBps))
      ? Math.max(0, Math.min(10_000, Math.round(Number(body.commissionBps))))
      : DEFAULT_COMMISSION_BPS;

    const partner = await createPartner({
      slug,
      companyName,
      contactName: String(body.contactName ?? "").trim(),
      contactTitle: String(body.contactTitle ?? "").trim(),
      email,
      phone: String(body.phone ?? "").trim(),
      website: String(body.website ?? "").trim(),
      logoUrl: String(body.logoUrl ?? "").trim(),
      heroImageUrl: String(body.heroImageUrl ?? "").trim(),
      sectionImageUrl: String(body.sectionImageUrl ?? "").trim(),
      accentColor: String(body.accentColor ?? "").trim() || "#0077B6",
      commissionBps,
      defaultLocale: body.defaultLocale === "en" ? "en" : "es",
      headlineEn: String(body.headlineEn ?? "").trim(),
      headlineEs: String(body.headlineEs ?? "").trim(),
      introEn: String(body.introEn ?? "").trim(),
      introEs: String(body.introEs ?? "").trim(),
      audienceEn: String(body.audienceEn ?? "").trim(),
      audienceEs: String(body.audienceEs ?? "").trim(),
      audienceKind: body.audienceKind === "immigration" ? "immigration" : "general",
      status: body.status === "paused" ? "paused" : "active",
      notes: String(body.notes ?? "").trim(),
    });

    return NextResponse.json({ success: true, partner });
  } catch (error) {
    console.error("[admin/referral-partners] create", error);
    return NextResponse.json(
      { success: false, error: "Failed to create referral partner" },
      { status: 500 }
    );
  }
}
