import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import TelegramLeadsClient from "@/components/admin/telegram-leads-client";

export const metadata: Metadata = {
  title: "Telegram Leads | Isaac Plans",
  description: "Review IUL leads that arrived over Telegram.",
  robots: { index: false, follow: false },
};

export default async function TelegramLeadsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  return <TelegramLeadsClient />;
}
