"use client";

/**
 * Secondary hero CTA for the /final-expense page: links to the public self-service
 * /final-expense/apply funnel. Self-contained bilingual copy (no new i18n keys), mirrors
 * IulApplyHeroButton.
 */
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function FinalExpenseApplyHeroButton() {
  const isES = useLocale().startsWith("es");
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className="w-full gap-2 rounded-md border-2 border-blue-600 py-3 text-lg font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950 sm:w-auto sm:text-xl"
    >
      <Link href="/final-expense/apply">
        {isES ? "¿Listo para aplicar ahora?" : "Ready to apply now?"}
        <ArrowRight className="h-5 w-5" />
      </Link>
    </Button>
  );
}
