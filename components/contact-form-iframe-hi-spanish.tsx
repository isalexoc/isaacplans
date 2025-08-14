/* components/contact-form-iframe-hi-spanish.tsx */
"use client";

import { useEffect, useRef, useState } from "react";
import { loadAgentCrmOnce } from "@/lib/agentCrmLoader";
import FormSkeleton from "@/components/form-skeleton";

type Props = { heightPx?: number };

export default function ContactFormIFrameHISpanish({ heightPx = 1250 }: Props) {
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
        src="https://link.agent-crm.com/widget/form/MAQms9iGbl4F5rReCscp"
        id="inline-MAQms9iGbl4F5rReCscp"
        title="Hospital Indemnity - Lead Intake - Spanish"
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
        data-form-name="Hospital Indemnity - Lead Intake - Spanish"
        data-height={`${heightPx}`}
        data-layout-iframe-id="inline-MAQms9iGbl4F5rReCscp"
        data-form-id="MAQms9iGbl4F5rReCscp"
        onLoad={() => {
          loadCount.current += 1;
          if (loadCount.current === 1) setTimeout(() => setVisible(true), 80);
        }}
      />
    </div>
  );
}
