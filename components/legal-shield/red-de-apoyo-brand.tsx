import { LS_ADVISOR_NAME, LS_BRAND_NAME } from "@/lib/legal-shield/constants";

/**
 * "Red de Apoyo Latino USA": the brand on Ysmael's Legal Shield intake pages and his deck (the
 * opt-in funnel keeps its "Escudo Legal" lockup, components/legal-shield/legal-shield-brand.tsx).
 *
 * The same rules as that lockup, for the same reasons (LegalShield's rules for Independent
 * Associates):
 * - **Never LegalShield's mark.** The shield-heart-leaf is Red de Apoyo's own, redrawn from Isaac's
 *   deck (public/images/legal-shield/red-de-apoyo-mark.svg).
 * - **Never a link**, so the page can't read as an official LegalShield property.
 * - **"Asociado independiente · Ysmael Orraiz" inside the same block**, so the brand is never on
 *   screen without the disclosure.
 *
 * Plain markup (no "use client"), usable in the client header and the server footer alike. The mark
 * is an <img> so its gradient ids can't clash when the brand appears twice on a page.
 */
export default function RedDeApoyoBrand({
  size = "header",
  tone = "auto",
}: {
  size?: "header" | "footer";
  /** `dark`: white wordmark for a navy background (the deck); `auto`: follows the site theme. */
  tone?: "auto" | "dark";
}) {
  const isHeader = size === "header";
  const top = tone === "dark" ? "text-white/90" : "text-[#0b2545] dark:text-white/90";
  return (
    <div className="flex items-center gap-2.5" aria-label={`${LS_BRAND_NAME} — Asociado independiente · ${LS_ADVISOR_NAME}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG mark, no optimization to gain */}
      <img
        src="/images/legal-shield/red-de-apoyo-mark.svg"
        alt=""
        width={40}
        height={40}
        className={isHeader ? "h-9 w-9 shrink-0 md:h-10 md:w-10" : "h-8 w-8 shrink-0"}
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span className={`text-[10px] font-bold tracking-[0.2em] md:text-[11px] ${top}`}>RED DE APOYO</span>
        <span className="mt-0.5 text-[14px] font-extrabold tracking-[0.12em] text-[#b8902f] md:text-[15px] dark:text-[#e2bd62]">
          LATINO USA
        </span>
        <span
          className={`mt-1 truncate text-[10px] font-medium md:text-[11px] ${
            tone === "dark" ? "text-white/60" : "text-muted-foreground"
          }`}
        >
          Asociado independiente · {LS_ADVISOR_NAME}
        </span>
      </span>
    </div>
  );
}
