import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { LanguageProvider } from "@/hooks/useLanguage"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Dorraiz Insurance - Su Agente de Seguros de Confianza",
  description: "Especializado en seguros ACA, Medicare, Vida, Dental y Visión. Licenciado en más de 20 estados.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
