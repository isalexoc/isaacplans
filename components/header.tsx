"use client";

import React, { useState } from "react";
import Image from "next/image";
import Headroom from "react-headroom";
import { useTranslations } from "next-intl";
import * as Lucide from "lucide-react";
import CTAButtonMain from "@/components/cta-button-main";

import { Link } from "@/i18n/navigation"; // ✅ typed Link / AppHref
import type { AppHref } from "@/i18n/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuList,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

import Logo from "@/components/logo";
import LocaleSwitcher from "./LocaleSwitcher";

/* ────────────────────────────────────────────────────────────
   Link tables (single source of truth)
────────────────────────────────────────────────────────────── */

const serviceLinks = [
  { key: "aca", href: "/aca", icon: "Stethoscope" },
  { key: "shortTermMedical", href: "/short-term-medical", icon: "Activity" },
  { key: "dentalVision", href: "/dental-vision", icon: "Eye" },
  { key: "hospitalIndemnity", href: "/hospital-indemnity", icon: "Hospital" },
  { key: "life", href: "/iul", icon: "HeartPulse" },
  { key: "finalExpense", href: "/gastos-finales", icon: "Shield" },
  { key: "cancer", href: "", icon: "Radiation" },
  { key: "stroke", href: "", icon: "Activity" },
] as const satisfies ReadonlyArray<{
  key: string;
  href: AppHref | "";
  icon: string;
}>;

const resourceLinks = [
  { key: "faq", href: "", icon: "HelpCircle" },
  { key: "blog", href: "", icon: "BookOpen" },
  { key: "testimonials", href: "", icon: "MessageCircle" },
  { key: "consumerGuides", href: "", icon: "FileText" },
  { key: "coverageOptions", href: "", icon: "ShieldCheck" },
  { key: "glossary", href: "", icon: "Landmark" },
  { key: "videos", href: "", icon: "Film" },
  { key: "subsidyCalculator", href: "", icon: "Calculator" },
  { key: "personalizedAssistance", href: "", icon: "UserCheck" },
  { key: "downloads", href: "", icon: "Download" },
  { key: "planComparison", href: "", icon: "GitCompareArrows" },
  { key: "newsletter", href: "", icon: "Mail" },
  { key: "eligibilityTools", href: "", icon: "SearchCheck" },
  { key: "successStories", href: "", icon: "Smile" },
  { key: "renewalSupport", href: "", icon: "Repeat" },
  { key: "newUserGuides", href: "", icon: "Compass" },
  { key: "savingTips", href: "", icon: "PiggyBank" },
  { key: "familySupport", href: "", icon: "Users" },
  { key: "studentCoverage", href: "", icon: "BookUser" },
  { key: "workplaceProtection", href: "", icon: "Briefcase" },
  { key: "regulatoryUpdates", href: "", icon: "Gavel" },
  { key: "immigrantInfo", href: "", icon: "Globe2" },
  { key: "claimsGuide", href: "", icon: "FileCheck2" },
] as const satisfies ReadonlyArray<{
  key: string;
  href: AppHref | "";
  icon: string;
}>;

const aboutLinks = [
  { key: "missionVision", href: "/about#missionVision", icon: "FileCheck2" },
  { key: "whyChooseUs", href: "/about#whyChooseUs", icon: "ThumbsUp" },
  { key: "meetFounder", href: "/about#meetFounder", icon: "UserCheck" },
  { key: "contactSupport", href: "/about#contactSupport", icon: "PhoneCall" },
] as const satisfies ReadonlyArray<{
  key: string;
  href: AppHref | "";
  icon: string;
}>;

/* helper – lets us pass '' to disabled anchors while keeping types happy */
const asHref = (href: AppHref) => href;

/* ────────────────────────────────────────────────────────────
   Header component
────────────────────────────────────────────────────────────── */

