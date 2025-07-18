"use client";

import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { usePathname } from "next/navigation";
import { translations } from "@/lib/translations";
import Image from "next/image";
import Link from "next/link";

export function Footer() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const t = translations[language];
  const currentYear = new Date().getFullYear();
  const isHomePage = pathname === "/";

  const footerLinks = {
    services: [
      {
        name: t.services.items.aca.title,
        href: isHomePage ? "#services" : "/#services",
      },
      {
        name: t.services.items.medicare.title,
        href: isHomePage ? "#services" : "/#services",
      },
      {
        name: t.services.items.family.title,
        href: isHomePage ? "#services" : "/#services",
      },
      {
        name: t.services.items.comparison.title,
        href: isHomePage ? "#services" : "/#services",
      },
    ],
    company: [
      { name: t.nav.about, href: isHomePage ? "#about" : "/#about" },
      { name: t.nav.coverage, href: isHomePage ? "#coverage" : "/#coverage" },
      { name: t.nav.contact, href: "/contact" },
      { name: t.footer.links.privacy, href: "/privacy-policy" },
      { name: t.footer.links.terms, href: "/terms-of-service" },
    ],
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Column 1: Company Info */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_40,h_40,c_fill,g_auto/isaacplanslogo_tkraak.png"
                alt="Isaac Plans Logo"
                width={40}
                height={40}
                className="object-cover rounded-md"
              />
              <div className="flex flex-col items-center text-center leading-none">
                <span className="text-xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                  Isaac Plans
                </span>
                <span className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                  Insurance
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t.footer.description}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-green-400" />
                <span>{process.env.NEXT_PUBLIC_PHONE_NUMBER}</span>
              </div>
              <a
                href="https://wa.me/15406813507?text=Hola,%20quiero%20una%20cotización"
                target="_blank"
                rel="noopener noreferrer"
                className=" text-white py-2  flex items-center"
              >
                <img
                  src="https://res.cloudinary.com/isaacdev/image/upload/w_30,h_30,c_fit,f_auto,q_auto/v1752687249/whatsapphappiness_lezt21_zsxlic.png"
                  alt="WhatsApp"
                  className="w-7 h-7"
                />
                <span> WhatsApp: 540-681-3507</span>
              </a>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-green-400" />
                <span>info@isaacplans.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-green-400" />
                <span>
                  {language === "es"
                    ? "Licenciado en 9+ Estados"
                    : "Licensed in 9+ States"}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Services */}
          <div>
            <h4 className="text-lg font-semibold mb-4">{t.footer.services}</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="hover:text-white">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Company and Social */}
          <div>
            <h4 className="text-lg font-semibold mb-4">{t.footer.company}</h4>
            <ul className="space-y-2 text-sm text-gray-400 mb-6">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="hover:text-white">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
            <h5 className="font-medium mb-3">{t.footer.follow}</h5>
            <div className="flex space-x-3">
              <a
                href="https://www.facebook.com/@isaacagent"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="https://www.instagram.com/isalexoc"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://www.youtube.com/@isaacplans"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com/in/isaacplans"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-gray-800" />

        <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-400">
          <div className="text-center sm:text-left">
            © {currentYear} Isaac Plans. {t.footer.rights}
          </div>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            <Link href="/terms-of-service" className="hover:text-white">
              {t.footer.links.terms}
            </Link>
            <Link href="/privacy-policy" className="hover:text-white">
              {t.footer.links.privacy}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
