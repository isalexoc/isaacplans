"use client"

import { useState, useEffect, createContext, useContext } from "react"
import type React from "react"

export type Language = "es" | "en"

interface LanguageContextType {
  language: Language
  toggleLanguage: () => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("es")

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language")
    if (savedLanguage === "es" || savedLanguage === "en") {
      setLanguage(savedLanguage)
    }
  }, [])

  const toggleLanguage = () => {
    const newLanguage = language === "es" ? "en" : "es"
    setLanguage(newLanguage)
    localStorage.setItem("language", newLanguage)
  }

  const contextData = {
    language: language,
    toggleLanguage: toggleLanguage,
  }

  return <LanguageContext.Provider {...{ value: contextData }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
