"use client";

import { useEffect, useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SaleStickerSignedOut() {
  const t = useTranslations("saleSticker.landing");
  const [currentUrl, setCurrentUrl] = useState("/");

  useEffect(() => {
    if (typeof window !== "undefined") setCurrentUrl(window.location.pathname);
  }, []);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-200/80 bg-white p-8 text-center shadow-lg dark:border-gray-700/80 dark:bg-gray-950">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#003366]/10 text-[#003366] dark:bg-sky-500/15 dark:text-sky-300">
        <PartyPopper className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold text-[#003366] dark:text-sky-300">{t("title")}</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">{t("subtitle")}</p>
      {/* @ts-ignore - SignInButton works with React 19; Clerk types lag */}
      <SignInButton
        mode="modal"
        forceRedirectUrl={currentUrl}
        fallbackRedirectUrl={currentUrl}
        signUpForceRedirectUrl={currentUrl}
        signUpFallbackRedirectUrl={currentUrl}
      >
        <Button className="mt-6 bg-[#003366] text-white hover:bg-[#004080] hover:text-white">
          {t("signIn")}
        </Button>
      </SignInButton>
    </div>
  );
}
