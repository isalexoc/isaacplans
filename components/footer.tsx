// components/Footer.tsx – server component (zero JS on client)

import {
  Phone as PhoneIcon,
  Mail as MailIcon,
  MapPin as MapPinIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  Youtube as YoutubeIcon,
  Linkedin as LinkedinIcon,
} from "lucide-react";

import Image from "next/image";
import { Link } from "@/i18n/navigation"; // locale‑aware wrappers
import { getTranslations } from "next-intl/server";
import { Separator } from "@/components/ui/separator";

/* ──────────────────────────────────────────────
   Site constants (could live in /lib/siteConfig)
────────────────────────────────────────────── */
const PHONE_RAW = "540-426-1804";
const WHATSAPP_E164 = "15406813507";
const EMAIL = "info@isaacplans.com";
const SITE_NAME = "Isaac Plans";
const LOGO_URL =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_40,h_40,c_fill,g_auto/isaacplanslogo_tkraak.png";

/* ──────────────────────────────────────────────
   Footer – rendered on the server only
────────────────────────────────────────────── */
export default async function Footer() {
  /* Translations */
  const tFooter = await getTranslations("footer");
  const tNav = await getTranslations("header.nav");
  const tServices = await getTranslations("header.nav.services.links");
  const tRes = await getTranslations("header.nav.resources.links");
  const tContact = await getTranslations("footer.contact");
  const states = process.env.NEXT_PUBLIC_STATES ?? "12";

  /* Root‑relative hash links let next‑intl inject the locale prefix */
  const toSection = (hash: string) => `/#${hash}`;

  const footerLinks = {
    services: [
      { name: tServices("aca.title"), href: "/aca" },
      {
        name: tServices("shortTermMedical.title"),
        href: "/short-term-medical",
      },
      { name: tServices("dentalVision.title"), href: "/dental-vision" },
      {
        name: tServices("hospitalIndemnity.title"),
        href: "/hospital-indemnity",
      },
      { name: tServices("life.title"), href: "/iul" },
      { name: tServices("finalExpense.title"), href: "/final-expense" },

      
    ],
    company: [
      { name: tNav("about.label"), href: "/about" },
      { name: tNav("services.label"), href: toSection("services") },
      { name: tNav("contact.label"), href: "/contact" },
      { name: tFooter("links.privacy"), href: "/privacy-policy" },
      { name: tFooter("links.terms"), href: "/terms-of-service" },
    ],
  } as const;

  const year = new Date().getFullYear();

  return (
    <footer
      className="relative bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-white overflow-hidden"
      aria-label="Footer"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-0 w-96 h-96 bg-[hsl(var(--custom)/0.1)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[hsl(var(--custom)/0.1)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 relative z-10">
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {/* Brand & contact */}
          <section aria-labelledby="footer-company" className="space-y-6">
            <h2 id="footer-company" className="sr-only">
              {SITE_NAME} {tFooter("company")}
            </h2>
            <LogoMark />
            <p className="text-gray-300 text-sm lg:text-base leading-relaxed">
              {tFooter("description", { states })}
            </p>
            <ContactLines
              licensedStates={tContact("licensedStates", { states })}
              whatsappLabel={tContact("whatsappLabel")}
            />
          </section>

          {/* Services */}
          <FooterColumn
            title={tFooter("services")}
            links={footerLinks.services}
          />

          {/* Company & social */}
          <section aria-labelledby="footer-links">
            <FooterColumn
              title={tFooter("company")}
              links={footerLinks.company}
            />
            <h3 id="footer-links" className="font-semibold text-lg mb-4 mt-8">
              {tFooter("follow")}
            </h3>
            {await SocialRow()}
          </section>
        </div>

        <Separator className="my-8 lg:my-12 bg-gray-800/60" />
        <BottomBar
          year={year}
          rights={tFooter("rights")}
          termsLabel={tFooter("links.terms")}
          privacyLabel={tFooter("links.privacy")}
        />
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────
   Stateless sub‑components
────────────────────────────────────────────── */
const LogoMark = () => (
  <Link
    href={"/"}
    className="flex items-center space-x-3 group hover:opacity-90 transition-opacity duration-300"
    aria-label="Go to homepage"
  >
    <div className="relative">
      <div
        className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.3)] to-transparent 
                   rounded-md blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
        aria-hidden="true"
      />
      <Image
        src={LOGO_URL}
        alt="Isaac Plans Logo"
        width={48}
        height={48}
        className="object-cover rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300"
        loading="lazy"
        fetchPriority="low"
      />
    </div>
    <div className="flex flex-col items-center leading-none text-center">
      <span className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.8)] bg-clip-text text-transparent">
        {SITE_NAME}
      </span>
      <span className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.8)] bg-clip-text text-transparent">
        Insurance
      </span>
    </div>
  </Link>
);

interface ContactProps {
  licensedStates: string;
  whatsappLabel: string;
}
const ContactLines = ({ licensedStates, whatsappLabel }: ContactProps) => (
  <address className="not-italic space-y-2 text-sm">
    <Line
      icon={PhoneIcon}
      href={`tel:${PHONE_RAW.replace(/[^0-9]/g, "")}`}
      text={PHONE_RAW}
    />
    <Line icon={MapPinIcon} text={licensedStates} />
    <Line icon={MailIcon} href={`mailto:${EMAIL}`} text={EMAIL} />
    <WhatsAppLine label={whatsappLabel} />
  </address>
);

