/* app/aca/calendar/page.tsx */
"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";

/* ─── Calendar widget isolated for Suspense ─── */
function CalendarWidget() {
  const params = useSearchParams();

  const iframeSrc = useMemo(() => {
    const base =
      "https://link.agent-crm.com/widget/booking/HR7iDiMN8k01DUkGl8z0";

    const qs = new URLSearchParams({
      first_name: params.get("first_name") ?? "",
      last_name: params.get("last_name") ?? "",
      email: params.get("email") ?? "",
      phone: params.get("phone") ?? "",
    });

    return `${base}?${qs.toString()}`;
  }, [params]);

  return (
    <>
      {/* Agent‑CRM helper script */}
      <Script
        id="agent-crm-embed"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      {/* Booking iframe */}
      <iframe
        src={iframeSrc}
        title="ACA Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
        scrolling="no"
      />
    </>
  );
}

/* ─── Page component ─── */
export default function ACACalendarPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-4">
      {/* Header row: Back button + title */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <Button variant="secondary" onClick={() => router.back()}>
          ← Go&nbsp;Back
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center flex-1">
          Book Your ACA Phone Appointment
        </h1>

        {/* Spacer to keep the title centered */}
        <div className="w-[110px] sm:w-[120px]" />
      </div>

      {/* Suspense boundary for the widget */}
      <Suspense fallback={<p>Loading calendar…</p>}>
        <CalendarWidget />
      </Suspense>
    </main>
  );
}
