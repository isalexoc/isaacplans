"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { UI, pickLocale, tr } from "@/lib/intake-core/ui-strings";
import { LOBS, type LobSlug } from "@/lib/lob/registry";

/**
 * Breadcrumb: "<Line of business> Client Intake › [current]".
 *
 * Only ever rendered for the agent — the client-facing form hides it (`isOwner &&` at the call
 * site), because the dashboard it links to is admin-gated and would 404 them.
 *
 * Pass `current` for sub-pages (form/summary). On the dashboard itself, omit it.
 */
export default function IntakeBreadcrumb({ lob, current }: { lob: string; current?: string }) {
  const locale = pickLocale(useLocale());
  const definition = LOBS[lob as LobSlug];
  const root = `${definition.label} ${tr(UI.navIntake, locale)}`;

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {current ? (
        <Link href={definition.intakeRoute} className="hover:text-foreground hover:underline">
          {root}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{root}</span>
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
