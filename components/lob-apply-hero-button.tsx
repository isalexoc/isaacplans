"use client";

/**
 * Secondary hero CTA on a line-of-business main page: links to that LOB's public self-service
 * apply funnel. Self-contained bilingual copy (no new i18n keys), matching the convention the
 * original per-LOB buttons established.
 *
 * Replaces the byte-identical `aca-apply-hero-button` / `iul-apply-hero-button` /
 * `final-expense-apply-hero-button` trio — going to eight lines of business would have meant
 * eight copies of the same 27 lines.
 */
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { LOBS, type LobSlug } from "@/lib/lob/registry";

export default function LobApplyHeroButton({ lob }: { lob: LobSlug }) {
  const isES = useLocale().startsWith("es");
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className="w-full gap-2 rounded-md border-2 border-blue-600 py-3 text-lg font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950 sm:w-auto sm:text-xl"
    >
      <Link href={LOBS[lob].applyRoute}>
        {isES ? "¿Listo para aplicar ahora?" : "Ready to apply now?"}
        <ArrowRight className="h-5 w-5" />
      </Link>
    </Button>
  );
}
