"use client";

/**
 * "Apply now" CTA — goes straight into the application.
 *
 * No sign-in wall: the start handler mints a device cookie, creates the session, and redirects
 * into the token-scoped form. Requiring an account here was pure friction for a prospect who just
 * wants coverage, and the unguessable link plus device binding is what secures the session.
 *
 * A plain <a> rather than next/link because the target is a Route Handler that sets a cookie and
 * issues a redirect — it needs a real navigation, not a client-side transition.
 */
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLocale } from "next-intl";

const CTA_CLS =
  "gap-2 bg-gradient-to-r from-brand to-accent px-8 text-base text-white shadow-md shadow-brand/30 transition hover:opacity-95";

export default function AcaApplyCta({ label }: { label: string; startHref?: string }) {
  const locale = useLocale().startsWith("es") ? "es" : "en";

  return (
    <Button asChild size="lg" className={CTA_CLS}>
      <a href={`/api/aca-intake/start?locale=${locale}`}>
        {label} <ArrowRight className="h-5 w-5" />
      </a>
    </Button>
  );
}
