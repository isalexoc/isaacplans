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
    "/contact/calendar": {
      en: "/contact-me/calendar",
      es: "/contacto/calendario",
    },
    "/book-appointment": {
      en: "/book-appointment",
      es: "/agendar-cita",
    },
    "/dental-vision": {
      en: "/dental-vision",
      es: "/dental-vision",
    },
    "/dental-vision/calendar": {
      en: "/dental-vision/calendar",
      es: "/dental-vision/calendario",
    },
    "/dental-vision/self-enrollment": {
      en: "/dental-vision/self-enrollment",
      es: "/dental-vision/autoinscripcion",
    },
    "/hospital-indemnity": {
      en: "/hospital-indemnity",
      es: "/indemnizacion-hospitalaria",
    },
    "/hospital-indemnity/calendar": {
      en: "/hospital-indemnity/calendar",
      es: "/indemnizacion-hospitalaria/calendario",
    },
    "/hospital-indemnity/self-enrollment": {
      en: "/hospital-indemnity/self-enrollment",
      es: "/indemnizacion-hospitalaria/autoinscripcion",
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
    "/carriers": {
      en: "/carriers",
      es: "/carriers",
    },
    "/carriers/uhone": {
      en: "/carriers/uhone",
      es: "/carriers/uhone",
    },
    "/carriers/uhone/shortterm": {
      en: "/carriers/uhone/shortterm",
      es: "/carriers/uhone/shortterm",
    },
    "/carriers/uhone/[product]": {
      en: "/carriers/uhone/[product]",
      es: "/carriers/uhone/[product]",
    },
    "/carriers/allstate": {
      en: "/carriers/allstate",
      es: "/carriers/allstate",
    },
    "/carriers/allstate/shortterm": {
      en: "/carriers/allstate/shortterm",
      es: "/carriers/allstate/shortterm",
    },
    "/carriers/allstate/seniors/[product]": {
      en: "/carriers/allstate/seniors/[product]",
      es: "/carriers/allstate/seniors/[product]",
    },
    "/carriers/allstate/individual/[product]": {
      en: "/carriers/allstate/individual/[product]",
      es: "/carriers/allstate/individual/[product]",
    },
    "/carriers/allstate/cancer-only": {
      en: "/carriers/allstate/cancer-only",
      es: "/carriers/allstate/cancer-only",
    },
    "/carriers/pivot/shortterm": {
      en: "/carriers/pivot/shortterm",
      es: "/carriers/pivot/shortterm",
    },
    "/carriers/manhattan": {
      en: "/carriers/manhattan",
      es: "/carriers/manhattan",
    },
    "/carriers/manhattan/[product]": {
      en: "/carriers/manhattan/[product]",
      es: "/carriers/manhattan/[product]",
    },
    "/carriers/manhattan/shortterm": {
      en: "/carriers/manhattan/shortterm",
      es: "/carriers/manhattan/shortterm",
    },
    "/get-covered-fast": {
      en: "/get-covered-fast",
      es: "/cobertura-rapida",
    },
    "/get-health-coverage-fast": {
      en: "/get-health-coverage-fast",
      es: "/cobertura-salud-rapida",
    },
    "/short-term-medical": {
      en: "/short-term-medical",
      es: "/cobertura-a-corto-plazo",
    },
    "/short-term-medical/calendar": {
      en: "/short-term-medical/calendar",
      es: "/cobertura-a-corto-plazo/calendario",
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
    "/iul/quote": {
      en: "/iul/quote",
      es: "/iul/cotizacion",
    },
    "/final-expense": {
      en: "/final-expense",
      es: "/gastos-finales",
    },
    "/final-expense/calendar": {
      en: "/final-expense/calendar",
      es: "/gastos-finales/calendario",
    },
    "/final-expense/presentation": {
      en: "/final-expense/presentation",
      es: "/gastos-finales/presentacion",
    },
    "/final-expense/qualification": {
      en: "/final-expense/qualification",
      es: "/gastos-finales/calificacion",
    },
    "/final-expense/referrals": {
      en: "/final-expense/referrals",
      es: "/gastos-finales/referidos",
    },
    "/final-expense/leave-behind": {
      en: "/final-expense/leave-behind",
      es: "/gastos-finales/dejar-imagen",
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
    "/newsletter": {
      en: "/newsletter",
      es: "/boletín",
    },
  },
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
