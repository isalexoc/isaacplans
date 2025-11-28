import {
  WithContext,
  InsuranceAgency,
  WebSite,
  BreadcrumbList,
  OpeningHoursSpecification,
  Person,
  WebPage,
  Article,
  ListItem,
} from "schema-dts";

/* ─────────────────────────  shared constants ─────────────────────── */
const BASE_URL = "https://www.isaacplans.com";
const PHONE = "+15404261804";
const LOGO_URL = `${BASE_URL}/images/logo_ip.png`;

/* Opening hours (7 days, 08–20) */
const weekdayHours: OpeningHoursSpecification = {
  "@type": "OpeningHoursSpecification",
  dayOfWeek: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
  opens: "08:00",
  closes: "20:00",
};

/* ───────────── InsuranceAgency (Organization / LocalBusiness) ────── */
export const agencyLd: WithContext<InsuranceAgency> = {
  "@context": "https://schema.org",
  "@type": "InsuranceAgency",
  "@id": `${BASE_URL}/#organization`,

  name: "Isaac Plans Insurance",
  legalName: "Ominvestments, LLC",
  slogan: "Coverage made simple",
  description:
    "Bilingual insurance agency helping families compare ACA marketplace, Medicare, life, dental and vision plans across the United States.",
  url: BASE_URL,
  logo: LOGO_URL,
  image: LOGO_URL,

  /* Place info */
  address: {
    "@type": "PostalAddress",
    streetAddress: "129 Pewter Line",
    addressLocality: "Stafford",
    addressRegion: "VA",
    postalCode: "22554",
    addressCountry: "US",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 38.474001863773786,
    longitude: -77.42454181829108,
  },
  openingHoursSpecification: [weekdayHours],
  currenciesAccepted: "USD",
  paymentAccepted: "Cash, Credit Card",
  priceRange: "$$",
  areaServed: "US",

  telephone: PHONE,
  email: "info@isaacplans.com",
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: PHONE,
      contactType: "customer service",
      areaServed: "US",
      availableLanguage: ["English", "Spanish"], // aligned to supported locales
    },
  ],

  /* Social links */
  sameAs: [
    "https://www.facebook.com/isaacagent",
    "https://www.instagram.com/isalexoc",
    "https://www.linkedin.com/in/isaacplans",
    "https://www.youtube.com/@isaacplans",
  ],

  /* Reference to person (no duplication) */
  employee: { "@id": `${BASE_URL}/#isaacOrraiz` },

  /* Offer catalog */
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Insurance Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "ACA Health Insurance Enrollment",
          description:
            "Assistance with ACA marketplace health insurance enrollment.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Life Insurance Consultation",
        },
      },
      {
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: "Dental Insurance Plans" },
      },
      {
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: "Vision Insurance Plans" },
      },
      {
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: "Medicare Plan Comparison" },
      },
    ],
  },
};

/* ───────────── WebSite (+ optional SearchAction) ───────────── */
export const siteLd: WithContext<WebSite> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  url: BASE_URL,
  name: "Isaac Plans Insurance",
  alternateName: "IsaacPlans.com",
  description:
    "Bilingual insurance agency specializing in ACA, Medicare, life, dental and vision plans across the United States.",
  inLanguage: ["en", "es"],
  publisher: { "@id": `${BASE_URL}/#organization` },
  // If you add an on-site search, uncomment this:
  // potentialAction: {
  //   "@type": "SearchAction",
  //   target: `${BASE_URL}/search?q={search_term_string}`,
  //   "query-input": "required name=search_term_string"
  // }
};

/* ───────────── Root breadcrumb (optional) ─────────────
   Prefer page-level breadcrumbs; keep this only if you really need a global one. */
export const rootBreadcrumbLd: WithContext<BreadcrumbList> = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
  ],
};

/* Optional localized root breadcrumb helper (if you want locale-aware “Home”) */
export const getRootBreadcrumbLd = (
  locale: string,
  homeLabel: string
): WithContext<BreadcrumbList> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: `${BASE_URL}/${locale}`,
    },
  ],
});

/* ───────────── Person (global) ───────────── */
export const isaacPersonLd: WithContext<Person> = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${BASE_URL}/#isaacOrraiz`,

  name: "Isaac Orraiz",
  jobTitle:
    "Certified Health Care Reform Specialist – Licensed Insurance Agent",
  worksFor: { "@id": `${BASE_URL}/#organization` },

  image:
    "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_300/isaacpic_c8kca5.jpg",
  email: "info@isaacplans.com",
  telephone: PHONE,

  sameAs: [
    "https://www.facebook.com/isaacagent",
    "https://www.instagram.com/isalexoc",
    "https://www.linkedin.com/in/isaacplans",
    "https://www.youtube.com/@isaacplans",
  ],

  knowsLanguage: ["English", "Spanish"],

  hasCredential: {
    "@type": "EducationalOccupationalCredential",
    credentialCategory: "Professional Certificate",
    name: "Certified Health Care Reform Specialist",
  },
};

