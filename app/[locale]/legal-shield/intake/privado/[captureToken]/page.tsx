/*
 * app/[locale]/legal-shield/intake/privado/[captureToken]/page.tsx — where a Legal Shield client
 * types the numbers they'd rather not say on a call (SSN last 4, card, bank), from a link Ysmael
 * sent by WhatsApp.
 *
 * Its own page (not /seguro) so it carries the associate's brand, never Isaac Plans', and it only
 * opens Legal Shield links. It sits under the intake path, so the private-pages rule covers it, and
 * its URL avoids "seguro", which also means insurance.
 */

import { legalShieldIntakeMetadata } from "@/lib/legal-shield/intake-metadata";
import IntakeSecureCaptureForm from "@/components/intake/secure-capture-form";

/** Deliberately vague: the preview sits in a WhatsApp chat anyone glancing at the phone can read. */
export const metadata = legalShieldIntakeMetadata(
  "Enlace privado",
  "Un enlace privado y cifrado para enviar su información de forma segura."
);

export default async function LegalShieldPrivateLinkPage({ params }: { params: Promise<{ captureToken: string }> }) {
  const { captureToken } = await params;
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <IntakeSecureCaptureForm captureToken={captureToken} onlyLob="legal-shield" />
    </main>
  );
}
