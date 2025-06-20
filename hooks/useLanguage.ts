"use client"

import { useState, useEffect } from "react"

export type Language = "es" | "en"

export function useLanguage() {
  const [language, setLanguage] = useState<Language>("es")

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language
    if (savedLanguage) {
      setLanguage(savedLanguage)
    }
  }, [])

  const toggleLanguage = () => {
    const newLanguage = language === "es" ? "en" : "es"
    setLanguage(newLanguage)
    localStorage.setItem("language", newLanguage)
  }

  return { language, toggleLanguage }
}
