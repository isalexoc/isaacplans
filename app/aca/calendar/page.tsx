/* app/aca/calendar/page.tsx */
"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";

/* ─── The part that actually needs the hook ─── */
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
      <Script
        id="agent-crm-embed"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      <iframe
        src={iframeSrc}
        title="ACA Appointment Calendar"
        className="w-full max-w-4xl h-[80vh] md:rounded-lg border-none shadow-lg"
        scrolling="no"
      />
    </>
  );
}

/* ─── Page component wrapped in Suspense ─── */
export default function ACACalendarPage() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-4">
      <h1 className="text-3xl font-bold text-center">
        Book Your ACA Appointment
      </h1>

      {/* ✅ Satisfies “wrap useSearchParams in a suspense boundary” */}
      <Suspense fallback={<p>Loading calendar…</p>}>
        <CalendarWidget />
      </Suspense>
    </main>
  );
}
