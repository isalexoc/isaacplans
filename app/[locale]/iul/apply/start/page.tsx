/* app/[locale]/iul/apply/start/page.tsx — auth gate that resumes/creates the prospect's intake. */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selfStartIntakeForClient } from "@/lib/iul-intake/server";

export const metadata: Metadata = {
  title: "Start your IUL application",
  robots: { index: false, follow: false },
};

export default async function IulApplyStartPage() {
  const locale = await getLocale();
  const { userId } = await auth();

  // Auth happens via the Clerk modal on the landing page (this app has no /sign-in route).
  // If someone lands here logged out (e.g. direct navigation), send them back to apply.
  if (!userId) {
    redirect(locale === "es" ? "/es/iul/aplicar" : "/en/iul/apply");
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  const phone =
    user?.primaryPhoneNumber?.phoneNumber ?? user?.phoneNumbers?.[0]?.phoneNumber ?? null;

  let token: string | null = null;
  try {
    const row = await selfStartIntakeForClient({
      clientUserId: userId,
      email,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      phone,
      locale,
    });
    token = row.token;
  } catch (e) {
    console.error("[iul-apply/start] failed to start application:", e);
  }

  if (token) {
    // Localized intake form URL (es slug differs).
    const formPath =
      locale === "es" ? `/es/iul/admision/${token}` : `/en/iul/intake/${token}`;
    redirect(formPath);
  }

  // Fallback — only reached if starting the application failed.
  const t = await getTranslations("iulApply");
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <AlertCircle className="h-8 w-8 text-red-600" />
      <p className="max-w-md text-muted-foreground">{t("secureNote")}</p>
      <Button asChild>
        <Link href="/iul/apply">{t("cta")}</Link>
      </Button>
    </main>
  );
}