/* ───────────── Page-specific helpers ───────────── */

export const getAcaPageLd = (
  locale: string,
  title: string,
  description: string
): WithContext<WebPage> => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${BASE_URL}/${locale}/aca#webpage`,
  url: `${BASE_URL}/${locale}/aca`,
  name: title,
  description,
  inLanguage: locale,
  about: { "@id": `${BASE_URL}/#organization` },
});

export const getAcaBreadcrumbLd = (
  locale: string,
  homeLabel: string,
  acaLabel: string
): WithContext<BreadcrumbList> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: `${BASE_URL}/${locale}`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: acaLabel,
      item: `${BASE_URL}/${locale}/aca`,
    },
  ],
});

export const getDentalVisionPageLd = (
  locale: string,
  title: string,
  description: string
): WithContext<WebPage> => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${BASE_URL}/${locale}/dental-vision#webpage`,
  url: `${BASE_URL}/${locale}/dental-vision`,
  name: title,
  description,
  inLanguage: locale,
  about: { "@id": `${BASE_URL}/#organization` },
});

export const getDentalVisionBreadcrumbLd = (
  locale: string,
  homeLabel: string,
  dvLabel: string
): WithContext<BreadcrumbList> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: `${BASE_URL}/${locale}`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: dvLabel,
      item: `${BASE_URL}/${locale}/dental-vision`,
    },
  ],
});

export const getHiPageLd = (
  locale: string,
  title: string,
  description: string
): WithContext<WebPage> => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${BASE_URL}/${locale}/hospital-indemnity#webpage`,
  url: `${BASE_URL}/${locale}/hospital-indemnity`,
  name: title,
  description,
  inLanguage: locale,
  about: { "@id": `${BASE_URL}/#organization` },
});

export const getHiBreadcrumbLd = (
  locale: string,
  homeLabel: string,
  hiLabel: string
): WithContext<BreadcrumbList> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: `${BASE_URL}/${locale}`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: hiLabel,
      item: `${BASE_URL}/${locale}/hospital-indemnity`,
    },
  ],
});

export const getAboutPageLd = (
  locale: string,
  title: string,
  description: string,
  slug = "about" // pass "sobre-mi" for ES
): WithContext<WebPage> => ({
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${BASE_URL}/${locale}/${slug}#webpage`,
  url: `${BASE_URL}/${locale}/${slug}`,
  name: title,
  description,
  inLanguage: locale,
  about: { "@id": `${BASE_URL}/#organization` },
});

export const getAboutBreadcrumbLd = (
  locale: string,
  homeLabel: string,
  aboutLabel: string,
  slug = "about" // pass "sobre-mi" for ES
): WithContext<BreadcrumbList> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: `${BASE_URL}/${locale}`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: aboutLabel,
      item: `${BASE_URL}/${locale}/${slug}`,
    },
  ],
});

/* IUL page (Indexed Universal Life) */
export const getIulPageLd = (
  locale: string,
  title: string,
  description: string,
  slug = "iul" // "/en/iul" or "/es/iul"
): WithContext<WebPage> => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${BASE_URL}/${locale}/${slug}#webpage`,
  url: `${BASE_URL}/${locale}/${slug}`,
  name: title,
  description,
  inLanguage: locale,
  about: { "@id": `${BASE_URL}/#organization` },
});

export const getIulBreadcrumbLd = (
  locale: string,
  homeLabel: string,
  iulLabel: string,
  slug = "iul" // "/en/iul" or "/es/iul"
): WithContext<BreadcrumbList> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: `${BASE_URL}/${locale}`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: iulLabel,
      item: `${BASE_URL}/${locale}/${slug}`,
    },
  ],
});

/** UHOne Short Term Medical — page JSON-LD */
export const getUhoneShortTermPageLd = (
  locale: string,
  title: string,
  description: string
): WithContext<WebPage> => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${BASE_URL}/${locale}/carriers/uhone/shortterm#webpage`,
  url: `${BASE_URL}/${locale}/carriers/uhone/shortterm`,
  name: title,
  description,
  inLanguage: locale,
  about: { "@id": `${BASE_URL}/#organization` },
});

