import Image from "next/image";

import {
  LEGAL_SHIELD_LOGO_URL_DARK,
  LEGAL_SHIELD_LOGO_URL_LIGHT,
  LS_ADVISOR_NAME,
} from "@/lib/legal-shield/constants";

/** One string so the header and footer disclosures can never drift out of sync. */
const ASSOCIATE_LINE = `Asociado Independiente · ${LS_ADVISOR_NAME}`;

/** Intrinsic size of both trimmed sources (~365×72); the rendered height comes from CSS. */
const LOGO_W = 365;
const LOGO_H = 72;

/**
 * The LegalShield lockup used in place of the Isaac Plans logo on the funnel routes.
 *
 * Three things here are load-bearing rather than cosmetic:
 *
 * - **The mark is never a link.** Every other logo on the site returns you home; linking this one
 *   anywhere — least of all legalshield.com — is what turns "an associate's marketing page" into
 *   "an official LegalShield page" in a reader's head, which is exactly what the associate
 *   advertising guidelines forbid.
 *
 * - **"Asociado Independiente" lives inside the same flex column as the mark**, not as a sibling a
 *   breakpoint could push onto its own row or below the fold. The disclosure only works if it is
 *   impossible to see the brand without it.
 *
 * - **Both logo versions are always in the DOM**, one hidden per colour scheme. Swapping the `src`
 *   would need client state and would flash the wrong logo on first paint; this renders correctly
 *   from the server in either mode. The second image costs ~1.5 KB and Next lazy-loads whichever
 *   is hidden.
 *
 * Deliberately has no "use client" of its own: it is plain markup, so it composes into the client
 * header and the server footer alike.
 */
export default function LegalShieldBrand({
  size = "header",
}: {
  size?: "header" | "footer";
}) {
  const isHeader = size === "header";
  const markClass = isHeader ? "h-7 w-auto sm:h-8" : "h-6 w-auto sm:h-7";

  return (
    <div
      className="flex flex-col items-center gap-1 text-center"
      aria-label={`LegalShield — ${ASSOCIATE_LINE}`}
    >
      <Image
        src={LEGAL_SHIELD_LOGO_URL_LIGHT}
        alt="LegalShield"
        width={LOGO_W}
        height={LOGO_H}
        className={`${markClass} dark:hidden`}
        priority={isHeader}
      />
      <Image
        src={LEGAL_SHIELD_LOGO_URL_DARK}
        alt="LegalShield"
        width={LOGO_W}
        height={LOGO_H}
        className={`${markClass} hidden dark:block`}
        priority={isHeader}
      />
      <span
        className={
          isHeader
            ? "text-[11px] font-medium leading-tight text-foreground/70 sm:text-xs"
            : "text-[11px] font-medium leading-tight text-gray-600 sm:text-xs dark:text-gray-400"
        }
      >
        {ASSOCIATE_LINE}
      </span>
    </div>
  );
}
