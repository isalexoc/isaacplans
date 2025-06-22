import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/hooks/useLanguage";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dorraiz Insurance - Su Agente de Seguros de Confianza",
  description:
    "Especializado en seguros ACA, Medicare, Vida, Dental y Visión. Licenciado en más de 20 estados. Obtenga su cotización gratuita hoy.",
  generator: "v0.dev",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es" className="scroll-smooth">
      <body
        className={`${inter.className} flex min-h-screen flex-col bg-white text-gray-900 overflow-x-hidden`}
      >
        <LanguageProvider>
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Toaster />
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
