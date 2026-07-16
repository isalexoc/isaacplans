/** Agent branding for leave-behind image footers (per Clerk user). */

export type LeaveBehindAgentProfile = {
  userId: string;
  firstName: string;
  lastName: string;
  professionalTitle: string;
  phone: string;
  email: string;
  profileImageUrl: string;
  profileImagePublicId: string;
  companyLogoUrl: string;
  companyLogoPublicId: string;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeaveBehindAgentProfileInput = {
  firstName: string;
  lastName: string;
  professionalTitle?: string;
  phone?: string;
  email?: string;
  profileImageUrl?: string;
  profileImagePublicId?: string;
  companyLogoUrl?: string;
  companyLogoPublicId?: string;
  markOnboardingComplete?: boolean;
};

export function agentDisplayName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

/** Format for leave-behind image footers: (123) 456-7890 when 10 US digits are available. */
export function formatLeaveBehindPhoneForImage(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return phone.trim();
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

export function formatLeaveBehindEmailForImage(email: string): string {
  return email.trim().toLowerCase();
}

export function isLeaveBehindAgentProfileComplete(
  profile: Pick<
    LeaveBehindAgentProfile,
    "firstName" | "lastName" | "profileImageUrl" | "companyLogoUrl"
  > | null
): boolean {
  if (!profile) return false;
  return Boolean(
    profile.firstName.trim() &&
      profile.lastName.trim() &&
      profile.profileImageUrl.trim() &&
      profile.companyLogoUrl.trim()
  );
}
