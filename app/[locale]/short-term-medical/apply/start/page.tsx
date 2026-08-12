/*
 * app/[locale]/short-term-medical/apply/start/page.tsx
 *
 * Mirrors the ACA/IUL/Final Expense shims: the real handoff is the Route Handler at
 * /api/intake/short-term-medical/start, which can set the device cookie that claims the new
 * session — something a Server Component cannot do.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Start your short term medical application",
  robots: { index: false, follow: false },
};

export default async function ShortTermMedicalApplyStartPage() {
  const locale = (await getLocale()) === "es" ? "es" : "en";
  redirect(`/api/intake/short-term-medical/start?locale=${locale}`);
}
