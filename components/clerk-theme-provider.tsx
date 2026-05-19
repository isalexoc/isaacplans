"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { enUS } from "@clerk/localizations";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { getClerkAppearance } from "@/lib/clerk-appearance";

type ClerkThemeProviderProps = {
  children: React.ReactNode;
  localization: typeof enUS;
};

export function ClerkThemeProvider({
  children,
  localization,
}: ClerkThemeProviderProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const appearance = useMemo(
    () => getClerkAppearance(isDark),
    [isDark],
  );

  return (
    // ClerkProvider + React 19 types: async return type on server export
    // @ts-expect-error ClerkProvider works in client trees; types lag React 19
    <ClerkProvider localization={localization} appearance={appearance}>
      {children}
    </ClerkProvider>
  );
}
