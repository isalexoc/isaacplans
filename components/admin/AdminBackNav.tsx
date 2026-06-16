"use client";

import { usePathname } from "next/navigation";
import { ChevronLeft, LayoutDashboard } from "lucide-react";

export default function AdminBackNav() {
  const pathname = usePathname();
  const isAdminRoot = /^\/(en|es)\/admin$/.test(pathname);
  if (isAdminRoot) return null;

  const segments = pathname.replace(/^\/(en|es)\/admin\/?/, "").split("/").filter(Boolean);

  const crumbs: { label: string; href: string }[] = [
    { label: "Admin", href: "/en/admin" },
  ];

  const LABELS: Record<string, string> = {
    "blog-generator": "Blog Generator",
    "lead-magnet-generator": "Lead Magnet Generator",
    "social-media-studio": "Social Media Studio",
    "social-publishing": "Social Publishing",
    history: "History",
    calendar: "Calendar",
    connections: "Connections",
  };

  let path = "/en/admin";
  for (const seg of segments) {
    path += `/${seg}`;
    crumbs.push({ label: LABELS[seg] ?? seg, href: path });
  }

  return (
    <div className="border-b border-border bg-muted/40">
      <div className="max-w-5xl mx-auto px-6 py-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <LayoutDashboard className="h-3.5 w-3.5 flex-shrink-0" />
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronLeft className="h-3 w-3 rotate-180 flex-shrink-0" />}
              {isLast ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <a href={crumb.href} className="hover:text-foreground hover:underline transition-colors">
                  {crumb.label}
                </a>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
