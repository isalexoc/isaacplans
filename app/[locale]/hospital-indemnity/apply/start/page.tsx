/*
 * app/[locale]/hospital-indemnity/apply/start/page.tsx
 *
 * Mirrors the ACA/IUL/Final Expense shims: the real handoff is the Route Handler at
 * /api/intake/hospital-indemnity/start, which can set the device cookie that claims the new
 * session — something a Server Component cannot do.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Start your hospital indemnity application",
  robots: { index: false, follow: false },
};

export default async function HospitalIndemnityApplyStartPage() {
  const locale = (await getLocale()) === "es" ? "es" : "en";
  redirect(`/api/intake/hospital-indemnity/start?locale=${locale}`);
}
