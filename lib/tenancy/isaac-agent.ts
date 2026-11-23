/**
 * Isaac, the agent on his own deck, guide and quote image: the card those screens always showed,
 * and the pure builder of his `AgentPublicProfile` (lib/tenancy/profile.ts). The IBO number is not
 * here: it comes from env (`IMPACT_AGENT_IBO`; the repo is public).
 *
 * Server code and the offline tests only (lib/tenancy/isaac-profile.ts assembles the live profile):
 * never import this from a client component. It used to live in components/impact-presentation/
 * copy.ts, whose browser code ships to every client page, the product domain's included.
 */

import {
  LANGUAGE_NAMES,
  normalizeLanguages,
  type AgentLanguage,
  type AgentPronoun,
  type AgentPublicProfile,
} from "./profile";

export const ISAAC_AGENT = {
  name: "Isaac Orraiz",
  whatsapp: "(540) 681-3507",
  /** The same number for wa.me links. */
  whatsappDigits: "15406813507",
  site: "isaacplans.com",
  photo: "/images/impact/presentation/agent-isaac.jpg",
  languages: "Español · English",
  /** For the one English sentence that needs one ("…and he'll send your quote"). */
  pronoun: "he" as AgentPronoun,
} as const;

/** Isaac's profile from `ISAAC_AGENT`: the same name, photo, number, languages and site line. */
export function buildIsaacProfile(input: {
  licensedStateCount: number;
  iboNumber?: string | null;
  /** His site's origin, for the photo's absolute URL. */
  siteUrl: string;
}): AgentPublicProfile {
  const [firstName = "", ...rest] = ISAAC_AGENT.name.split(" ");
  const byName = new Map(Object.entries(LANGUAGE_NAMES).map(([code, name]) => [name, code as AgentLanguage]));
  const languages = normalizeLanguages(ISAAC_AGENT.languages.split("·").map((name) => byName.get(name.trim()) ?? ""));
  const count = Number.isFinite(input.licensedStateCount) ? Math.max(0, Math.floor(input.licensedStateCount)) : 0;
  return {
    slug: null,
    firstName,
    lastName: rest.join(" "),
    displayName: ISAAC_AGENT.name,
    photoUrl: `${input.siteUrl.replace(/\/+$/, "")}${ISAAC_AGENT.photo}`,
    photoPath: ISAAC_AGENT.photo,
    whatsappE164: `+${ISAAC_AGENT.whatsappDigits}`,
    whatsappDigits: ISAAC_AGENT.whatsappDigits,
    languages,
    licensed: true,
    licensedStateCount: count,
    iboNumber: input.iboNumber?.trim() || null,
    impactReferralUrl: null,
    siteLabel: ISAAC_AGENT.site,
    pronoun: ISAAC_AGENT.pronoun,
  };
}
