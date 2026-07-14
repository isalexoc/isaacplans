import { Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getIsAdmin } from "@/lib/auth/admin";

/**
 * Floating admin shortcut.
 *
 * Renders a fixed gear button in the lower-left corner that links to the admin
 * dashboard. Server-gated: nothing is emitted to the DOM unless the current
 * Clerk user is an admin (`publicMetadata.role === "admin"`), so anonymous
 * visitors and regular signed-in users never see it.
 */
export default async function AdminFab() {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      aria-label="Admin dashboard"
      title="Admin dashboard"
      className="fixed bottom-4 left-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Settings className="h-5 w-5" />
      <span className="sr-only">Admin dashboard</span>
    </Link>
  );
}
