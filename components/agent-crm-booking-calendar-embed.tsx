"use client";

import { useLayoutEffect, useRef } from "react";
import { AGENT_CRM_NO_SWEEP_HTML_ATTR } from "@/lib/agent-crm-calendar-route";

const FORM_EMBED_SRC = "https://link.agent-crm.com/js/form_embed.js";

export type AgentCrmBookingCalendarEmbedProps = {
  iframeSrc: string;
  title: string;
  /** Booking widget public id from Agent CRM (path segment after /widget/booking/) — used for iframe id. */
  widgetPublicId: string;
};

/**
 * Mirrors Agent CRM embed: `<iframe …></iframe><script src="form_embed.js">`.
 * `form_embed.js` must run with the iframe already in the DOM and immediately after it;
 * Next `<Script>` above the iframe was the wrong order and can break resize/init.
 */
export default function AgentCrmBookingCalendarEmbed({
  iframeSrc,
  title,
  widgetPublicId,
}: AgentCrmBookingCalendarEmbedProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    /** Runs before AgentCrmChat (deeper in React tree) so chat sweep + loader stay off. */
    document.documentElement.setAttribute(AGENT_CRM_NO_SWEEP_HTML_ATTR, "");

    const wrap = wrapRef.current;
    if (!wrap) {
      return () => {
        document.documentElement.removeAttribute(AGENT_CRM_NO_SWEEP_HTML_ATTR);
      };
    }

    wrap
      .querySelectorAll('script[data-agentcrm-booking-embed="1"]')
      .forEach((n) => n.remove());

    const s = document.createElement("script");
    s.src = FORM_EMBED_SRC;
    s.async = true;
    s.type = "text/javascript";
    s.dataset.agentcrmBookingEmbed = "1";
    wrap.appendChild(s);

    return () => {
      document.documentElement.removeAttribute(AGENT_CRM_NO_SWEEP_HTML_ATTR);
      wrap
        .querySelectorAll('script[data-agentcrm-booking-embed="1"]')
        .forEach((n) => n.remove());
    };
  }, [iframeSrc]);

  const safeId = widgetPublicId.replace(/[^a-zA-Z0-9_-]/g, "");
  const iframeId = `${safeId}_isaacplans`;

  return (
    <div ref={wrapRef} className="w-full max-w-4xl min-h-[min(80vh,720px)]">
      <iframe
        id={iframeId}
        src={iframeSrc}
        title={title}
        className="h-[80vh] min-h-[480px] w-full overflow-hidden border-none shadow-lg md:rounded-lg"
        style={{ width: "100%", border: "none", overflow: "hidden" }}
        scrolling="no"
        allow="camera; microphone; fullscreen; payment; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
