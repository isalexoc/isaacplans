// components/contact-form-iframe-spanish.tsx  (ES)
"use client";

import { useEffect } from "react";
import { loadAgentCrmOnce } from "@/lib/agentCrmLoader";

export default function ContactFormIFrameSpanish() {
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      loadAgentCrmOnce().catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="w-full">
      <div className="min-h-[603px]">
        <iframe
          src="https://link.agent-crm.com/widget/form/mPN7YcIHFwUOipERfwfH"
          id="inline-mPN7YcIHFwUOipERfwfH"
          title="ACA - Lead Intake - Isaac Plans - Spanish"
          className="w-full h-full min-h-[623px] border-none block"
          loading="lazy"
          // allow redirect to top window only after user activation (submit)
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-write *"
        />
      </div>
    </div>
  );
}
