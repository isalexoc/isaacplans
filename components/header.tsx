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
] as const satisfies ReadonlyArray<{
  key: string;
  href: AppHref | "";
  icon: string;
}>;

const resourceLinks = [
  { key: "faq", href: "/faq", icon: "HelpCircle" },
  { key: "blog", href: "/blog", icon: "BookOpen" },
  { key: "testimonials", href: "/testimonials", icon: "MessageCircle" },
  { key: "consumerGuides", href: "/consumer-guides", icon: "FileText" },
  { key: "glossary", href: "/glossary", icon: "Landmark" },
  { key: "subsidyCalculator", href: "/subsidy-calculator", icon: "Calculator" },
  { key: "personalizedAssistance", href: "/contact", icon: "UserCheck" },
  { key: "planComparison", href: "/plan-comparison", icon: "GitCompareArrows" },
  { key: "newsletter", href: "", icon: "Mail" },
  { key: "renewalSupport", href: "/renewal-support", icon: "Repeat" },
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
      <header className="bg-white border-b border-gray-100 shadow-sm transition-shadow duration-300">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Logo />
            <div className="block md:hidden">
              <LocaleSwitcher />
            </div>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-2" aria-label="Main navigation">
              <NavigationMenu className="[&>div>div]:bg-white">
                <NavigationMenuList className="space-x-1">
                  {/* SERVICES ▸ */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="text-sm font-medium text-gray-700 hover:text-brand transition-colors duration-200 data-[state=open]:text-brand data-[active]:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 rounded-md px-3 py-2">
                      {nav("services.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="bg-white">
                      <ul className="grid gap-2 p-4 w-[400px] md:w-[500px] md:grid-cols-2 lg:w-[600px]">
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
                    <NavigationMenuTrigger className="text-sm font-medium text-gray-700 hover:text-brand transition-colors duration-200 data-[state=open]:text-brand data-[active]:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 rounded-md px-3 py-2">
                      {nav("resources.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="bg-white">
                      <ul className="grid gap-2 p-4 w-[400px] md:w-[500px] md:grid-cols-2 lg:w-[600px]">
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
                    <NavigationMenuTrigger className="text-sm font-medium text-gray-700 hover:text-brand transition-colors duration-200 data-[state=open]:text-brand data-[active]:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 rounded-md px-3 py-2">
                      {nav("about.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="bg-white">
                      <ul className="grid gap-2 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                        {/* promo tile */}
                        <li className="row-span-3">
                          <NavigationMenuLink asChild>
                            <Link
                              href="/about"
                              className="relative group flex h-full w-full flex-col justify-end overflow-hidden rounded-lg select-none shadow-sm hover:shadow-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
                              aria-label="Learn more about Isaac Plans Insurance"
                            >
                              <Image
                                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1752843172/pexels-shkrabaanthony-5816299_1_zbd4hi.jpg"
                                alt=""
                                fill
                                sizes="(max-width: 768px) 100vw, 400px"
                                className="object-cover transition-transform duration-500 group-hover:scale-110"
                                loading="lazy"
                              />
                              <div className="relative z-10 bg-gradient-to-t from-black/80 via-black/60 to-black/40 p-6 flex flex-col justify-end h-full">
                                <div className="text-lg font-semibold text-white mb-2 drop-shadow-lg">
                                  Isaac Plans Insurance
                                </div>
                                <p className="text-sm text-gray-100 leading-relaxed drop-shadow-md">
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
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "text-sm font-medium text-gray-700 hover:text-brand transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 rounded-md px-3 py-2"
                        )}
                      >
                        {nav("contact.label")}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>

              <div className="ml-2">
                <LocaleSwitcher />
              </div>
            </nav>

            {/* phone & CTA (desktop) */}
            <div className="hidden lg:flex items-center space-x-4 lg:space-x-6">
              <a
                href={`tel:${nav("phone")}`}
                className="hidden xl:flex items-center text-sm font-medium text-gray-700 hover:text-brand space-x-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 rounded-md px-2 py-1"
                aria-label={`Call us at ${nav("phone")}`}
              >
                <Lucide.Phone className="w-4 h-4" aria-hidden="true" />
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
        aria-label="Open main menu"
        className="hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 rounded-md transition-colors duration-200"
      >
        <Lucide.Menu className="w-6 h-6 text-gray-700" aria-hidden="true" />
      </Button>
    </SheetTrigger>

    <SheetContent className="p-0 w-[80%] sm:max-w-md overflow-hidden flex flex-col border-0 shadow-xl [&>button]:hidden">
      <div className="flex flex-col h-full bg-gradient-to-b from-white via-gray-50/30 to-white">
        {/* Header with logo */}
        <div className="px-6 pt-8 pb-6 border-b border-gray-200/60 bg-gradient-to-r from-white via-brand/5 to-accent/5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <Logo />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="rounded-full hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand/20 h-10 w-10"
              aria-label="Close menu"
            >
              <Lucide.X className="w-6 h-6 text-gray-700" />
            </Button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <div className="px-5 pt-6 pb-6">
            <Accordion type="multiple" className="space-y-2 w-full">
              <MobileLink
                label={nav("home")}
                href="/"
                handleNavClick={handleNavClick}
                setIsOpen={setIsOpen}
                icon="Home"
                className="flex items-center gap-3 py-3.5 px-4 rounded-xl text-base font-semibold text-gray-900 bg-white border border-gray-200/60 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:border-brand/30 hover:shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 mb-3"
              />

              {/* Services */}
              <AccordionItem value="services" className="border-0">
                <AccordionTrigger className="py-3.5 px-4 rounded-xl text-base font-semibold text-gray-900 bg-white border border-gray-200/60 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:border-brand/30 hover:shadow-sm transition-all duration-200 [&[data-state=open]]:text-brand [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-brand/10 [&[data-state=open]]:to-accent/10 [&[data-state=open]]:border-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2">
                  <div className="flex items-center gap-3">
                    <Lucide.Grid3x3 className="w-5 h-5 text-brand" />
                    <span>{nav("services.label")}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-2 pr-2 pt-3 pb-2">
                  <div className="space-y-1.5">
                    {serviceLinks.map(({ key, href, icon }) => (
                      <MobileLink
                        key={key}
                        label={nav(`services.links.${key}.title`)}
                        href={href}
                        handleNavClick={handleNavClick}
                        setIsOpen={setIsOpen}
                        icon={icon}
                        className="flex items-center gap-3 py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-gray-50/50 border border-transparent hover:bg-white hover:text-brand hover:border-brand/20 hover:shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Resources */}
              <AccordionItem value="resources" className="border-0">
                <AccordionTrigger className="py-3.5 px-4 rounded-xl text-base font-semibold text-gray-900 bg-white border border-gray-200/60 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:border-brand/30 hover:shadow-sm transition-all duration-200 [&[data-state=open]]:text-brand [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-brand/10 [&[data-state=open]]:to-accent/10 [&[data-state=open]]:border-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2">
                  <div className="flex items-center gap-3">
                    <Lucide.BookOpen className="w-5 h-5 text-brand" />
                    <span>{nav("resources.label")}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-2 pr-2 pt-3 pb-2">
                  <div className="space-y-1.5">
                    {resourceLinks.map(({ key, href, icon }) => (
                      <MobileLink
                        key={key}
                        label={nav(`resources.links.${key}.title`)}
                        href={href}
                        handleNavClick={handleNavClick}
                        setIsOpen={setIsOpen}
                        icon={icon}
                        className="flex items-center gap-3 py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-gray-50/50 border border-transparent hover:bg-white hover:text-brand hover:border-brand/20 hover:shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* About */}
              <AccordionItem value="about" className="border-0">
                <AccordionTrigger className="py-3.5 px-4 rounded-xl text-base font-semibold text-gray-900 bg-white border border-gray-200/60 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:border-brand/30 hover:shadow-sm transition-all duration-200 [&[data-state=open]]:text-brand [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-brand/10 [&[data-state=open]]:to-accent/10 [&[data-state=open]]:border-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2">
                  <div className="flex items-center gap-3">
                    <Lucide.Info className="w-5 h-5 text-brand" />
                    <span>{nav("about.label")}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-2 pr-2 pt-3 pb-2">
                  <div className="space-y-1.5">
                    {aboutLinks.map(({ key, href, icon }) => (
                      <MobileLink
                        key={key}
                        label={nav(`about.links.${key}.title`)}
                        href={href}
                        handleNavClick={handleNavClick}
                        setIsOpen={setIsOpen}
                        icon={icon}
                        className="flex items-center gap-3 py-2.5 px-4 rounded-lg text-sm font-medium text-gray-700 bg-gray-50/50 border border-transparent hover:bg-white hover:text-brand hover:border-brand/20 hover:shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2"
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <MobileLink
                label={nav("contact.label")}
                href="/contact"
                handleNavClick={handleNavClick}
                setIsOpen={setIsOpen}
                icon="Mail"
                className="flex items-center gap-3 py-3.5 px-4 rounded-xl text-base font-semibold text-gray-900 bg-white border border-gray-200/60 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:border-brand/30 hover:shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 mt-3"
              />
            </Accordion>
          </div>
        </div>

        {/* Sticky bottom */}
        <div className="border-t border-gray-200/60 bg-gradient-to-b from-white to-gray-50/50 backdrop-blur-sm px-6 pt-6 pb-6 space-y-4 shadow-[0_-8px_16px_-4px_rgba(0,0,0,0.08)]">
          <div className="flex justify-between items-center bg-white/80 rounded-xl p-4 border border-gray-200/60">
            <a
              href={`tel:${nav("phone")}`}
              className="flex items-center text-sm font-semibold text-gray-700 hover:text-brand space-x-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 rounded-lg px-2 py-1.5"
              aria-label={`Call us at ${nav("phone")}`}
            >
              <div className="p-1.5 rounded-lg bg-brand/10">
                <Lucide.Phone className="w-4 h-4 text-brand" aria-hidden="true" />
              </div>
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
  icon?: string;
};

const MobileLink = ({
  label,
  href,
  handleNavClick,
  setIsOpen,
  className = "",
  icon,
}: MobileLinkProps) => {
  const Icon =
    icon && icon in Lucide
      ? (Lucide[icon as keyof typeof Lucide] as React.FC<{
          className?: string;
        }>)
      : null;

  return href ? (
    <Link
      href={href as any}
      onClick={() => {
        handleNavClick(href);
        setIsOpen(false);
      }}
      className={cn(className)}
      aria-label={label}
    >
      {Icon && (
        <Icon className="w-4 h-4 text-brand shrink-0 transition-transform duration-200 group-hover:scale-110" />
      )}
      <span>{label}</span>
    </Link>
  ) : (
    <span 
      className={cn("flex items-center gap-3 text-muted-foreground cursor-not-allowed opacity-50", className)}
      aria-disabled="true"
    >
      {Icon && <Icon className="w-4 h-4 text-gray-400 shrink-0" />}
      <span>{label}</span>
    </span>
  );
};

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
          <NavigationMenuLink asChild>
            <Link
              href={href as any}
              ref={ref}
              className={cn(
                "group flex items-start space-x-3 rounded-lg p-3 select-none leading-none transition-all duration-200 bg-white hover:bg-gray-50 hover:shadow-md border border-transparent hover:border-gray-200 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 data-[highlighted]:bg-gray-50 nav-menu-item",
                className
              )}
              aria-label={title}
            >
              {Icon && (
                <Icon className="w-5 h-5 mt-0.5 text-brand shrink-0 transition-all duration-200 group-hover:text-brand group-hover:scale-110 group-focus-visible:text-brand" />
              )}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight text-gray-900 group-hover:text-gray-900 group-focus-visible:text-gray-900 transition-colors duration-200">
                  {title}
                </div>
                {children && (
                  <p className="line-clamp-2 text-xs text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-200">
                    {children}
                  </p>
                )}
              </div>
            </Link>
          </NavigationMenuLink>
        ) : (
          <div
            aria-disabled="true"
            className={cn(
              "flex items-start space-x-3 rounded-lg p-3 select-none leading-none cursor-not-allowed opacity-60 bg-gray-50",
              className
            )}
          >
            {Icon && <Icon className="w-5 h-5 mt-0.5 text-gray-400 shrink-0" />}
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight text-gray-500">
                {title}
              </div>
              {children && (
                <p className="line-clamp-2 text-xs text-gray-400 leading-relaxed">
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
