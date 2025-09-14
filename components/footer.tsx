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

      { name: tServices("cancer.title"), href: "" },
      { name: tServices("stroke.title"), href: "" },
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
    <footer className="bg-gray-900 text-white" aria-label="Footer">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Brand & contact */}
          <section aria-labelledby="footer-company" className="space-y-6">
            <h2 id="footer-company" className="sr-only">
              {SITE_NAME} {tFooter("company")}
            </h2>
            <LogoMark />
            <p className="text-gray-400 text-sm leading-relaxed">
              {tFooter("description")}
            </p>
            <ContactLines
              licensedStates={tContact("licensedStates")}
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
            <h3 id="footer-links" className="font-medium mb-3 mt-3">
              {tFooter("follow")}
            </h3>
            <SocialRow />
          </section>
        </div>

        <Separator className="my-8 bg-gray-800" />
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
  <Link href={"/"} className="flex items-center space-x-3">
    <Image
      src={LOGO_URL}
      alt="Isaac Plans Logo"
      width={40}
      height={40}
      className="object-cover rounded-md"
      loading="lazy"
    />
    <div className="flex flex-col items-center leading-none text-center">
      <span className="text-xl font-bold bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
        {SITE_NAME}
      </span>
      <span className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
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
      className="flex items-center space-x-2 hover:text-white"
    >
      <Icon className="w-4 h-4 text-teal-400" aria-hidden />
      <span>{text}</span>
    </a>
  ) : (
    <div className="flex items-center space-x-2">
      <Icon className="w-4 h-4 text-teal-400" aria-hidden />
      <span>{text}</span>
    </div>
  );

const WhatsAppLine = ({ label }: { label: string }) => (
  <a
    href={`https://wa.me/${WHATSAPP_E164}?text=Hola,%20quiero%20una%20cotización`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center space-x-2 hover:text-white"
  >
    <Image
      src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_24,h_24,c_fit/v1752687249/whatsapphappiness_lezt21_zsxlic.png"
      alt="WhatsApp"
      width={24}
      height={24}
      loading="lazy"
    />
    <span>
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
    <h3 className="text-lg font-semibold mb-4">{title}</h3>
    <ul className="space-y-2 text-sm text-gray-400">
      {links.map(({ name, href }) => (
        <li key={name}>
          <Link href={href as any} className="hover:text-white">
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
    <div className="flex space-x-3">
      {socials.map(({ href, Icon, label }) => (
        <Link
          key={href}
          href={href as any}
          aria-label={label}
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 border border-gray-600 hover:border-white rounded-md flex items-center justify-center text-gray-400 hover:text-white transition-transform hover:-translate-y-1"
        >
          <Icon className="w-4 h-4" aria-hidden />
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
  <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-400">
    <div className="text-center sm:text-left">
      © {year} {SITE_NAME}. {rights}
    </div>
    <div className="flex space-x-4 mt-4 sm:mt-0">
      <Link href={`/terms-of-service` as any} className="hover:text-white">
        {termsLabel}
      </Link>
      <Link href={`/privacy-policy` as any} className="hover:text-white">
        {privacyLabel}
      </Link>
    </div>
  </div>
);
