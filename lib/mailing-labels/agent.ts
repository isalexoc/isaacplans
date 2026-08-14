import "server-only";
import {
  agentDisplayName,
  formatLeaveBehindEmailForImage,
  formatLeaveBehindPhoneForImage,
} from "@/lib/leave-behind-agent-profile";
import { getLeaveBehindAgentProfile } from "@/lib/leave-behind-agent-profile-server";
import { getMailingLabelSettings } from "./settings";
import type { LabelAgentContact } from "./types";

/**
 * The single source of truth for how the agent appears on a printed label or letter.
 *
 * Starts from the shared leave-behind profile (the record Sale Sticker and Leave-Behind already
 * use), then lets the mailing-label Settings override any field. That override is the point: the
 * profile carries the full legal name, while the printed piece may want a shorter one.
 */

export type ResolvedLabelAgent = LabelAgentContact & { email?: string };

/**
 * Isaac's published WhatsApp number, the same one the site footer links to. It is a *different*
 * line from the phone on the leave-behind profile, and that profile has nowhere to record it —
 * hence the constant. Settings → "WhatsApp to print" overrides it.
 */
const SITE_WHATSAPP = "5406813507";

export async function resolveMailingLabelAgent(
  userId: string
): Promise<ResolvedLabelAgent | null> {
  const [profile, settings] = await Promise.all([
    getLeaveBehindAgentProfile(userId).catch(() => null),
    getMailingLabelSettings(),
  ]);

  const override = settings.agent;
  const profileName = profile ? agentDisplayName(profile.firstName, profile.lastName) : "";
  const name = override.name.trim() || profileName;
  if (!name) return null; // Nothing to sign with — the caller turns this into a clear message.

  const phoneSource = override.phone.trim() || profile?.phone || "";
  const whatsappSource = override.whatsapp.trim() || SITE_WHATSAPP;
  const emailSource = override.email.trim() || profile?.email || "";

  return {
    name,
    phone: phoneSource ? formatLeaveBehindPhoneForImage(phoneSource) : "",
    whatsapp: formatLeaveBehindPhoneForImage(whatsappSource),
    email: emailSource ? formatLeaveBehindEmailForImage(emailSource) : undefined,
  };
}
