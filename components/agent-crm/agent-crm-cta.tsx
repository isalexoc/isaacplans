"use client";

import { ArrowRight } from "lucide-react";
import { trackCustomEvent } from "@/lib/facebook-pixel";
import { AGENT_CRM_AFFILIATE_URL } from "@/lib/agent-crm-affiliate";

/**
 * The affiliate button. Every "start with Agent CRM" control on the page is this component.
 *
 * Tracking is fire-and-forget on the way out: the click is NOT intercepted, so the browser
 * follows the href on its own timeline. Calling `preventDefault` to await an analytics beacon
 * would put a third-party script between an agent and the one link that pays — if the pixel is
 * blocked, slow, or throws, the referral must still land. Losing an analytics event is cheap;
 * losing the click is not.
 *
 * `placement` is passed to the event, not to the URL. FirstPromoter only reads `fpr`, so a
 * per-button UTM would add query noise to the referral link and report nothing back.
 */
export default function AgentCrmCta({
  label,
  placement,
  variant = "primary",
  className = "",
}: {
  label: string;
  /** Which button on the page was clicked — hero, bonus, final. Analytics only. */
  placement: string;
  variant?: "primary" | "light";
  className?: string;
}) {
  const base =
    "group inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-base font-bold shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 sm:text-lg";

  const styles =
    variant === "light"
      ? "bg-white text-brand hover:bg-slate-50 focus-visible:ring-white/60"
      : "bg-custom text-custom-foreground hover:opacity-95 focus-visible:ring-custom/40";

  return (
    <a
      href={AGENT_CRM_AFFILIATE_URL}
      target="_blank"
      rel="noopener sponsored"
      onClick={() => {
        try {
          trackCustomEvent("AgentCrmAffiliateClick", { placement });
        } catch {
          /* analytics must never block the referral */
        }
      }}
      className={`${base} ${styles} ${className}`}
    >
      {label}
      <ArrowRight className="h-5 w-5 flex-shrink-0 transition-transform group-hover:translate-x-1" />
    </a>
  );
}
