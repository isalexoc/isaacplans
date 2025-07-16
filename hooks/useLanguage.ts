"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  createElement,
} from "react";
import type React from "react";

export type Language = "es" | "en";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("es"); // temporary default

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language | null;

    if (savedLanguage === "es" || savedLanguage === "en") {
      setLanguage(savedLanguage);
    } else {
      // Detect browser language
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === "en" || browserLang === "es") {
        setLanguage(browserLang);
        localStorage.setItem("language", browserLang);
      } else {
        setLanguage("en"); // fallback to English if other language
        localStorage.setItem("language", "en");
      }
    }
  }, []);

  const toggleLanguage = () => {
    const newLanguage = language === "es" ? "en" : "es";
    setLanguage(newLanguage);
    localStorage.setItem("language", newLanguage);
  };

  const contextData = {
    language,
    toggleLanguage,
  };

  return createElement(
    LanguageContext.Provider,
    { value: contextData },
    children
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
