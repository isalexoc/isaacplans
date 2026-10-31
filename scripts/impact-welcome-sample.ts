/**
 * Send one fake Impact welcome payload to the GHL Inbound Webhook workflow.
 *
 * GHL lists a trigger's merge tags only after it has received a request. Run this while the
 * workflow is still in Draft, click "Fetch Sample Requests" in the trigger, and every
 * {{inboundWebhookRequest.*}} key appears without touching a real client. A Draft workflow does not
 * run, so nobody gets a message.
 *
 *   pnpm exec tsx scripts/impact-welcome-sample.ts        (Spanish-formatted values)
 *   pnpm exec tsx scripts/impact-welcome-sample.ts en     (English-formatted values)
 *
 * Reads IMPACT_WELCOME_WEBHOOK_URL from .env. One workflow serves both languages: it branches on
 * the contact's `spanish` tag, like the app does.
 */

import "dotenv/config";
import {
  buildImpactWelcomePayload,
  IMPACT_WEBHOOK_ENV,
  type ImpactLanguage,
} from "../lib/impact-enrollment/format";

async function main() {
  const language: ImpactLanguage = process.argv[2] === "en" ? "en" : "es";
  const url = process.env[IMPACT_WEBHOOK_ENV]?.trim();
  if (!url) {
    console.error(`${IMPACT_WEBHOOK_ENV} is not set in .env.`);
    process.exit(1);
  }

  const payload = buildImpactWelcomePayload(
    {
      memberId: "SAMPLE-00000",
      startDate: "2026-11-01",
      monthlyAmountCents: 18950,
      paymentDay: 5,
      sendEmail: false,
      sendMessages: true,
    },
    {
      contactId: "sample-contact-id",
      firstName: "Sample",
      lastName: "Client",
      email: "sample.client@example.com",
      phone: "+15555550100",
      language,
    },
    "Sample Agent",
    // Placeholders: GHL only needs the keys to exist to offer them as merge tags.
    { pdfUrl: "https://example.com/sample-id-card.pdf", imageUrl: "https://example.com/sample-id-card.jpg" }
  );

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log(`${IMPACT_WEBHOOK_ENV} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  console.log(JSON.stringify(payload, null, 2));
  if (!res.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
