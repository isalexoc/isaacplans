import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leaveBehindAgentProfiles } from "@/lib/db/schema";
import type {
  LeaveBehindAgentProfile,
  LeaveBehindAgentProfileInput,
} from "@/lib/leave-behind-agent-profile";
import { leaveBehindDeliveryUrl } from "@/lib/leave-behind-cloudinary";

function hydrateImageUrls(
  row: typeof leaveBehindAgentProfiles.$inferSelect
): Pick<
  LeaveBehindAgentProfile,
  | "profileImageUrl"
  | "profileImagePublicId"
  | "companyLogoUrl"
  | "companyLogoPublicId"
  | "logoRemoveBackground"
> {
  const logoRemoveBackground = row.logoRemoveBackground ?? true;
  const profileImageUrl = row.profileImagePublicId
    ? leaveBehindDeliveryUrl(row.profileImagePublicId, "profile_photo")
    : row.profileImageUrl;
  const companyLogoUrl = row.companyLogoPublicId
    ? leaveBehindDeliveryUrl(row.companyLogoPublicId, "company_logo", {
        removeLogoBackground: logoRemoveBackground,
      })
    : row.companyLogoUrl;

  return {
    profileImageUrl,
    profileImagePublicId: row.profileImagePublicId ?? "",
    companyLogoUrl,
    companyLogoPublicId: row.companyLogoPublicId ?? "",
    logoRemoveBackground,
  };
}

function rowToProfile(row: typeof leaveBehindAgentProfiles.$inferSelect): LeaveBehindAgentProfile {
  return {
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    professionalTitle: row.professionalTitle,
    phone: row.phone,
    email: row.email,
    ...hydrateImageUrls(row),
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getLeaveBehindAgentProfile(
  userId: string
): Promise<LeaveBehindAgentProfile | null> {
  const [row] = await db
    .select()
    .from(leaveBehindAgentProfiles)
    .where(eq(leaveBehindAgentProfiles.userId, userId))
    .limit(1);
  return row ? rowToProfile(row) : null;
}

export async function upsertLeaveBehindAgentProfile(
  userId: string,
  input: LeaveBehindAgentProfileInput
): Promise<LeaveBehindAgentProfile> {
  const now = new Date();
  const existing = await getLeaveBehindAgentProfile(userId);

  const logoRemoveBackground =
    input.logoRemoveBackground ?? existing?.logoRemoveBackground ?? true;

  const profileImagePublicId =
    input.profileImagePublicId ?? existing?.profileImagePublicId ?? "";
  const companyLogoPublicId =
    input.companyLogoPublicId ?? existing?.companyLogoPublicId ?? "";

  const profileImageUrl = profileImagePublicId
    ? leaveBehindDeliveryUrl(profileImagePublicId, "profile_photo")
    : (input.profileImageUrl ?? existing?.profileImageUrl ?? "").trim();

  const companyLogoUrl = companyLogoPublicId
    ? leaveBehindDeliveryUrl(companyLogoPublicId, "company_logo", {
        removeLogoBackground: logoRemoveBackground,
      })
    : (input.companyLogoUrl ?? existing?.companyLogoUrl ?? "").trim();

  const onboardingCompletedAt = input.markOnboardingComplete
    ? now
    : existing?.onboardingCompletedAt
      ? new Date(existing.onboardingCompletedAt)
      : null;

  const values = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    professionalTitle: (input.professionalTitle ?? existing?.professionalTitle ?? "").trim(),
    phone: (input.phone ?? existing?.phone ?? "").trim(),
    email: (input.email ?? existing?.email ?? "").trim(),
    profileImageUrl,
    profileImagePublicId,
    companyLogoUrl,
    companyLogoPublicId,
    logoRemoveBackground,
    onboardingCompletedAt,
    updatedAt: now,
  };

  if (!existing) {
    await db.insert(leaveBehindAgentProfiles).values({
      userId,
      ...values,
      createdAt: now,
    });
  } else {
    await db
      .update(leaveBehindAgentProfiles)
      .set(values)
      .where(eq(leaveBehindAgentProfiles.userId, userId));
  }

  const profile = await getLeaveBehindAgentProfile(userId);
  if (!profile) throw new Error("Failed to save agent profile");
  return profile;
}
