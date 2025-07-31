import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export type Locale = (typeof routing.locales)[number];

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ["en", "es"],

  // Used when no locale matches
  defaultLocale: "en",
  // The path to the locale segment in the URL
  pathnames: {
    "/": {
      en: "/",
      es: "/",
    },
    "/contact": {
      en: "/contact-me",
      es: "/contacto",
    },
    "/dental-vision": {
      en: "/dental-vision",
      es: "/dental-vision",
    },
    "/hospital-indemnity": {
      en: "/hospital-indemnity",
      es: "/indemnizacion-hospitalaria",
    },
    "/aca": {
      en: "/aca",
      es: "/aca",
    },
    "/about": {
      en: "/about",
      es: "/sobre-mi",
    },
    "/privacy-policy": {
      en: "/privacy-policy",
      es: "/politica-de-privacidad",
    },
    "/terms-of-service": {
      en: "/terms-of-service",
      es: "/terminos-y-condiciones",
    },
  },
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
