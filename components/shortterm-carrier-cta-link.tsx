"use client";

import { Button } from "@/components/ui/button";
import { trackGcfAdsCarrierEnrollClick } from "@/lib/analytics/get-covered-fast-ga";
import type { GcfCarrierConversionHub } from "@/lib/get-covered-fast/gcf-attribution";
import { ArrowRight, ExternalLink } from "lucide-react";

type Props = {
  href: string;
  isExternal: boolean;
  carrierId: string;
  carrierName: string;
  ctaLabel: string;
  ctaShort: string;
  gcfAdsCarrierConversionEnabled?: boolean;
  carrierHubContext?: GcfCarrierConversionHub;
};

/** Carrier card CTA; fires GA conversion only for paid ads GCF attribution. */
export default function ShortTermCarrierCtaLink({
  href,
  isExternal,
  carrierId,
  carrierName,
  ctaLabel,
  ctaShort,
  gcfAdsCarrierConversionEnabled,
  carrierHubContext,
}: Props) {
  const onClick = () => {
    if (
      gcfAdsCarrierConversionEnabled &&
      carrierHubContext !== undefined
    ) {
      trackGcfAdsCarrierEnrollClick(carrierId, carrierHubContext);
    }
  };

  return (
    <Button
      asChild
      size="lg"
      className="w-full gap-2 rounded-xl bg-[hsl(var(--custom))] font-semibold text-white shadow-md transition hover:bg-[hsl(var(--custom)/0.92)] hover:shadow-lg"
    >
      <a
        href={href}
        className="inline-flex items-center justify-center"
        onClick={onClick}
        {...(isExternal && {
          target: "_blank",
          rel: "noopener noreferrer",
        })}
      >
        <span className="sr-only">{carrierName}: </span>
        <span className="md:hidden">{ctaShort}</span>
        <span className="hidden md:inline">{ctaLabel}</span>
        {isExternal ? (
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <ArrowRight
            className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </a>
    </Button>
  );
}
