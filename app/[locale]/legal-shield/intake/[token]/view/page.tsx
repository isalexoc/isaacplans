/* app/[locale]/legal-shield/intake/[token]/view/page.tsx — the associate's read-only summary. */

import { redirect } from "next/navigation";
import { getStaffAccess, canOperateLine } from "@/lib/auth/access";
import { legalShieldIntakeMetadata } from "@/lib/legal-shield/intake-metadata";
import IntakeClientView from "@/components/intake/client-view";

export const metadata = legalShieldIntakeMetadata("Resumen del cliente", "Resumen de la solicitud de LegalShield.");

export default async function LegalShieldIntakeViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await getStaffAccess();
  if (!access.userId) redirect("/es/sign-in?redirect_url=/es/legal-shield/intake");
  if (!canOperateLine(access, "legal-shield")) redirect("/es/unauthorized");
  // Whether this caller may open THIS session is the session API's call (owner, or admin oversight).
  return <IntakeClientView lob="legal-shield" token={token} />;
}
