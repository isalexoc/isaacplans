"use client";

import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center space-x-1 hover:bg-green-50"
    >
      <Globe className="w-4 h-4" />
      <span className="text-sm font-medium">
        {language === "es" ? "ES" : "EN"}
      </span>
    </Button>
  );
}
