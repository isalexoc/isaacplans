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
    "/dental-vision/calendar": {
      en: "/dental-vision/calendar",
      es: "/dental-vision/calendario",
    },
    "/hospital-indemnity": {
      en: "/hospital-indemnity",
      es: "/indemnizacion-hospitalaria",
    },
    "/hospital-indemnity/calendar": {
      en: "/hospital-indemnity/calendar",
      es: "/indemnizacion-hospitalaria/calendario",
    },
    "/aca": {
      en: "/aca",
      es: "/aca",
    },
    "/aca/calendar": {
      en: "/aca/calendar",
      es: "/aca/calendario",
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
    "/carriers/uhone/shortterm": {
      en: "/carriers/uhone/shortterm",
      es: "/carriers/uhone/shortterm",
    },
    "/short-term-medical": {
      en: "/short-term-medical",
      es: "/cobertura-a-corto-plazo",
    },
    "/iul": {
      en: "/iul",
      es: "/iul",
    },
    "/iul/calendar": {
      en: "/iul/calendar",
      es: "/iul/calendario",
    },
    "/final-expense": {
      en: "/final-expense",
      es: "/gastos-finales",
    },
    "/final-expense/calendar": {
      en: "/final-expense/calendar",
      es: "/gastos-finales/calendario",
    },
  },
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
