import "server-only";
import {
  agentDisplayName,
  formatLeaveBehindEmailForImage,
  formatLeaveBehindPhoneForImage,
} from "@/lib/leave-behind-agent-profile";
import { getLeaveBehindAgentProfile } from "@/lib/leave-behind-agent-profile-server";
import type { LetterAgentInfo } from "./letter";

/**
 * The agent identity that signs the letter, read from the shared leave-behind profile that the
 * Sale Sticker and Leave-Behind tools already populate. Returns null when there is no usable
 * name, since an unsigned letter is worse than no letter.
 */
export async function resolveLetterAgent(userId: string): Promise<LetterAgentInfo | null> {
  const profile = await getLeaveBehindAgentProfile(userId);
  if (!profile) return null;

  const name = agentDisplayName(profile.firstName, profile.lastName);
  if (!name) return null;

  return {
    name,
    phone: formatLeaveBehindPhoneForImage(profile.phone),
    email: profile.email ? formatLeaveBehindEmailForImage(profile.email) : undefined,
  };
}
