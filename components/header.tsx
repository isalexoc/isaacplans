"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Phone } from "lucide-react"
import { motion } from "framer-motion"
import { useLanguage } from "@/hooks/useLanguage"
import { translations } from "@/lib/translations"
import { Globe } from "lucide-react"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const { language, toggleLanguage } = useLanguage()
  const t = translations[language]

  const navItems = [
    { name: t.nav.home, href: "#home" },
    { name: t.nav.services, href: "#services" },
    { name: t.nav.about, href: "#about" },
    { name: t.nav.coverage, href: "#coverage" },
    { name: t.nav.contact, href: "#contact" },
  ]

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl text-gray-900">Dorraiz</span>
              <span className="text-xs text-green-600 font-medium">INSURANCE</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-600 hover:text-green-600 transition-colors font-medium"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Contact Info, Language Toggle & CTA */}
          <div className="hidden lg:flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>{t.header.phone}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="flex items-center space-x-1">
              <Globe className="w-4 h-4" />
              <span className="text-sm font-medium">{language === "es" ? "EN" : "ES"}</span>
            </Button>
            <Button className="bg-green-600 hover:bg-green-700">{t.header.cta}</Button>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <nav className="flex flex-col space-y-4 mt-8">
                {navItems.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-gray-600 hover:text-green-600 transition-colors font-medium py-2"
                    onClick={() => setIsOpen(false)}
                  >
                    {item.name}
                  </a>
                ))}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{t.header.phone}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={toggleLanguage} className="flex items-center space-x-1">
                      <Globe className="w-4 h-4" />
                      <span className="text-sm font-medium">{language === "es" ? "EN" : "ES"}</span>
                    </Button>
                  </div>
                  <Button className="w-full bg-green-600 hover:bg-green-700">{t.header.cta}</Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  )
}
