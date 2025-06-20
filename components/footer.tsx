"use client"

import { Separator } from "@/components/ui/separator"
import { Phone, Mail, MapPin, Facebook, Instagram } from "lucide-react"
import { useLanguage } from "@/hooks/useLanguage"
import { translations } from "@/lib/translations"

export function Footer() {
  const { language } = useLanguage()
  const t = translations[language]
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    services: [
      { name: t.services.items.aca.title, href: "#services" },
      { name: t.services.items.medicare.title, href: "#services" },
      { name: t.services.items.family.title, href: "#services" },
      { name: t.services.items.comparison.title, href: "#services" },
    ],
    resources: [
      { name: t.footer.links.guide, href: "#" },
      { name: t.footer.links.faq, href: "#" },
      { name: t.footer.links.blog, href: "#" },
      { name: t.footer.links.regulations, href: "#" },
    ],
    company: [
      { name: t.nav.about, href: "#about" },
      { name: t.nav.coverage, href: "#coverage" },
      { name: t.nav.contact, href: "#contact" },
      { name: t.footer.links.privacy, href: "#" },
    ],
  }

  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4 lg:space-y-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl">Dorraiz</span>
                <span className="text-xs text-green-400 font-medium">INSURANCE</span>
              </div>
            </div>
            <p className="text-gray-400 leading-relaxed text-sm lg:text-base">{t.footer.description}</p>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm">
                <Phone className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="break-words">(956) 302-1451 / (407) 785-9073</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Mail className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="break-words">dorraizinsurance@gmail.com</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <MapPin className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>{language === "es" ? "Licenciado en 20+ Estados" : "Licensed in 20+ States"}</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-lg mb-4 lg:mb-6">{t.footer.services}</h3>
            <ul className="space-y-2 lg:space-y-3">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-gray-400 hover:text-white transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-lg mb-4 lg:mb-6">{t.footer.resources}</h3>
            <ul className="space-y-2 lg:space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-gray-400 hover:text-white transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-lg mb-4 lg:mb-6">{t.footer.company}</h3>
            <ul className="space-y-2 lg:space-y-3 mb-6">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-gray-400 hover:text-white transition-colors text-sm">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>

            {/* Social Links */}
            <div>
              <h4 className="font-medium mb-3">{t.footer.follow}</h4>
              <div className="flex space-x-3">
                <a
                  href="https://www.facebook.com/profile.php?id=100090015145006"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-transparent border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href="https://www.instagram.com/dorraiz.insurance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-transparent border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6 lg:my-8 bg-gray-800" />

        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="text-sm text-gray-400 text-center sm:text-left">
            © {currentYear} Dorraiz Insurance. {t.footer.rights}
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end space-x-4 lg:space-x-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">
              {t.footer.links.terms}
            </a>
            <a href="#" className="hover:text-white transition-colors">
              {t.footer.links.privacy}
            </a>
            <a href="#" className="hover:text-white transition-colors">
              {t.footer.links.disclaimer}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