interface LineProps {
  icon: React.ElementType;
  text: string;
  href?: string;
}
const Line = ({ icon: Icon, text, href }: LineProps) =>
  href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center space-x-3 text-gray-300 hover:text-white 
                 transition-colors duration-200 group"
      aria-label={text}
    >
      <div className="p-1.5 rounded-md bg-[hsl(var(--custom)/0.15)] group-hover:bg-[hsl(var(--custom)/0.25)] transition-colors duration-200">
        <Icon className="w-4 h-4 text-[hsl(var(--custom))]" aria-hidden />
      </div>
      <span className="text-sm lg:text-base">{text}</span>
    </a>
  ) : (
    <div className="flex items-center space-x-3 text-gray-300">
      <div className="p-1.5 rounded-md bg-[hsl(var(--custom)/0.15)]">
        <Icon className="w-4 h-4 text-[hsl(var(--custom))]" aria-hidden />
      </div>
      <span className="text-sm lg:text-base">{text}</span>
    </div>
  );

const WhatsAppLine = ({ label }: { label: string }) => (
  <a
    href={`https://wa.me/${WHATSAPP_E164}?text=Hola,%20quiero%20una%20cotización`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center space-x-3 text-gray-300 hover:text-white 
               transition-colors duration-200 group"
    aria-label={`${label}: ${PHONE_RAW} (opens in new tab)`}
  >
    <div className="p-1.5 rounded-md bg-[hsl(var(--custom)/0.15)] group-hover:bg-[hsl(var(--custom)/0.25)] transition-colors duration-200">
      <Image
        src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_24,h_24,c_fit/v1752687249/whatsapphappiness_lezt21_zsxlic.png"
        alt="WhatsApp"
        width={20}
        height={20}
        loading="lazy"
        className="object-contain"
      />
    </div>
    <span className="text-sm lg:text-base">
      {label}: {PHONE_RAW}
    </span>
  </a>
);

interface FooterColumnProps {
  title: string;
  links: ReadonlyArray<{ name: string; href: string }>;
}
const FooterColumn = ({ title, links }: FooterColumnProps) => (
  <nav aria-label={title} className="mt-8 md:mt-0">
    <h3 className="text-lg lg:text-xl font-semibold mb-6 text-white">{title}</h3>
    <ul className="space-y-3 text-sm lg:text-base" role="list">
      {links.map(({ name, href }) => (
        <li key={name} role="listitem">
          <Link
            href={href as any}
            className="text-gray-300 hover:text-white hover:translate-x-1 
                       inline-block transition-all duration-200"
          >
            {name}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

/* Social icons */
const SocialRow = async () => {
  const social = await getTranslations("social");
  const sm = {
    facebook: social("facebook"),
    instagram: social("instagram"),
    youtube: social("youtube"),
    linkedin: social("linkedin"),
  };

  const socials = [
    {
      href: sm.facebook,
      Icon: FacebookIcon,
      label: "Facebook",
    },
    {
      href: sm.instagram,
      Icon: InstagramIcon,
      label: "Instagram",
    },
    {
      href: sm.youtube,
      Icon: YoutubeIcon,
      label: "YouTube",
    },
    {
      href: sm.linkedin,
      Icon: LinkedinIcon,
      label: "LinkedIn",
    },
  ];
  return (
    <div className="flex space-x-3" role="list" aria-label="Social media links">
      {socials.map(({ href, Icon, label }) => (
        <Link
          key={href}
          href={href as any}
          aria-label={`${label} (opens in new tab)`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-11 h-11 border-2 border-gray-700 hover:border-[hsl(var(--custom))] 
                     rounded-lg flex items-center justify-center 
                     text-gray-400 hover:text-white bg-gray-800/50 hover:bg-[hsl(var(--custom))/0.2]
                     transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[hsl(var(--custom))/0.3]
                     focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          role="listitem"
        >
          <Icon className="w-5 h-5" aria-hidden />
        </Link>
      ))}
    </div>
  );
};

interface BottomBarProps {
  year: number;
  rights: string;
  termsLabel: string;
  privacyLabel: string;
}
const BottomBar = ({
  year,
  rights,
  termsLabel,
  privacyLabel,
}: BottomBarProps) => (
  <div className="flex flex-col sm:flex-row justify-between items-center text-sm lg:text-base text-gray-400">
    <div className="text-center sm:text-left">
      © {year} {SITE_NAME}. {rights}
    </div>
    <nav
      className="flex space-x-6 mt-4 sm:mt-0"
      aria-label="Legal links"
      role="list"
    >
      <Link
        href={`/terms-of-service` as any}
        className="text-gray-400 hover:text-white transition-colors duration-200"
        role="listitem"
      >
        {termsLabel}
      </Link>
      <Link
        href={`/privacy-policy` as any}
        className="text-gray-400 hover:text-white transition-colors duration-200"
        role="listitem"
      >
        {privacyLabel}
      </Link>
    </nav>
  </div>
);
