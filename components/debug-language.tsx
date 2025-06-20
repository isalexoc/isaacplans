"use client"

import { useLanguage } from "@/hooks/useLanguage"

export function DebugLanguage() {
  const { language } = useLanguage()

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white px-3 py-1 rounded text-xs z-50">
      Current Language: {language}
    </div>
  )
}
