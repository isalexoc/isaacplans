// components/contact-form-iframe-general-spanish.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import FormSkeleton from "@/components/form-skeleton";

type Props = { heightPx?: number };

export default function ContactFormIFrameGeneralSpanish({
  heightPx = 950,
}: Props) {
  const [visible, setVisible] = useState(false);
  const revealTimer = useRef<number | null>(null);

  const onIFrameLoad = () => {
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
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
      <iframe
        src="https://link.agent-crm.com/widget/form/B3YtFv2qtHRnDmdCiQvj"
        id="inline-B3YtFv2qtHRnDmdCiQvj"
        title="A2P General Opt-in – Spanish"
        className={`absolute inset-0 w-full h-full border-0 transition-opacity duration-200 will-change-[opacity] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        loading="eager"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="clipboard-write *"
        onLoad={onIFrameLoad}
        data-layout='{"id":"INLINE"}'
        data-trigger-type="alwaysShow"
        data-activation-type="alwaysActivated"
        data-deactivation-type="neverDeactivate"
        data-form-name="A2P General Opt-in – Spanish"
        data-height={`${heightPx}`}
        data-layout-iframe-id="inline-B3YtFv2qtHRnDmdCiQvj"
        data-form-id="B3YtFv2qtHRnDmdCiQvj"
      />

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
