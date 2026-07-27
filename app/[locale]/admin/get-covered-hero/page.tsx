import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import { getFeGetCoveredHeroSettingsForAdmin } from "@/lib/get-covered-fast/hero-setting";
import GetCoveredHeroClient from "@/components/admin/get-covered-hero-client";

export const metadata: Metadata = {
  title: "Get Covered Hero Image | Isaac Plans",
  description:
    "Swap the final-expense get-covered hero image to A/B test which one converts best.",
  robots: { index: false, follow: false },
};

export default async function GetCoveredHeroPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  const settings = await getFeGetCoveredHeroSettingsForAdmin();

  return <GetCoveredHeroClient settings={settings} />;
}
