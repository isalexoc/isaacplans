/*
 * app/[locale]/legal-shield/intake/page.tsx — Ysmael's Legal Shield dashboard (his clients'
 * applications). Spanish only: /en/legal-shield/* 308s here.
 *
 * Open to the legal_shield role (Isaac's dad) and to admins (Isaac sees every owner's clients:
 * the line has adminOversight). Middleware already requires a sign-in.
 */

import { redirect } from "next/navigation";
import { getStaffAccess, canOperateLine } from "@/lib/auth/access";
import { legalShieldIntakeMetadata } from "@/lib/legal-shield/intake-metadata";
import IntakeDashboard from "@/components/intake/intake-dashboard";

export const metadata = legalShieldIntakeMetadata("Legal Shield · Clientes", "Solicitudes de membresía de LegalShield.");

export default async function LegalShieldIntakeDashboardPage() {
  const access = await getStaffAccess();
  if (!access.userId) redirect("/es/sign-in?redirect_url=/es/legal-shield/intake");
  if (!canOperateLine(access, "legal-shield")) redirect("/es/unauthorized");
  return <IntakeDashboard lob="legal-shield" />;
}
