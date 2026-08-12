/*
 * app/[locale]/health-alternative/apply/start/page.tsx
 *
 * Mirrors the ACA/IUL/Final Expense shims: the real handoff is the Route Handler at
 * /api/intake/health-alternative/start, which can set the device cookie that claims the new
 * session — something a Server Component cannot do.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Start your health coverage application",
  robots: { index: false, follow: false },
};

export default async function HealthAlternativeApplyStartPage() {
  const locale = (await getLocale()) === "es" ? "es" : "en";
  redirect(`/api/intake/health-alternative/start?locale=${locale}`);
}
