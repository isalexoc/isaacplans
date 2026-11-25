/**
 * Emails an intake's owner when their client finishes on their own (see ./owner-notice.ts for what
 * the email says and doesn't). Only for lines with `notifyOwnerByEmail`; best-effort, never throws.
 * Call it inside `after()`: the client's request shouldn't wait on Clerk or SMTP.
 *
 * Server-only (Clerk, SMTP).
 */

import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { sendStaffNotice } from "@/lib/email/notifications";
import { ownerNoticeContent, type OwnerNoticeEvent } from "./owner-notice";
import { buildIntakeViewUrl } from "./share-url";
import type { IntakeLobConfig } from "./types";

export async function notifyIntakeOwner(
  config: IntakeLobConfig,
  row: { token: string; ownerUserId: string; contactName: string | null; locale: string | null },
  event: OwnerNoticeEvent
): Promise<void> {
  if (!config.notifyOwnerByEmail) return;
  try {
    const clerk = await clerkClient();
    const owner = await clerk.users.getUser(row.ownerUserId);
    const to = owner.primaryEmailAddress?.emailAddress ?? owner.emailAddresses?.[0]?.emailAddress;
    if (!to) {
      console.warn(`[${config.lob}-intake] owner has no email; notice not sent`);
      return;
    }
    const notice = ownerNoticeContent({
      config,
      event,
      clientName: row.contactName,
      viewUrl: buildIntakeViewUrl(config, row.token, row.locale ?? "en"),
    });
    const fromName = config.fixedLocale === "es" ? "Avisos de solicitudes" : "Application notices";
    const sent = await sendStaffNotice({ to, fromName, ...notice });
    if (sent) console.log(`[${config.lob}-intake] owner notice sent (${event.kind})`);
  } catch (error) {
    console.error(`[${config.lob}-intake] owner notice failed:`, error);
  }
}
