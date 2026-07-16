import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getLeaveBehindAgentProfile,
  upsertLeaveBehindAgentProfile,
} from "@/lib/leave-behind-agent-profile-server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getLeaveBehindAgentProfile(userId);
  return NextResponse.json({ success: true, profile });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const firstName = typeof body?.firstName === "string" ? body.firstName : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName : "";

  if (!firstName.trim() || !lastName.trim()) {
    return NextResponse.json(
      { success: false, error: "First and last name are required" },
      { status: 400 }
    );
  }

  const profileImageUrl =
    typeof body?.profileImageUrl === "string" ? body.profileImageUrl.trim() : undefined;
  const profileImagePublicId =
    typeof body?.profileImagePublicId === "string" ? body.profileImagePublicId.trim() : undefined;
  const companyLogoUrl =
    typeof body?.companyLogoUrl === "string" ? body.companyLogoUrl.trim() : undefined;
  const companyLogoPublicId =
    typeof body?.companyLogoPublicId === "string" ? body.companyLogoPublicId.trim() : undefined;

  const existing = await getLeaveBehindAgentProfile(userId);
  const hasPhoto =
    profileImageUrl ||
    profileImagePublicId ||
    existing?.profileImageUrl ||
    existing?.profileImagePublicId;
  const hasLogo =
    companyLogoUrl ||
    companyLogoPublicId ||
    existing?.companyLogoUrl ||
    existing?.companyLogoPublicId;

  if (!hasPhoto) {
    return NextResponse.json(
      { success: false, error: "Profile photo is required" },
      { status: 400 }
    );
  }
  if (!hasLogo) {
    return NextResponse.json(
      { success: false, error: "Company logo is required" },
      { status: 400 }
    );
  }

  try {
    const profile = await upsertLeaveBehindAgentProfile(userId, {
      firstName,
      lastName,
      professionalTitle:
        typeof body?.professionalTitle === "string" ? body.professionalTitle : undefined,
      phone: typeof body?.phone === "string" ? body.phone : undefined,
      email: typeof body?.email === "string" ? body.email : undefined,
      profileImageUrl,
      profileImagePublicId,
      companyLogoUrl,
      companyLogoPublicId,
      markOnboardingComplete: Boolean(body?.markOnboardingComplete),
    });
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("[leave-behind/agent-profile] PATCH", error);
    return NextResponse.json(
      { success: false, error: "Failed to save profile" },
      { status: 500 }
    );
  }
}
