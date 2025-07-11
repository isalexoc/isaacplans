"use client";

import { Separator } from "@/components/ui/separator";
import { Phone, Mail, MapPin, Facebook, Instagram } from "lucide-react";
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
              <div className="flex flex-col leading-none">
                <span className="font-bold text-xl text-white leading-tight">
                  Isaac
                </span>
                <span className="-mt-1 text-xl font-bold text-custom leading-none">
                  Plans
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t.footer.description}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-green-400" />
                <span>(540) 681-3507</span>
              </div>
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
                href="https://www.facebook.com/profile.php?id=100090015145006"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="https://www.instagram.com/dorraiz.insurance"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white"
              >
                <Instagram className="w-4 h-4" />
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
