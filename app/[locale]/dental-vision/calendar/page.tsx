/* app/dental-vision/calendar/page.tsx – server component */
import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/ui/button";

/* Little helper to coerce SearchParams */
const param = (p: string | string[] | undefined) =>
  Array.isArray(p) ? p[0] ?? "" : p ?? "";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function DentalVisionCalendarPage({
  searchParams,
}: PageProps) {
  /* locale + translations */
  const locale = await getLocale(); // "en", "es", …
  const t = await getTranslations("dentalVisionPage.calendar");

  /* Choose the booking URL by language */
  const base =
    locale === "es"
      ? "https://link.agent-crm.com/widget/booking/rRdoJtrmAvJ0FsgZwQqs" // 👈 add when you get it
      : "https://link.agent-crm.com/widget/booking/62geCc4o9uF3lhsfcJ14"; // English (default)

  /* Build query string if any pre-filled fields arrive */
  const qs = new URLSearchParams({
    first_name: param(searchParams.first_name),
    last_name: param(searchParams.last_name),
    email: param(searchParams.email),
    phone: param(searchParams.phone),
  });

  const iframeSrc = qs.toString() ? `${base}?${qs}` : base;

  /* Render */
  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-4">
      {/* Header row */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <Button asChild variant="secondary">
          {/* Change /dental-vision to whatever route is your listing page */}
          <Link href="/dental-vision">{t("backButton")}</Link>
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1">
          {t("title")}
        </h1>

        {/* spacer keeps title centred */}
        <div className="w-[110px] sm:w-[120px]" />
      </div>

      {/* Agent-CRM helper script (loads once after hydration) */}
      <Script
        id="agent-crm-embed"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      {/* Booking iframe */}
      <iframe
        src={iframeSrc}
        title="Dental & Vision Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
      />
    </main>
  );
}
