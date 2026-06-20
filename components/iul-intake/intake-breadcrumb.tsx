"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { UI, pickLocale, tr } from "@/lib/iul-intake/ui-strings";

/**
 * Breadcrumb: Presentation › Client Intake › [current].
 * Pass `current` for sub-pages (form/summary). On the dashboard, omit it.
 */
export default function IntakeBreadcrumb({ current }: { current?: string }) {
  const locale = pickLocale(useLocale());

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link href="/iul/presentation" className="hover:text-foreground hover:underline">
        {tr(UI.navPresentation, locale)}
      </Link>
      <ChevronRight className="h-4 w-4 opacity-60" />
      {current ? (
        <Link href="/iul/intake" className="hover:text-foreground hover:underline">
          {tr(UI.navIntake, locale)}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{tr(UI.navIntake, locale)}</span>
      )}
      {current && (
        <>
          <ChevronRight className="h-4 w-4 opacity-60" />
          <span className="font-medium text-foreground">{current}</span>
        </>
      )}
    </nav>
  );
}
