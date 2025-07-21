/* app/aca/calendar/page.tsx */
"use client";

import { useSearchParams } from "next/navigation";
import Script from "next/script";
import { useMemo } from "react";

export default function ACACalendarPage() {
  /** Grab the data Agent‑CRM attached to the redirect URL */
  const params = useSearchParams();

  const iframeSrc = useMemo(() => {
    const base =
      "https://link.agent-crm.com/widget/booking/HR7iDiMN8k01DUkGl8z0";

    // Safely encode params (empty string if not present)
    const qs = new URLSearchParams({
      first_name: params.get("first_name") ?? "",
      last_name: params.get("last_name") ?? "",
      email: params.get("email") ?? "",
      phone: params.get("phone") ?? "",
    });

    return `${base}?${qs.toString()}`;
  }, [params]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-start gap-6 p-4">
      <h1 className="text-3xl font-bold text-center">
        Book Your ACA Appointment
      </h1>

      {/* Agent‑CRM helper script (loads once) */}
      <Script
        id="agent-crm-embed"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      {/* Booking widget */}
      <iframe
        src={iframeSrc}
        title="ACA Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
        scrolling="no"
      />
    </main>
  );
}
