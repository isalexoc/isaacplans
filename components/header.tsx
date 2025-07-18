"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";
import { LanguageToggle } from "@/components/language-toggle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Headroom from "react-headroom";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuList,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import * as LucideIcons from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import Logo from "@/components/logo";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { language } = useLanguage();
  const t = translations[language];
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    if (!isHomePage && href.startsWith("#")) {
      window.location.href = "/" + href;
    }
  };

  return (
    <Headroom style={{ zIndex: 50 }}>
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Logo />

            {/* Desktop Navigation with Submenus */}
            <nav className="hidden md:flex items-center space-x-4">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      {t.header.nav.services.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-1 p-1 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                        {t.header.nav.services.links.map((component) => (
                          <ListItem
                            key={component.title}
                            title={component.title}
                            href={component.href}
                            icon={component.icon}
                            className="p-2"
                          >
                            {component.description}
                          </ListItem>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      {t.header.nav.resources.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-1 p-1 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                        {t.header.nav.resources.links.map((resource) => (
                          <ListItem
                            key={resource.title}
                            title={resource.title}
                            href={resource.href}
                            icon={resource.icon}
                            className="p-2"
                          >
                            {resource.description}
                          </ListItem>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      {t.header.nav.about.label}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid gap-1 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                        <li className="row-span-3">
                          <NavigationMenuLink asChild>
                            <Link
                              className="relative flex h-full w-full select-none flex-col justify-end rounded-md no-underline outline-none focus:shadow-md overflow-hidden group"
                              href="/about"
                            >
                              <Image
                                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1752843172/pexels-shkrabaanthony-5816299_1_zbd4hi.jpg"
                                alt="Isaac Plans Insurance"
                                layout="fill"
                                objectFit="cover"
                                className="absolute inset-0 z-0 transition-transform duration-300 group-hover:scale-105"
                              />
                              <div className="relative z-10 bg-black bg-opacity-50 p-6 w-full h-full flex flex-col justify-end">
                                <div className="mb-2 text-lg font-medium text-white">
                                  Isaac Plans Insurance
                                </div>
                                <p className="text-sm leading-tight text-gray-200">
                                  {t.header.nav.about.bio}
                                </p>
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                        {t.header.nav.about.links.map((item) => (
                          <ListItem
                            key={item.title}
                            href={item.href}
                            title={item.title}
                            icon={item.icon}
                          >
                            {item.description}
                          </ListItem>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <Link href="/testimonials" legacyBehavior passHref>
                      <NavigationMenuLink
                        className={navigationMenuTriggerStyle()}
                      >
                        {t.header.nav.contact.label}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
              <LanguageToggle />
            </nav>

            <div className="hidden lg:flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{t.header.phone}</span>
              </div>
              <Link href="/contact">
                <Button className="bg-custom text-custom-foreground hover:bg-custom/90">
                  {t.header.cta}
                </Button>
              </Link>
            </div>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent className="p-0">
                <div className="h-full flex flex-col">
                  {/* Scrollable content container */}
                  <div className="flex-1 overflow-y-auto px-4 pt-8">
                    <Accordion type="multiple" className="w-full space-y-2">
                      <Logo />

                      {/* Home */}
                      <Link
                        href="/"
                        onClick={() => {
                          handleNavClick("/");
                          setIsOpen(false);
                        }}
                        className="block pt-5 pb-3 py-1 hover:text-custom border-b"
                      >
                        {t.nav.home}
                      </Link>

                      {/* Services */}
                      <AccordionItem value="services">
                        <AccordionTrigger className="text-gray-700 font-medium">
                          {t.header.nav.services.label}
                        </AccordionTrigger>
                        <AccordionContent className="pl-4">
                          {t.header.nav.services.links.map((item) => (
                            <Link
                              key={item.title}
                              href={item.href}
                              onClick={() => {
                                handleNavClick(item.href);
                                setIsOpen(false);
                              }}
                              className="block py-1 text-sm text-muted-foreground hover:text-custom"
                            >
                              {item.title}
                            </Link>
                          ))}
                        </AccordionContent>
                      </AccordionItem>

                      {/* Resources */}
                      <AccordionItem value="resources">
                        <AccordionTrigger className="text-gray-700 font-medium">
                          {t.header.nav.resources.label}
                        </AccordionTrigger>
                        <AccordionContent className="pl-4">
                          {t.header.nav.resources.links.map((item) => (
                            <Link
                              key={item.title}
                              href={item.href}
                              onClick={() => {
                                handleNavClick(item.href);
                                setIsOpen(false);
                              }}
                              className="block py-1 text-sm text-muted-foreground hover:text-custom"
                            >
                              {item.title}
                            </Link>
                          ))}
                        </AccordionContent>
                      </AccordionItem>

                      {/* About */}
                      <AccordionItem value="about">
                        <AccordionTrigger className="text-gray-700 font-medium">
                          {t.header.nav.about.label}
                        </AccordionTrigger>
                        <AccordionContent className="pl-4">
                          {t.header.nav.about.links.map((item) => (
                            <Link
                              key={item.title}
                              href={item.href}
                              onClick={() => {
                                handleNavClick(item.href);
                                setIsOpen(false);
                              }}
                              className="block py-1 text-sm text-muted-foreground hover:text-custom"
                            >
                              {item.title}
                            </Link>
                          ))}
                        </AccordionContent>
                      </AccordionItem>

                      {/* Contact */}
                      <Link
                        href="/contact"
                        onClick={() => {
                          handleNavClick("/contact");
                          setIsOpen(false);
                        }}
                        className="block pt-4 pb-0 hover:text-custom"
                      >
                        {t.nav.contact}
                      </Link>
                    </Accordion>
                  </div>

                  {/* Sticky bottom contact info and CTA */}
                  <div className="border-t px-4 pt-4 pb-6 bg-white">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span>{t.header.phone}</span>
                      </div>
                      <LanguageToggle />
                    </div>
                    <Button
                      className="w-full bg-custom text-custom-foreground hover:bg-custom/90"
                      onClick={() => {
                        setIsOpen(false);
                        window.location.href = "/contact";
                      }}
                    >
                      {t.header.cta}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </Headroom>
  );
};

export default Header;

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { icon?: string }
>(({ className, title, icon, children, ...props }, ref) => {
  const IconComponent =
    icon && icon in LucideIcons
      ? (LucideIcons[icon as keyof typeof LucideIcons] as React.ComponentType<{
          className?: string;
        }>)
      : null;

  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "flex items-start space-x-3 select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          {IconComponent && (
            <IconComponent className="w-5 h-5 mt-1 text-custom/70 shrink-0" />
          )}
          <div className="space-y-1">
            <div className="text-sm font-medium leading-none">{title}</div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {children}
            </p>
          </div>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
