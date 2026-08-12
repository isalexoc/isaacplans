import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import { getPageMediaForAdmin } from "@/lib/page-media/settings";
import PageMediaClient from "@/components/admin/page-media-client";

/**
 * The route stays `/admin/hero` even though the tool is now "Page Media" — it started as the
 * ads-page hero swapper and Isaac has it bookmarked.
 */
export const metadata: Metadata = {
  title: "Page Media | Isaac Plans",
  description:
    "Swap the hero and social-share image on any line-of-business page, or use a video instead.",
  robots: { index: false, follow: false },
};

export default async function PageMediaPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  const settings = await getPageMediaForAdmin();

  return <PageMediaClient settings={settings} />;
}