const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [isOpen, setIsOpen] = useState(false);
  const nav = useTranslations("header.nav");

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    if (!isHomePage && href.startsWith("#")) {
      // internal section on a different page ⇒ jump to “/#section”
      router.push(("/" + href) as any);
    } else {
      router.push(href as any);
    }
  };

  return (
    <Headroom style={{ zIndex: 50 }}>
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Logo />
            <div className="block md:hidden">
              <LocaleSwitcher />
            </div>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center space-x-4">
              <NavigationMenu>
                <NavigationMenuList>
                  {/* SERVICES ▸ */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      {nav("services.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid gap-1 p-1 w-[400px] md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                        {serviceLinks.map(({ key, href, icon }) => (
                          <ListItem
                            key={key}
                            href={href as AppHref}
                            icon={icon}
                            title={nav(`services.links.${key}.title`)}
                            ariaDisabled={!href}
                          >
                            {nav(`services.links.${key}.description`)}
                          </ListItem>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* RESOURCES ▸ */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      {nav("resources.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid gap-1 p-1 w-[400px] md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                        {resourceLinks.map(({ key, href, icon }) => (
                          <ListItem
                            key={key}
                            href={href as AppHref}
                            icon={icon}
                            title={nav(`resources.links.${key}.title`)}
                            ariaDisabled={!href}
                          >
                            {nav(`resources.links.${key}.description`)}
                          </ListItem>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* ABOUT ▸ */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      {nav("about.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid gap-1 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                        {/* promo tile */}
                        <li className="row-span-3">
                          <NavigationMenuLink asChild>
                            <Link
                              href="/about"
                              className="relative group flex h-full w-full flex-col justify-end overflow-hidden rounded-md select-none"
                            >
                              <Image
                                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1752843172/pexels-shkrabaanthony-5816299_1_zbd4hi.jpg"
                                alt=""
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                              <div className="relative z-10 bg-black/60 p-6 flex flex-col justify-end h-full">
                                <div className="text-lg font-medium text-white mb-2">
                                  Isaac Plans Insurance
                                </div>
                                <p className="text-sm text-gray-200 leading-tight">
                                  {nav("about.bio")}
                                </p>
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>

                        {aboutLinks.map(({ key, href, icon }) => (
                          <ListItem
                            key={key}
                            href={href as AppHref}
                            icon={icon}
                            title={nav(`about.links.${key}.title`)}
                            ariaDisabled={!href}
                          >
                            {nav(`about.links.${key}.description`)}
                          </ListItem>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* CONTACT */}
                  <NavigationMenuItem>
                    <Link href="/contact" legacyBehavior passHref>
                      <NavigationMenuLink
                        className={navigationMenuTriggerStyle()}
                      >
                        {nav("contact.label")}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>

              <LocaleSwitcher />
            </nav>

            {/* phone & CTA (desktop) */}
            <div className="hidden lg:flex items-center space-x-4">
              <a
                href={`tel:${nav("phone")}`}
                className="hidden xl:flex items-center text-sm text-gray-700 space-x-2"
              >
                <Lucide.Phone className="w-4 h-4" />
                <span>{nav("phone")}</span>
              </a>
              {/* CTA island (client) */}
              <div className="animate-fadeLeft-d4">
                <CTAButtonMain />
              </div>
            </div>

            {/* Mobile sheet */}
            <MobileSheet
              isOpen={isOpen}
              setIsOpen={setIsOpen}
              handleNavClick={handleNavClick}
              nav={nav}
            />
          </div>
        </div>
      </header>
    </Headroom>
  );
};

export default Header;

/* ───────────────────────── Mobile sheet ───────────────────────── */

type MobileSheetProps = {
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
  handleNavClick: (href: string) => void;
  nav: ReturnType<typeof useTranslations>;
};

const MobileSheet = ({
  isOpen,
  setIsOpen,
  handleNavClick,
  nav,
}: MobileSheetProps) => (
  <Sheet open={isOpen} onOpenChange={setIsOpen}>
    <SheetTrigger asChild className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open main menu" // ① screen-reader label
      >
        <Lucide.Menu className="w-6 h-6" aria-hidden="true" />{" "}
        {/* ② hide icon name */}
      </Button>
    </SheetTrigger>

    <SheetContent className="p-0">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-4 pt-8">
          <Accordion type="multiple" className="space-y-2 w-full">
            <Logo />

            <MobileLink
              label={nav("home")}
              href="/"
              handleNavClick={handleNavClick}
              setIsOpen={setIsOpen}
              className="pt-5 pb-3 border-b"
            />

            {/* Services */}
            <AccordionItem value="services">
              <AccordionTrigger>{nav("services.label")}</AccordionTrigger>
              <AccordionContent className="pl-4">
                {serviceLinks.map(({ key, href }) => (
                  <MobileLink
                    key={key}
                    label={nav(`services.links.${key}.title`)}
                    href={href}
                    handleNavClick={handleNavClick}
                    setIsOpen={setIsOpen}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* Resources */}
            <AccordionItem value="resources">
              <AccordionTrigger>{nav("resources.label")}</AccordionTrigger>
              <AccordionContent className="pl-4">
                {resourceLinks.map(({ key, href }) => (
                  <MobileLink
                    key={key}
                    label={nav(`resources.links.${key}.title`)}
                    href={href}
                    handleNavClick={handleNavClick}
                    setIsOpen={setIsOpen}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* About */}
            <AccordionItem value="about">
              <AccordionTrigger>{nav("about.label")}</AccordionTrigger>
              <AccordionContent className="pl-4">
                {aboutLinks.map(({ key, href }) => (
                  <MobileLink
                    key={key}
                    label={nav(`about.links.${key}.title`)}
                    href={href}
                    handleNavClick={handleNavClick}
                    setIsOpen={setIsOpen}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>

            <MobileLink
              label={nav("contact.label")}
              href="/contact"
              handleNavClick={handleNavClick}
              setIsOpen={setIsOpen}
              className="pt-4"
            />
          </Accordion>
        </div>

        {/* sticky bottom */}
        <div className="border-t bg-white px-4 pt-4 pb-6">
          <div className="flex justify-between items-center mb-4">
            <a
              href={`tel:${nav("phone")}`}
              className="flex items-center text-sm text-gray-700 space-x-2"
            >
              <Lucide.Phone className="w-4 h-4" />
              <span>{nav("phone")}</span>
            </a>
            <LocaleSwitcher />
          </div>
          {/* CTA island (client) */}
          <div className="animate-fadeLeft-d4">
            <CTAButtonMain />
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
);

/* ───────────────────────── helpers ───────────────────────── */

type MobileLinkProps = {
  label: string;
  href: AppHref | "";
  handleNavClick: (h: string) => void;
  setIsOpen: (o: boolean) => void;
  className?: string;
};

const MobileLink = ({
  label,
  href,
  handleNavClick,
  setIsOpen,
  className = "",
}: MobileLinkProps) =>
  href ? (
    <Link
      href={href as any}
      onClick={() => {
        handleNavClick(href);
        setIsOpen(false);
      }}
      className={cn("block py-1 ...", className)}
    >
      {label}
    </Link>
  ) : (
    <span className="block py-1 text-muted-foreground cursor-not-allowed opacity-50">
      {label}
    </span>
  );

type ListItemProps = {
  title: string;
  icon?: string;
  href: AppHref | "";
  ariaDisabled?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const ListItem = React.forwardRef<React.ElementRef<"a">, ListItemProps>(
  ({ title, icon, href, ariaDisabled, className, children }, ref) => {
    const Icon =
      icon && icon in Lucide
        ? (Lucide[icon as keyof typeof Lucide] as React.FC<{
            className?: string;
          }>)
        : null;

    return (
      <li>
        {/* if the item has a real URL render a typed Link, otherwise show a disabled tile */}
        {href ? (
          <Link href={href as any} legacyBehavior passHref>
            <NavigationMenuLink
              asChild
              ref={ref}
              className={cn(
                "flex items-start space-x-3 rounded-md p-3 select-none leading-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                className
              )}
            >
              <a>
                {Icon && <Icon className="w-5 h-5 mt-1 text-custom shrink-0" />}
                <div className="space-y-1">
                  <div className="text-sm font-medium leading-none">
                    {title}
                  </div>
                  {children && (
                    <p className="line-clamp-2 text-sm text-muted-foreground leading-snug">
                      {children}
                    </p>
                  )}
                </div>
              </a>
            </NavigationMenuLink>
          </Link>
        ) : (
          <div
            aria-disabled
            className={cn(
              "flex items-start space-x-3 rounded-md p-3 select-none leading-none cursor-not-allowed opacity-50",
              className
            )}
          >
            {Icon && <Icon className="w-5 h-5 mt-1 text-custom shrink-0" />}
            <div className="space-y-1">
              <div className="text-sm font-medium leading-none">{title}</div>
              {children && (
                <p className="line-clamp-2 text-sm text-muted-foreground leading-snug">
                  {children}
                </p>
              )}
            </div>
          </div>
        )}
      </li>
    );
  }
);
ListItem.displayName = "ListItem";
