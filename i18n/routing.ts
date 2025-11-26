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
    "/iul/presentation": {
      en: "/iul/presentation",
      es: "/iul/presentacion",
    },
    "/iul/application": {
      en: "/iul/application",
      es: "/iul/aplicacion",
    },
    "/iul/referrals": {
      en: "/iul/referrals",
      es: "/iul/referidos",
    },
    "/final-expense": {
      en: "/final-expense",
      es: "/gastos-finales",
    },
    "/final-expense/calendar": {
      en: "/final-expense/calendar",
      es: "/gastos-finales/calendario",
    },
    "/faq": {
      en: "/faq",
      es: "/preguntas-frecuentes",
    },
    "/testimonials": {
      en: "/testimonials",
      es: "/testimonios",
    },
    "/glossary": {
      en: "/glossary",
      es: "/glosario",
    },
    "/subsidy-calculator": {
      en: "/subsidy-calculator",
      es: "/calculadora-de-subsidios",
    },
    "/plan-comparison": {
      en: "/plan-comparison",
      es: "/comparador-de-planes",
    },
    "/renewal-support": {
      en: "/renewal-support",
      es: "/apoyo-en-renovaciones",
    },
    "/consumer-guides": {
      en: "/consumer-guides",
      es: "/guias-para-consumidores",
    },
    "/consumer-guides/[guideId]": {
      en: "/consumer-guides/[guideId]",
      es: "/guias-para-consumidores/[guideId]",
    },
    "/blog": {
      en: "/blog",
      es: "/blog",
    },
    "/blog/[slug]": {
      en: "/blog/[slug]",
      es: "/blog/[slug]",
    },
    "/blog/category/[category]": {
      en: "/blog/category/[category]",
      es: "/blog/category/[category]",
    },
    "/blog/categories": {
      en: "/blog/categories",
      es: "/blog/categorias",
    },
  },
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
