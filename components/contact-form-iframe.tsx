// components/contact-form-iframe.tsx  (EN)
"use client";

import { useEffect } from "react";
import { loadAgentCrmOnce } from "@/lib/agentCrmLoader";

const ContactFormIFrame = () => {
  // Show the iframe immediately; load vendor script in the background
  useEffect(() => {
    // after first paint to avoid jank on open
    const id = requestAnimationFrame(() => {
      loadAgentCrmOnce().catch(() => {}); // non-fatal
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="w-full">
      {/* Reserve height to avoid CLS. If your form is ~603px tall, use 603px */}
      <div className="min-h-[603px]">
        <iframe
          src="https://link.agent-crm.com/widget/form/z3BuLLWvo2JRqrtkElq8"
          id="inline-z3BuLLWvo2JRqrtkElq8"
          title="ACA - Lead Intake - Isaac Plans"
          className="w-full h-full min-h-[603px] border-none block"
          loading="lazy"
          sandbox="allow-forms allow-scripts allow-same-origin"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-write *"
        />
      </div>
    </div>
  );
};

export default ContactFormIFrame;
