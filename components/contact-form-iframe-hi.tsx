/* components/contact-form-iframe-hi.tsx */
"use client";

import { useEffect, useRef, useState } from "react";
import { loadAgentCrmOnce } from "@/lib/agentCrmLoader";
import FormSkeleton from "@/components/form-skeleton";

type Props = { heightPx?: number };

export default function ContactFormIFrameHI({ heightPx = 1100 }: Props) {
  const [visible, setVisible] = useState(false);
  const loadCount = useRef(0);

  // background-load vendor helper; don't block render
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
        src="https://link.agent-crm.com/widget/form/CSImCeI2LfyKeeBteXuP"
        id="inline-CSImCeI2LfyKeeBteXuP"
        title="Hospital Indemnity - Lead Intake"
        style={{ width: "100%", height: heightPx }}
        className={`block border-0 transition-opacity duration-150 will-change-[opacity] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        loading="eager"
        // allow top-level redirect only after user activation (submit)
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-write *"
        data-layout='{"id":"INLINE"}'
        data-trigger-type="alwaysShow"
        data-activation-type="alwaysActivated"
        data-deactivation-type="neverDeactivate"
        data-form-name="Hospital Indemnity - Lead Intake"
        data-height={`${heightPx}`}
        data-layout-iframe-id="inline-CSImCeI2LfyKeeBteXuP"
        data-form-id="CSImCeI2LfyKeeBteXuP"
        onLoad={() => {
          // vendor often does an initial nav; reveal after first real load
          loadCount.current += 1;
          if (loadCount.current === 1) setTimeout(() => setVisible(true), 80);
        }}
      />
    </div>
  );
}
