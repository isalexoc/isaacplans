/* app/aca/calendar/page.tsx – server component */

import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/ui/button";

/* helper */
const param = (p: string | string[] | undefined) =>
  Array.isArray(p) ? p[0] ?? "" : p ?? "";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function ACACalendarPage({ searchParams }: PageProps) {
  /* locale + translations */
  const locale = await getLocale(); // "en", "es", …
  const t = await getTranslations("acaPage.calendar");

  /* choose the correct base URL */
  const base =
    locale === "es"
      ? "https://link.agent-crm.com/widget/booking/MGgUxlHXgfQGa9UoZcv6" // Spanish
      : "https://link.agent-crm.com/widget/booking/HR7iDiMN8k01DUkGl8z0"; // English (default)

  /* build query string with any pre-filled fields */
  const qs = new URLSearchParams({
    first_name: param(searchParams.first_name),
    last_name: param(searchParams.last_name),
    email: param(searchParams.email),
    phone: param(searchParams.phone),
  });

  const iframeSrc =
    qs.toString().length > 0 ? `${base}?${qs.toString()}` : base;

  /* render */
  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-4">
      {/* header row */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <Button asChild variant="secondary">
          <Link href="/aca">{t("backButton")}</Link>
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1">
          {t("title")}
        </h1>

        <div className="w-[110px] sm:w-[120px]" />
      </div>

      {/* agent-CRM script */}
      <Script
        id="agent-crm-embed"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      {/* booking iframe */}
      <iframe
        src={iframeSrc}
        title="ACA Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
      />
    </main>
  );
}
