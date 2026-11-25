/*
 * app/[locale]/legal-shield/intake/[token]/page.tsx — a client's LegalShield membership
 * application (and Ysmael's own working copy of it, when he is signed in).
 *
 * Public by design: no sign-in, so the unguessable token *is* the credential (plus the device
 * cookie that claims it on first open). Private page: no trackers, chat or framing.
 */

import { legalShieldIntakeMetadata } from "@/lib/legal-shield/intake-metadata";
import IntakeForm from "@/components/intake/intake-form";

export const metadata = legalShieldIntakeMetadata(
  "Su solicitud de LegalShield",
  "Complete su solicitud de membresía de forma segura desde su teléfono. Su progreso se guarda solo."
);

export default async function LegalShieldIntakeFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <IntakeForm lob="legal-shield" token={token} />
    </main>
  );
}
