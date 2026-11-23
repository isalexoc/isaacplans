/**
 * An agent's photo inside a positioned, sized box (it fills its parent). Isaac's ships with the app
 * and goes through next/image's optimizer exactly as his deck and guide always rendered it; an
 * agent's is an outside https URL (lib/tenancy/profile.ts keeps only those), drawn as is; without
 * one, initials.
 */

import Image from "next/image";
import { cn } from "@/lib/utils";
import { profileInitials, type AgentPublicProfile } from "@/lib/tenancy/profile";

export default function AgentPhoto({
  agent,
  sizes,
  initialsClassName,
}: {
  agent: AgentPublicProfile;
  sizes: string;
  /** The initials' type size, to match the box. */
  initialsClassName?: string;
}) {
  if (agent.photoPath) {
    return <Image src={agent.photoPath} alt={agent.displayName} fill sizes={sizes} className="object-cover" />;
  }
  if (agent.photoUrl) {
    return (
      <Image
        src={agent.photoUrl}
        alt={agent.displayName}
        fill
        sizes={sizes}
        unoptimized
        referrerPolicy="no-referrer"
        className="object-cover"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={agent.displayName}
      className={cn(
        "flex h-full w-full items-center justify-center bg-[#0b2a4a] font-extrabold text-white",
        initialsClassName
      )}
    >
      {profileInitials(agent)}
    </span>
  );
}
