"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Phone, Mail, MapPin, Facebook, Twitter, Linkedin } from "lucide-react"

export function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    services: [
      { name: "ACA Health Insurance", href: "#services" },
      { name: "Medicare Plans", href: "#services" },
      { name: "Family Coverage", href: "#services" },
      { name: "Plan Comparison", href: "#services" },
    ],
    resources: [
      { name: "Insurance Guide", href: "#" },
      { name: "FAQ", href: "#" },
      { name: "Blog", href: "#" },
      { name: "State Regulations", href: "#" },
    ],
    company: [
      { name: "About", href: "#about" },
      { name: "Coverage Areas", href: "#states" },
      { name: "Contact", href: "#contact" },
      { name: "Privacy Policy", href: "#" },
    ],
  }

  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">IA</span>
              </div>
              <span className="font-bold text-xl">InsureAdvantage</span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Your trusted insurance partner specializing in ACA and Medicare coverage across 35+ states. Professional,
              personalized service you can count on.
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm">
                <Phone className="w-4 h-4 text-blue-400" />
                <span>(555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>info@insureadvantage.com</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Licensed in 35+ States</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-lg mb-6">Services</h3>
            <ul className="space-y-3">
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
            <h3 className="font-semibold text-lg mb-6">Resources</h3>
            <ul className="space-y-3">
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
            <h3 className="font-semibold text-lg mb-6">Company</h3>
            <ul className="space-y-3 mb-6">
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
              <h4 className="font-medium mb-3">Follow Us</h4>
              <div className="flex space-x-3">
                <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white">
                  <Facebook className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white">
                  <Twitter className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white">
                  <Linkedin className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-gray-800" />

        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-gray-400">© {currentYear} InsureAdvantage. All rights reserved.</div>
          <div className="flex space-x-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Disclaimer
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