/** UHOne Short Term Medical — breadcrumb JSON-LD (Home → Page) */
export const getUhoneShortTermBreadcrumbLd = (
  locale: string,
  homeLabel: string,
  pageLabel: string
): WithContext<BreadcrumbList> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: `${BASE_URL}/${locale}`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: pageLabel,
      item: `${BASE_URL}/${locale}/carriers/uhone/shortterm`,
    },
  ],
});

/** Short-Term Medical (main page) — locale-aware path helper */
const shortTermPathFor = (locale: string) =>
  locale?.toLowerCase().startsWith("es")
    ? "cobertura-a-corto-plazo"
    : "short-term-medical";

/** WebPage JSON-LD for STM main page */
export const getShortTermMainPageLd = (
  locale: string,
  title: string,
  description: string
): WithContext<WebPage> => {
  const path = shortTermPathFor(locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${BASE_URL}/${locale}/${path}#webpage`,
    url: `${BASE_URL}/${locale}/${path}`,
    name: title,
    description,
    inLanguage: locale,
    about: { "@id": `${BASE_URL}/#organization` },
  };
};

/** BreadcrumbList JSON-LD for STM main page (Home → STM) */
export const getShortTermMainBreadcrumbLd = (
  locale: string,
  homeLabel: string,
  pageLabel: string
): WithContext<BreadcrumbList> => {
  const path = shortTermPathFor(locale);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: homeLabel,
        item: `${BASE_URL}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: pageLabel,
        item: `${BASE_URL}/${locale}/${path}`,
      },
    ],
  };
};

/** Final Expense — locale-aware path helper */
const finalExpensePathFor = (locale: string) =>
  locale?.toLowerCase().startsWith("es") ? "gastos-finales" : "final-expense";

/** Final Expense — WebPage JSON-LD */
export const getFePageLd = (
  locale: string,
  title: string,
  description: string
): WithContext<WebPage> => {
  const path = finalExpensePathFor(locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${BASE_URL}/${locale}/${path}#webpage`,
    url: `${BASE_URL}/${locale}/${path}`,
    name: title,
    description,
    inLanguage: locale,
    about: { "@id": `${BASE_URL}/#organization` },
  };
};

/** Final Expense — BreadcrumbList JSON-LD (Home → Final Expense) */
export const getFeBreadcrumbLd = (
  locale: string,
  homeLabel: string,
  feLabel: string
): WithContext<BreadcrumbList> => {
  const path = finalExpensePathFor(locale);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: homeLabel,
        item: `${BASE_URL}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: feLabel,
        item: `${BASE_URL}/${locale}/${path}`,
      },
    ],
  };
};

/* ───────────── Blog Post Article JSON-LD ───────────── */
export interface BlogPostData {
  title: string;
  description: string;
  slug: string;
  locale: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  image?: string;
  category?: string;
  tags?: string[];
  canonicalUrl?: string;
}

export const getBlogPostArticleLd = (
  post: BlogPostData
): WithContext<Article> => {
  const url = post.canonicalUrl || `${BASE_URL}/${post.locale}/blog/${post.slug}`;
  
  // Prepare image array with multiple sizes if available
  const images = post.image ? [
    post.image,
    // You can add more image sizes here if you have them
  ] : undefined;

  // Author as Person object (not just reference) for better Google recognition
  const authorPerson = {
    "@type": "Person" as const,
    "@id": `${BASE_URL}/#isaacOrraiz`,
    name: post.author,
    url: `${BASE_URL}/about`,
  };

  // Publisher with Organization details including logo
  const publisherOrg = {
    "@type": "Organization" as const,
    "@id": `${BASE_URL}/#organization`,
    name: "Isaac Plans Insurance",
    logo: {
      "@type": "ImageObject" as const,
      url: LOGO_URL,
    },
  };

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.description,
    image: images,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: [authorPerson],
    publisher: publisherOrg,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    articleSection: post.category,
    keywords: post.tags?.join(", "),
    inLanguage: post.locale,
    url: url,
  };
};

/* ───────────── Blog Post Breadcrumb JSON-LD ───────────── */
export const getBlogPostBreadcrumbLd = (
  locale: string,
  slug: string,
  postTitle: string,
  category?: string,
  categoryLabel?: string
): WithContext<BreadcrumbList> => {
  const homeLabel = locale === "en" ? "Home" : "Inicio";
  const blogLabel = locale === "en" ? "Blog" : "Blog";
  
  const items: ListItem[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: homeLabel,
      item: `${BASE_URL}/${locale}`,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: blogLabel,
      item: `${BASE_URL}/${locale}/blog`,
    },
  ];

  if (category && categoryLabel) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: categoryLabel,
      item: `${BASE_URL}/${locale}/blog/category/${category}`,
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: postTitle,
    item: `${BASE_URL}/${locale}/blog/${slug}`,
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
};
