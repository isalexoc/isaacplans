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
    "/dental-vision/apply": {
      en: "/dental-vision/apply",
      es: "/dental-vision/aplicar",
    },
    "/dental-vision/apply/start": {
      en: "/dental-vision/apply/start",
      es: "/dental-vision/aplicar/start",
    },
    "/dental-vision/intake": {
      en: "/dental-vision/intake",
      es: "/dental-vision/admision",
    },
    "/dental-vision/intake/[token]": {
      en: "/dental-vision/intake/[token]",
      es: "/dental-vision/admision/[token]",
    },
    "/dental-vision/intake/[token]/view": {
      en: "/dental-vision/intake/[token]/view",
      es: "/dental-vision/admision/[token]/view",
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
    "/hospital-indemnity/apply": {
      en: "/hospital-indemnity/apply",
      es: "/indemnizacion-hospitalaria/aplicar",
    },
    "/hospital-indemnity/apply/start": {
      en: "/hospital-indemnity/apply/start",
      es: "/indemnizacion-hospitalaria/aplicar/start",
    },
    "/hospital-indemnity/intake": {
      en: "/hospital-indemnity/intake",
      es: "/indemnizacion-hospitalaria/admision",
    },
    "/hospital-indemnity/intake/[token]": {
      en: "/hospital-indemnity/intake/[token]",
      es: "/indemnizacion-hospitalaria/admision/[token]",
    },
    "/hospital-indemnity/intake/[token]/view": {
      en: "/hospital-indemnity/intake/[token]/view",
      es: "/indemnizacion-hospitalaria/admision/[token]/view",
    },
    "/aca": {
      en: "/aca",
      es: "/aca",
    },
    "/aca/calendar": {
      en: "/aca/calendar",
      es: "/aca/calendario",
    },
    "/aca/intake": {
      en: "/aca/intake",
      es: "/aca/admision",
    },
    "/aca/intake/[token]": {
      en: "/aca/intake/[token]",
      es: "/aca/admision/[token]",
    },
    "/aca/intake/[token]/view": {
      en: "/aca/intake/[token]/view",
      es: "/aca/admision/[token]/view",
    },
    "/aca/get-covered": {
      en: "/aca/get-covered",
      es: "/aca/obtener-cobertura",
    },
    "/aca/apply": {
      en: "/aca/apply",
      es: "/aca/aplicar",
    },
    "/aca/apply/start": {
      en: "/aca/apply/start",
      es: "/aca/aplicar/start",
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
    "/short-term-medical/apply": {
      en: "/short-term-medical/apply",
      es: "/cobertura-a-corto-plazo/aplicar",
    },
    "/short-term-medical/apply/start": {
      en: "/short-term-medical/apply/start",
      es: "/cobertura-a-corto-plazo/aplicar/start",
    },
    "/short-term-medical/intake": {
      en: "/short-term-medical/intake",
      es: "/cobertura-a-corto-plazo/admision",
    },
    "/short-term-medical/intake/[token]": {
      en: "/short-term-medical/intake/[token]",
      es: "/cobertura-a-corto-plazo/admision/[token]",
    },
    "/short-term-medical/intake/[token]/view": {
      en: "/short-term-medical/intake/[token]/view",
      es: "/cobertura-a-corto-plazo/admision/[token]/view",
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
    "/iul/apply": {
      en: "/iul/apply",
      es: "/iul/aplicar",
    },
    "/iul/apply/start": {
      en: "/iul/apply/start",
      es: "/iul/aplicar/start",
    },
    "/iul/intake": {
      en: "/iul/intake",
      es: "/iul/admision",
    },
    "/iul/intake/[token]": {
      en: "/iul/intake/[token]",
      es: "/iul/admision/[token]",
    },
    "/iul/intake/[token]/view": {
      en: "/iul/intake/[token]/view",
      es: "/iul/admision/[token]/view",
    },
    "/iul/referrals": {
      en: "/iul/referrals",
      es: "/iul/referidos",
    },
    "/iul/quote": {
      en: "/iul/quote",
      es: "/iul/cotizacion",
    },
    "/iul/get-covered": {
      en: "/iul/get-covered",
      es: "/iul/obtener-cobertura",
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
    "/final-expense/sale-sticker": {
      en: "/final-expense/sale-sticker",
      es: "/gastos-finales/sticker-de-venta",
    },
    "/final-expense/get-covered": {
      en: "/final-expense/get-covered",
      es: "/gastos-finales/obtener-cobertura",
    },
    "/final-expense/apply": {
      en: "/final-expense/apply",
      es: "/gastos-finales/aplicar",
    },
    "/final-expense/apply/start": {
      en: "/final-expense/apply/start",
      es: "/gastos-finales/aplicar/start",
    },
    "/final-expense/intake": {
      en: "/final-expense/intake",
      es: "/gastos-finales/admision",
    },
    "/final-expense/intake/[token]": {
      en: "/final-expense/intake/[token]",
      es: "/gastos-finales/admision/[token]",
    },
    "/final-expense/intake/[token]/view": {
      en: "/final-expense/intake/[token]/view",
      es: "/gastos-finales/admision/[token]/view",
    },
    "/final-expense/[state]": {
      en: "/final-expense/[state]",
      es: "/final-expense/[state]",
    },
    "/life-insurance": {
      en: "/life-insurance",
      es: "/seguro-de-vida",
    },
    "/life-insurance/calendar": {
      en: "/life-insurance/calendar",
      es: "/seguro-de-vida/calendario",
    },
    "/life-insurance/get-covered": {
      en: "/life-insurance/get-covered",
      es: "/seguro-de-vida/obtener-cobertura",
    },
    "/life-insurance/apply": {
      en: "/life-insurance/apply",
      es: "/seguro-de-vida/aplicar",
    },
    "/life-insurance/apply/start": {
      en: "/life-insurance/apply/start",
      es: "/seguro-de-vida/aplicar/start",
    },
    "/life-insurance/intake": {
      en: "/life-insurance/intake",
      es: "/seguro-de-vida/admision",
    },
    "/life-insurance/intake/[token]": {
      en: "/life-insurance/intake/[token]",
      es: "/seguro-de-vida/admision/[token]",
    },
    "/life-insurance/intake/[token]/view": {
      en: "/life-insurance/intake/[token]/view",
      es: "/seguro-de-vida/admision/[token]/view",
    },
    "/health-alternative": {
      en: "/health-alternative",
      es: "/alternativa-de-salud",
    },
    "/health-alternative/calendar": {
      en: "/health-alternative/calendar",
      es: "/alternativa-de-salud/calendario",
    },
    "/health-alternative/get-covered": {
      en: "/health-alternative/get-covered",
      es: "/alternativa-de-salud/obtener-cobertura",
    },
    "/health-alternative/apply": {
      en: "/health-alternative/apply",
      es: "/alternativa-de-salud/aplicar",
    },
    "/health-alternative/apply/start": {
      en: "/health-alternative/apply/start",
      es: "/alternativa-de-salud/aplicar/start",
    },
    "/health-alternative/intake": {
      en: "/health-alternative/intake",
      es: "/alternativa-de-salud/admision",
    },
    "/health-alternative/intake/[token]": {
      en: "/health-alternative/intake/[token]",
      es: "/alternativa-de-salud/admision/[token]",
    },
    "/health-alternative/intake/[token]/view": {
      en: "/health-alternative/intake/[token]/view",
      es: "/alternativa-de-salud/admision/[token]/view",
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
    "/admin": {
      en: "/admin",
      es: "/admin",
    },
    "/admin/blog-generator": {
      en: "/admin/blog-generator",
      es: "/admin/blog-generator",
    },
    "/lead-magnets": {
      en: "/lead-magnets",
      es: "/imanes-de-leads",
    },
    "/lead-magnets/[slug]": {
      en: "/lead-magnets/[slug]",
      es: "/imanes-de-leads/[slug]",
    },
    // Referral partners: the co-branded landing page a partner shares with their clients, and
    // the read-only dashboard that same partner signs into.
    "/partners/[slug]": {
      en: "/partners/[slug]",
      es: "/socios/[slug]",
    },
    "/partner": {
      en: "/partner",
      es: "/socio",
    },
  },
});

export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
