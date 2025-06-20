"use client"

import { Hero } from "@/components/hero"
import { Services } from "@/components/services"
import { About } from "@/components/about"
import { Coverage } from "@/components/states"
import { Contact } from "@/components/contact"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { DebugLanguage } from "@/components/debug-language"

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Services />
      <About />
      <Coverage />
      <Contact />
      <Footer />
      <DebugLanguage />
    </main>
  )
}
