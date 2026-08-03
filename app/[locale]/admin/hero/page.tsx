import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import { getAdsImageSettingsForAdmin } from "@/lib/ads-images/settings";
import AdsImagesClient from "@/components/admin/ads-images-client";

export const metadata: Metadata = {
  title: "Ads Page Images | Isaac Plans",
  description:
    "Swap the hero and OG images on the Final Expense, IUL, and ACA get-covered ads pages to A/B test what converts.",
  robots: { index: false, follow: false },
};

export default async function AdsImagesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  const settings = await getAdsImageSettingsForAdmin();

  return <AdsImagesClient settings={settings} />;
}
