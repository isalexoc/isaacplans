"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Locale, routing, usePathname, useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  defaultValue: string;
  label: string;
};

export default function LocaleSwitcherSelect({ defaultValue, label }: Props) {
  const router = useRouter();

  const pathname = usePathname();
  const params = useParams();

  function onSelectChange(nextLocale: string) {
    // Check if pathname contains dynamic segments (e.g., [slug], [guideId])
    const hasDynamicSegments = pathname.includes("[");
    
    if (hasDynamicSegments && params) {
      // Extract all params except 'locale' (which is handled separately)
      const routeParams: Record<string, string> = {};
      Object.keys(params).forEach((key) => {
        if (key !== "locale" && params[key]) {
          routeParams[key] = params[key] as string;
        }
      });
      
      // Pass params for dynamic routes
      router.replace(
        { pathname, params: routeParams } as any,
        { locale: nextLocale as Locale }
      );
    } else {
      // For static routes, use the pathname as is
      router.replace({ pathname } as any, { locale: nextLocale as Locale });
    }
  }

  return (
    <Select defaultValue={defaultValue} onValueChange={onSelectChange}>
      <SelectTrigger
        className="w-[60px] h-8 border-none bg-transparent focus:ring-0 focus:ring-offset-0"
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {locale.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
