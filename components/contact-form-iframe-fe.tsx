"use client";

import { useEffect, useRef, useState } from "react";
import { loadAgentCrmOnce } from "@/lib/agentCrmLoader";
import FormSkeleton from "@/components/form-skeleton";

type Props = { heightPx?: number };

/** Final Expense – English form (Agent CRM) */
export default function ContactFormIFrameFE({ heightPx = 900 }: Props) {
  const [visible, setVisible] = useState(false);
  const loadCount = useRef(0);

  // Load vendor script once, off the render path
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      loadAgentCrmOnce().catch(() => {});
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative w-full">
      {!visible && <FormSkeleton />}

      <iframe
        src="https://link.agent-crm.com/widget/form/gOS8w3Ofdtq0uJQ0YnZE"
        id="inline-gOS8w3Ofdtq0uJQ0YnZE"
        title="Final Expense - Funnel Form"
        style={{ width: "100%", height: heightPx }}
        className={`block border-0 transition-opacity duration-150 will-change-[opacity] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        loading="eager"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-write *"
        data-layout='{"id":"INLINE"}'
        data-trigger-type="alwaysShow"
        data-activation-type="alwaysActivated"
        data-deactivation-type="neverDeactivate"
        data-form-name="Final Expense - Funnel Form"
        data-height={`${heightPx}`}
        data-layout-iframe-id="inline-gOS8w3Ofdtq0uJQ0YnZE"
        data-form-id="gOS8w3Ofdtq0uJQ0YnZE"
        onLoad={() => {
          loadCount.current += 1;
          if (loadCount.current === 1) setTimeout(() => setVisible(true), 80);
        }}
      />
    </div>
  );
}
