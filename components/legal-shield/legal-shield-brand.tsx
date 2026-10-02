import { ShieldCheck } from "lucide-react";

import { LS_ADVISOR_NAME } from "@/lib/legal-shield/constants";

/** One string so the header and footer disclosures can never drift out of sync. */
const ASSOCIATE_LINE = `Asociado Independiente · ${LS_ADVISOR_NAME}`;

/**
 * The "Escudo Legal" lockup that stands in for a logo on the funnel routes.
 *
 * **It is typographic on purpose.** LegalShield's advertising guidelines do not let an Independent
 * Associate put the company's mark on their own marketing, so there is no LegalShield artwork
 * anywhere on these pages. "Escudo Legal" is the name of the offer — the same name printed on the
 * guide — which makes it the honest thing to brand the page with. The shield is a generic icon,
 * chosen to look nothing like LegalShield's split-shield mark.
 *
 * The company is still NAMED in text, in the footer disclaimer and the FAQ. That is not the same
 * thing as using the logo: the disclosure is required to say what Ysmael is an associate of, and
 * removing the name would make it meaningless.
 *
 * Two details that are load-bearing rather than cosmetic:
 *
 * - **The mark is never a link.** Every other logo on the site returns you home; linking this one
 *   anywhere — least of all legalshield.com — is what turns "an associate's marketing page" into
 *   "an official LegalShield page" in a reader's head.
 *
 * - **"Asociado Independiente" lives inside the same flex column as the mark**, not as a sibling a
 *   breakpoint could push onto its own row or below the fold. The disclosure only works if it is
 *   impossible to see the brand without it.
 *
 * Deliberately has no "use client" of its own: it is plain markup, so it composes into the client
 * header and the server footer alike. Being text rather than two images also means nothing to
 * download, no layout shift, and it stays sharp at any size.
 */
export default function LegalShieldBrand({
  size = "header",
}: {
  size?: "header" | "footer";
}) {
  const isHeader = size === "header";

  return (
    <div
      className="flex flex-col items-center gap-1 text-center"
      aria-label={`Escudo Legal — ${ASSOCIATE_LINE}`}
    >
      <span className="flex items-center gap-2.5">
        <span
          className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-[#8124BC] to-[#9D4EDD] shadow-sm ${
            isHeader ? "h-9 w-9" : "h-8 w-8"
          }`}
        >
          <ShieldCheck
            className={isHeader ? "h-5 w-5 text-white" : "h-[18px] w-[18px] text-white"}
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </span>
        <span
          className={`font-extrabold leading-none tracking-tight text-foreground ${
            isHeader ? "text-xl sm:text-2xl" : "text-lg"
          }`}
        >
          Escudo <span className="text-[#8124BC] dark:text-purple-300">Legal</span>
        </span>
      </span>
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
