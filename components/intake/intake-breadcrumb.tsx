"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
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
 *
 * `dashboardHref` is built by the page on the server (i18n/navigation `getPathname`): the client
 * form ships this file to every client, on both domains, and importing next-intl's navigation
 * here would put Isaac's whole route table in that bundle. Without it the root is plain text.
 * `hardNav` (the agent area): a plain link, since that area changes pages with full loads.
 */
export default function IntakeBreadcrumb({
  lob,
  current,
  dashboardHref,
  rootLabel,
  hardNav = false,
}: {
  lob: string;
  current?: string;
  dashboardHref?: string;
  /** In place of "<line> Client Intake" (the agent area says "Applications"). */
  rootLabel?: string;
  hardNav?: boolean;
}) {
  const locale = pickLocale(useLocale());
  const definition = LOBS[lob as LobSlug];
  const root = rootLabel ?? `${definition.label} ${tr(UI.navIntake, locale)}`;
  const linkClass = "hover:text-foreground hover:underline";

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {current && dashboardHref ? (
        hardNav ? (
          <a href={dashboardHref} className={linkClass}>
            {root}
          </a>
        ) : (
          <Link href={dashboardHref} className={linkClass}>
            {root}
          </Link>
        )
      ) : (
        <span className={current ? undefined : "font-medium text-foreground"}>{root}</span>
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
