"use client";

import { useEffect, useRef, useState } from "react";
import { loadAgentCrmOnce } from "@/lib/agentCrmLoader";
import FormSkeleton from "@/components/form-skeleton";

type Props = { heightPx?: number };

/** Final Expense – Spanish form (Agent CRM) */
export default function ContactFormIFrameFESpanish({ heightPx = 950 }: Props) {
  const [visible, setVisible] = useState(false);
  const loadCount = useRef(0);

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
        src="https://link.agent-crm.com/widget/form/JdhN8DGB6EcNZT7zZ1tg"
        id="inline-JdhN8DGB6EcNZT7zZ1tg"
        title="Final Expense - Spanish - Funnel Form"
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
        data-form-name="Final Expense - Spanish - Funnel Form"
        data-height={`${heightPx}`}
        data-layout-iframe-id="inline-JdhN8DGB6EcNZT7zZ1tg"
        data-form-id="JdhN8DGB6EcNZT7zZ1tg"
        onLoad={() => {
          loadCount.current += 1;
          if (loadCount.current === 1) setTimeout(() => setVisible(true), 80);
        }}
      />
    </div>
  );
}
