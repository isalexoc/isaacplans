/* components/contact-form-iframe-dental.tsx */
"use client";

import { useEffect, useRef, useState } from "react";
import { loadAgentCrmOnce } from "@/lib/agentCrmLoader";
import FormSkeleton from "@/components/form-skeleton";

type Props = { heightPx?: number };

export default function ContactFormIFrameDental({ heightPx = 1100 }: Props) {
  const [visible, setVisible] = useState(false);
  const loadCount = useRef(0);

  // Load vendor helper in the background (no render block)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      loadAgentCrmOnce().catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative w-full">
      {/* Skeleton overlay (hidden once iframe is painted) */}
      {!visible && <FormSkeleton />}

      <iframe
        src="https://link.agent-crm.com/widget/form/0YWpgL7LJqEK7sp84O3z"
        id="inline-0YWpgL7LJqEK7sp84O3z"
        title="Dental & Vision Insurance - Lead Intake"
        style={{ width: "100%", height: heightPx }}
        className={`block border-0 transition-opacity duration-150 will-change-[opacity] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        loading="eager"
        // allow redirect to top after submit
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-write *"
        data-layout='{"id":"INLINE"}'
        data-trigger-type="alwaysShow"
        data-activation-type="alwaysActivated"
        data-deactivation-type="neverDeactivate"
        data-form-name="Dental & Vision Insurance - Lead Intake"
        data-height={`${heightPx}`}
        data-layout-iframe-id="inline-0YWpgL7LJqEK7sp84O3z"
        data-form-id="0YWpgL7LJqEK7sp84O3z"
        onLoad={() => {
          // Vendor often does an initial navigation then the real form.
          loadCount.current += 1;
          if (loadCount.current === 1) {
            setTimeout(() => setVisible(true), 80);
          }
        }}
      />
    </div>
  );
}
