"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { UI, pickLocale, tr } from "@/lib/fe-intake/ui-strings";

/**
 * Breadcrumb: Final Expense Client Intake › [current].
 * Pass `current` for sub-pages (form/summary). On the dashboard, omit it.
 */
export default function FeIntakeBreadcrumb({ current }: { current?: string }) {
  const locale = pickLocale(useLocale());

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {current ? (
        <Link href="/final-expense/intake" className="hover:text-foreground hover:underline">
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
