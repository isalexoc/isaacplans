"use client";

import {
  agentDisplayName,
  formatLeaveBehindEmailForImage,
  formatLeaveBehindPhoneForImage,
} from "@/lib/leave-behind-agent-profile";
import type { LeaveBehindAgentProfile } from "@/lib/leave-behind-agent-profile";

export type AgentFooterProps = {
  profile: LeaveBehindAgentProfile;
  variant?: "card" | "compare";
};

/** Branded agent block rendered at the bottom of leave-behind previews (replaces static banner). */
export function AgentFooter({ profile, variant = "card" }: AgentFooterProps) {
  const name = agentDisplayName(profile.firstName, profile.lastName);
  const title = profile.professionalTitle.trim();
  const phone = formatLeaveBehindPhoneForImage(profile.phone);
  const email = formatLeaveBehindEmailForImage(profile.email);
  const contactLine = [phone, email].filter(Boolean).join(" · ");
  const isCompare = variant === "compare";

  return (
    <div
      style={{
        width: isCompare ? "calc(100% + 64px)" : "100%",
        marginLeft: isCompare ? -32 : 0,
        marginRight: isCompare ? -32 : 0,
        marginTop: isCompare ? 30 : 0,
        padding: isCompare ? "22px 28px 24px" : "12px 0 4px",
        boxSizing: "border-box",
        backgroundColor: isCompare ? "#021428" : "transparent",
        borderTop: isCompare ? "1px solid rgba(255,255,255,0.14)" : undefined,
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isCompare ? 20 : 14,
          justifyContent: isCompare ? "center" : "flex-start",
          maxWidth: isCompare ? 720 : "100%",
          margin: isCompare ? "0 auto" : undefined,
        }}
      >
        <img
          src={profile.profileImageUrl}
          alt=""
          width={isCompare ? 72 : 56}
          height={isCompare ? 72 : 56}
          crossOrigin="anonymous"
          style={{
            width: isCompare ? 72 : 56,
            height: isCompare ? 72 : 56,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
            border: "2px solid rgba(255,255,255,0.35)",
          }}
          aria-hidden
        />
        <div style={{ textAlign: isCompare ? "left" : "left", minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: isCompare ? 22 : 18,
              fontWeight: 700,
              color: "#faf6eb",
              lineHeight: 1.2,
            }}
          >
            {name}
          </p>
          {title && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: isCompare ? 14 : 12,
                fontWeight: 600,
                color: "rgba(250,246,235,0.85)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {title}
            </p>
          )}
          {(phone || email) && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: isCompare ? 15 : 13,
                color: "rgba(250,246,235,0.75)",
                lineHeight: 1.4,
              }}
            >
              {contactLine}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
