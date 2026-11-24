import { headers } from "next/headers";
import { Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getStaffAccess } from "@/lib/auth/access";

/**
 * Floating admin shortcut.
 *
 * Renders a fixed gear button in the lower-left corner that links to the admin
 * dashboard. Server-gated: nothing is emitted to the DOM unless the current
 * Clerk user is an admin (`publicMetadata.role === "admin"`), so anonymous
 * visitors and regular signed-in users never see it.
 */
export default async function AdminFab() {
  // Private pages can be on a client's screen — the Impact presentation is shared through
  // CrankWheel — so they never show admin chrome.
  if ((await headers()).get("x-private-page") === "1") return null;
  // Isaac's admin role, or a scoped staff role whose /admin shows only its own section.
  const { role } = await getStaffAccess();
  if (!role) return null;

  return (
    <Link
      href={role === "legal_shield" ? { pathname: "/admin" } : "/admin"}
      locale={role === "legal_shield" ? "es" : undefined}
      aria-label="Admin dashboard"
      title="Admin dashboard"
      className="fixed bottom-4 left-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Settings className="h-5 w-5" />
      <span className="sr-only">Admin dashboard</span>
    </Link>
  );
}
