"use client";

/**
 * "Apply now" CTA. Signed-in users go straight to the start handoff; signed-out users get
 * Clerk's sign-in/sign-up modal (this app has no /sign-in route), then are redirected to the
 * localized start path. Uses the `useUser` hook (the modal/hook pattern used in blog comments).
 */
import { SignInButton, useUser } from "@clerk/nextjs";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const CTA_CLS =
  "gap-2 bg-gradient-to-r from-brand to-accent px-8 text-base text-white shadow-md shadow-brand/30 transition hover:opacity-95";

export default function IulApplyCta({ label, startHref }: { label: string; startHref: string }) {
  const { isLoaded, isSignedIn } = useUser();

  if (isLoaded && isSignedIn) {
    return (
      <Button asChild size="lg" className={CTA_CLS}>
        <Link href="/iul/apply/start">
          {label} <ArrowRight className="h-5 w-5" />
        </Link>
      </Button>
    );
  }

  // Signed out (or still loading): open Clerk's modal, then return to the start handoff.
  return (
    <SignInButton mode="modal" forceRedirectUrl={startHref} signUpForceRedirectUrl={startHref}>
      <Button size="lg" className={CTA_CLS}>
        {label} <ArrowRight className="h-5 w-5" />
      </Button>
    </SignInButton>
  );
}
