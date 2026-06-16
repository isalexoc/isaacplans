"use client";

import { useTranslations } from "next-intl";
import {
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
} from "lucide-react";

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
  </svg>
);

const ThreadsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden={true}>
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.348-.79-.987-1.479-1.934-2.043-.196 1.237-.601 2.267-1.232 3.06-.942 1.19-2.304 1.838-3.942 1.892-1.329.04-2.591-.305-3.556-1.004-1.131-.812-1.765-2.025-1.781-3.419-.033-2.757 2.1-4.517 5.47-4.685 1.234-.063 2.37.04 3.387.3-.138-.862-.434-1.557-.9-2.065-.634-.692-1.595-1.047-2.856-1.063-1.154.016-2.126.372-2.756 1.009-.457.463-.715 1.025-.766 1.673h-2.07c.054-.987.358-1.887.91-2.674.889-1.264 2.341-2.016 4.068-2.118.154-.01.31-.014.468-.014 1.965 0 3.544.604 4.695 1.795.927.96 1.493 2.257 1.68 3.849.394.189.77.4 1.127.63 1.338.847 2.293 1.957 2.762 3.213.757 2.03.524 4.806-1.886 7.155C17.08 23.28 14.93 24 12.186 24z"/>
  </svg>
);

export function BlogSocialLinks() {
  const social = useTranslations("social");

  const socials = [
    {
      href: social("facebook"),
      Icon: Facebook,
      label: "Facebook",
    },
    {
      href: social("instagram"),
      Icon: Instagram,
      label: "Instagram",
    },
    {
      href: social("youtube"),
      Icon: Youtube,
      label: "YouTube",
    },
    {
      href: social("linkedin"),
      Icon: Linkedin,
      label: "LinkedIn",
    },
    {
      href: social("tiktok"),
      Icon: TikTokIcon,
      label: "TikTok",
    },
    {
      href: social("threads"),
      Icon: ThreadsIcon,
      label: "Threads",
    },
  ];

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      {socials.map(({ href, Icon, label }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label} (opens in new tab)`}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

