"use client";

import { useEffect, useRef, useState } from "react";
import { loadAgentCrmOnce } from "@/lib/agentCrmLoader";
import FormSkeleton from "@/components/form-skeleton";

type Props = { heightPx?: number };

export default function ContactFormIFrameIUL({ heightPx = 620 }: Props) {
  const [visible, setVisible] = useState(false);
  const loadCount = useRef(0);

  // Load AgentCRM embed script once, off the main render path
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
        src="https://link.agent-crm.com/widget/form/YXChLe19u0Bo7MJOSSdA"
        id="inline-YXChLe19u0Bo7MJOSSdA"
        title="IUL - Lead Intake - Isaac Plans"
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
        data-form-name="IUL - Lead Intake - Isaac Plans"
        data-height={`${heightPx}`}
        data-layout-iframe-id="inline-YXChLe19u0Bo7MJOSSdA"
        data-form-id="YXChLe19u0Bo7MJOSSdA"
        onLoad={() => {
          loadCount.current += 1;
          if (loadCount.current === 1) setTimeout(() => setVisible(true), 80);
        }}
      />
    </div>
  );
}
