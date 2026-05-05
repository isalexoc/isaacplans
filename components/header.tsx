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
import { isAdsLandingPath } from "@/lib/ads-landing";
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
import { ThemeSwitcher } from "@/components/theme-switcher";

/* ────────────────────────────────────────────────────────────
   Link tables (single source of truth)
────────────────────────────────────────────────────────────── */

const serviceLinks = [
  { key: "aca", href: "/aca", icon: "Stethoscope" },
  { key: "getCoveredFast", href: "/get-covered-fast", icon: "Zap" },
  { key: "shortTermMedical", href: "/short-term-medical", icon: "Activity" },
  { key: "dentalVision", href: "/dental-vision", icon: "Eye" },
  { key: "hospitalIndemnity", href: "/hospital-indemnity", icon: "Hospital" },
  { key: "life", href: "/iul", icon: "HeartPulse" },
  { key: "finalExpense", href: "/gastos-finales", icon: "Shield" },
  { key: "carriers", href: "/carriers", icon: "Building2" },
] as const satisfies ReadonlyArray<{
  key: string;
  href: AppHref | "";
  icon: string;
}>;

const resourceLinks = [
  { key: "bookAppointment", href: "/book-appointment", icon: "CalendarDays" },
  { key: "faq", href: "/faq", icon: "HelpCircle" },
  { key: "blog", href: "/blog", icon: "BookOpen" },
  { key: "testimonials", href: "/testimonials", icon: "MessageCircle" },
  { key: "consumerGuides", href: "/consumer-guides", icon: "FileText" },
  { key: "glossary", href: "/glossary", icon: "Landmark" },
  { key: "subsidyCalculator", href: "/subsidy-calculator", icon: "Calculator" },
  { key: "personalizedAssistance", href: "/contact", icon: "UserCheck" },
  { key: "planComparison", href: "/plan-comparison", icon: "GitCompareArrows" },
  { key: "newsletter", href: "/newsletter", icon: "Mail" },
  { key: "renewalSupport", href: "/renewal-support", icon: "Repeat" },
  { key: "carriers", href: "/carriers", icon: "Building2" },
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

  /** Paid ads landing: logo + phone + locale only (no nav / quote CTA). */
  if (isAdsLandingPath(pathname)) {
    return (
      <Headroom style={{ zIndex: 50 }}>
        <header className="border-b border-border bg-background/95 backdrop-blur-sm shadow-sm transition-shadow duration-300 supports-[backdrop-filter]:bg-background/80">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="flex h-16 items-center justify-between md:h-20">
              <Logo />
              <div className="flex items-center gap-2 sm:gap-4">
                <a
                  href={`tel:${nav("phone")}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground/90 transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={`Call us at ${nav("phone")}`}
                >
                  <Lucide.Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">{nav("phone")}</span>
                </a>
                <ThemeSwitcher />
                <LocaleSwitcher />
              </div>
            </div>
          </div>
        </header>
      </Headroom>
    );
  }

  return (
    <Headroom style={{ zIndex: 50 }}>
      <header className="border-b border-border bg-background/95 backdrop-blur-sm shadow-sm transition-shadow duration-300 supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Logo />
            <div className="flex items-center gap-0.5 md:hidden">
              <ThemeSwitcher />
              <LocaleSwitcher />
            </div>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-2" aria-label="Main navigation">
              <NavigationMenu>
                <NavigationMenuList className="space-x-1">
                  {/* SERVICES ▸ */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="rounded-md px-3 py-2 text-sm font-medium text-foreground/90 transition-colors duration-200 hover:text-foreground data-[active]:text-foreground data-[state=open]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                      {nav("services.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="bg-popover text-popover-foreground">
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
                    <NavigationMenuTrigger className="rounded-md px-3 py-2 text-sm font-medium text-foreground/90 transition-colors duration-200 hover:text-foreground data-[active]:text-foreground data-[state=open]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                      {nav("resources.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="bg-popover text-popover-foreground">
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
                    <NavigationMenuTrigger className="rounded-md px-3 py-2 text-sm font-medium text-foreground/90 transition-colors duration-200 hover:text-foreground data-[active]:text-foreground data-[state=open]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                      {nav("about.label")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="bg-popover text-popover-foreground">
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
                    <NavigationMenuLink asChild>
                      <Link
                        href="/contact"
                        className={cn(
                          navigationMenuTriggerStyle(),
                          "rounded-md px-3 py-2 text-sm font-medium text-foreground/90 transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        )}
                      >
                        {nav("contact.label")}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>

              <div className="ml-2 flex items-center gap-0.5">
                <ThemeSwitcher />
                <LocaleSwitcher />
              </div>
            </nav>

            {/* phone & CTA (desktop) */}
            <div className="hidden lg:flex items-center space-x-4 lg:space-x-6">
              <a
                href={`tel:${nav("phone")}`}
                className="hidden rounded-md px-2 py-1 text-sm font-medium text-foreground/90 transition-colors duration-200 hover:bg-muted hover:text-foreground xl:flex xl:items-center xl:space-x-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
        className="rounded-md transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Lucide.Menu className="w-6 h-6 text-foreground" aria-hidden="true" />
      </Button>
    </SheetTrigger>

    <SheetContent className="flex w-[80%] flex-col overflow-hidden border-border bg-background p-0 shadow-xl sm:max-w-md [&>button]:hidden">
      <div className="flex h-full flex-col bg-gradient-to-b from-background via-muted/40 to-background">
        {/* Header with logo */}
        <div className="border-b border-border bg-gradient-to-r from-background via-brand/5 to-accent/10 px-6 pb-6 pt-8 backdrop-blur-sm dark:via-brand/10">
          <div className="flex items-center justify-between">
            <Logo />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-10 w-10 rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-background"
              aria-label="Close menu"
            >
              <Lucide.X className="w-6 h-6 text-foreground" />
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
                className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-base font-semibold text-card-foreground transition-all duration-200 hover:border-brand/40 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />

              {/* Services */}
              <AccordionItem value="services" className="border-0">
                <AccordionTrigger className="rounded-xl border border-border bg-card px-4 py-3.5 text-base font-semibold text-card-foreground transition-all duration-200 hover:border-brand/40 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&[data-state=open]]:border-brand/40 [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-brand/10 [&[data-state=open]]:to-accent/10 [&[data-state=open]]:text-brand">
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
                        className="flex items-center gap-3 rounded-lg border border-transparent bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground/90 transition-all duration-200 hover:border-brand/25 hover:bg-card hover:text-brand hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Resources */}
              <AccordionItem value="resources" className="border-0">
                <AccordionTrigger className="rounded-xl border border-border bg-card px-4 py-3.5 text-base font-semibold text-card-foreground transition-all duration-200 hover:border-brand/40 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&[data-state=open]]:border-brand/40 [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-brand/10 [&[data-state=open]]:to-accent/10 [&[data-state=open]]:text-brand">
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
                        className="flex items-center gap-3 rounded-lg border border-transparent bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground/90 transition-all duration-200 hover:border-brand/25 hover:bg-card hover:text-brand hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* About */}
              <AccordionItem value="about" className="border-0">
                <AccordionTrigger className="rounded-xl border border-border bg-card px-4 py-3.5 text-base font-semibold text-card-foreground transition-all duration-200 hover:border-brand/40 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&[data-state=open]]:border-brand/40 [&[data-state=open]]:bg-gradient-to-r [&[data-state=open]]:from-brand/10 [&[data-state=open]]:to-accent/10 [&[data-state=open]]:text-brand">
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
                        className="flex items-center gap-3 rounded-lg border border-transparent bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground/90 transition-all duration-200 hover:border-brand/25 hover:bg-card hover:text-brand hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-base font-semibold text-card-foreground transition-all duration-200 hover:border-brand/40 hover:bg-gradient-to-r hover:from-brand/10 hover:to-accent/10 hover:text-brand hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </Accordion>
          </div>
        </div>

        {/* Sticky bottom */}
        <div className="space-y-4 border-t border-border bg-gradient-to-b from-background to-muted/30 px-6 pb-6 pt-6 shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm dark:shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/95 p-4 backdrop-blur-sm">
            <a
              href={`tel:${nav("phone")}`}
              className="flex items-center space-x-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-foreground/90 transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Call us at ${nav("phone")}`}
            >
              <div className="rounded-lg bg-brand/10 p-1.5 dark:bg-brand/20">
                <Lucide.Phone className="h-4 w-4 text-brand" aria-hidden="true" />
              </div>
              <span>{nav("phone")}</span>
            </a>
            <div className="flex items-center gap-0.5">
              <ThemeSwitcher />
              <LocaleSwitcher />
            </div>
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
                "nav-menu-item group flex select-none items-start space-x-3 rounded-lg border border-transparent bg-popover p-3 leading-none outline-none transition-all duration-200 hover:border-border hover:bg-muted hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[highlighted]:bg-muted data-[highlighted]:shadow-sm",
                className
              )}
              aria-label={title}
            >
              {Icon && (
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--custom))] transition-transform duration-200 group-hover:scale-105 group-data-[highlighted]:scale-105" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="text-sm font-semibold leading-tight text-foreground transition-colors duration-200 group-hover:text-foreground group-data-[highlighted]:text-foreground">
                  {title}
                </div>
                {children && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground transition-colors duration-200 group-hover:text-foreground/80 group-data-[highlighted]:text-foreground/80 dark:group-hover:text-gray-300 dark:group-data-[highlighted]:text-gray-300">
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
              "flex cursor-not-allowed select-none items-start space-x-3 rounded-lg bg-muted/60 p-3 leading-none opacity-60",
              className
            )}
          >
            {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="text-sm font-semibold leading-tight text-muted-foreground">
                {title}
              </div>
              {children && (
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
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
