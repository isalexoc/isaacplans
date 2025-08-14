// components/contact-form-iframe-general.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import FormSkeleton from "@/components/form-skeleton";

type Props = { heightPx?: number };

export default function ContactFormIFrameGeneral({ heightPx = 760 }: Props) {
  const [visible, setVisible] = useState(false);
  const revealTimer = useRef<number | null>(null);

  const onIFrameLoad = () => {
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    // Debounce reveal so any internal redirect completes first
    revealTimer.current = window.setTimeout(() => setVisible(true), 180);
  };

  useEffect(() => {
    return () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
    };
  }, []);

  return (
    <div
      className="relative w-full"
      aria-busy={!visible}
      style={{ height: heightPx }}
    >
      {/* Iframe */}
      <iframe
        src="https://link.agent-crm.com/widget/form/R7X4k5dTsAORoIyMq6Kz"
        id="inline-R7X4k5dTsAORoIyMq6Kz"
        title="A2P General Optin"
        className={`absolute inset-0 w-full h-full border-0 transition-opacity duration-200 will-change-[opacity] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        loading="eager"
        // Allow vendor to redirect parent after submit, only on user activation:
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-write *"
        onLoad={onIFrameLoad}
        // Optional metadata (not required for rendering, but fine to include)
        data-layout='{"id":"INLINE"}'
        data-trigger-type="alwaysShow"
        data-activation-type="alwaysActivated"
        data-deactivation-type="neverDeactivate"
        data-form-name="A2P General Optin"
        data-height={`${heightPx}`}
        data-layout-iframe-id="inline-R7X4k5dTsAORoIyMq6Kz"
        data-form-id="R7X4k5dTsAORoIyMq6Kz"
      />

      {/* Skeleton overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${
          visible ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <FormSkeleton />
      </div>
    </div>
  );
}
