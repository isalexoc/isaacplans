"use client";

import { useTranslations } from "next-intl";
import {
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
} from "lucide-react";

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

