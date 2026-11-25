/*
 * app/[locale]/legal-shield/intake/[token]/presentation/page.tsx — Ysmael's LegalShield sales deck
 * for one client (opened from his form, shared through CrankWheel or a video call).
 *
 * Signed in, a Legal Shield operator, and the session's owner (or Isaac, who oversees the line).
 * Middleware marks it private (no chat, trackers or admin gear on the client's screen) and gives
 * it the associate's slim header. Spanish only.
 */

import { notFound, redirect } from "next/navigation";
import { canOperateLine, canOperateSession, getStaffAccess } from "@/lib/auth/access";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { getIntakeByToken } from "@/lib/intake-core/server";
import { asBilling, asPackage } from "@/lib/legal-shield/plans";
import { legalShieldIntakeMetadata } from "@/lib/legal-shield/intake-metadata";
import LegalShieldPresentation from "@/components/legal-shield-presentation/legal-shield-presentation";
import { buildLegalShieldSlides } from "@/components/legal-shield-presentation/slides";

export const metadata = legalShieldIntakeMetadata("Plan Preferencial + IDShield", "Tu guía del plan.");

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export default async function LegalShieldPresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await getStaffAccess();
  if (!access.userId) redirect("/es/sign-in?redirect_url=/es/legal-shield/intake");
  if (!canOperateLine(access, "legal-shield")) redirect("/es/unauthorized");

  const config = requireIntakeConfig("legal-shield");
  const row = await getIntakeByToken(config, token);
  // One answer for "no such intake" and "not yours".
  if (!row || !canOperateSession(access, config, row)) notFound();

  const data = (row.data ?? {}) as Record<string, unknown>;
  const firstName = str(data.firstName) || (row.contactName ?? "").trim().split(/\s+/)[0] || "";
  const slides = buildLegalShieldSlides({ firstName });

  return (
    <LegalShieldPresentation
      token={token}
      slides={slides}
      initialPackage={asPackage(data.lsPackage)}
      initialBilling={asBilling(data.lsBilling)}
    />
  );
}
