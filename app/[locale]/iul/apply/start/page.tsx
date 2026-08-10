/*
 * app/[locale]/iul/apply/start/page.tsx
 *
 * Kept only so links minted before passwordless intake still work. The real handoff is the Route
 * Handler at /api/iul-intake/start, which can set the device cookie that claims the new session —
 * something a Server Component cannot do.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Start your IUL application",
  robots: { index: false, follow: false },
};

export default async function IulApplyStartPage() {
  const locale = (await getLocale()) === "es" ? "es" : "en";
  redirect(`/api/iul-intake/start?locale=${locale}`);
}
