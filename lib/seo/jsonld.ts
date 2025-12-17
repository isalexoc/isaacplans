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

/* ─────────────────────────  Social Media Links ─────────────────────── */
const getSocialLinks = (locale: string) => {
  const isES = locale === "es";
  return {
    facebook: isES
      ? "https://www.facebook.com/isaacplanses"
      : "https://www.facebook.com/isaacplansi",
    instagram: isES
      ? "https://www.instagram.com/isaacplans_es"
      : "https://www.instagram.com/isalexoc",
    youtube: isES
      ? "https://www.youtube.com/@isaacplans_es"
      : "https://www.youtube.com/@isaacplans",
    linkedin: isES
      ? "https://www.linkedin.com/in/isaacplans-es"
      : "https://www.linkedin.com/in/isaacplans",
  };
};

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
export const getAgencyLd = (locale: string = "en"): WithContext<InsuranceAgency> => {
  const socialLinks = getSocialLinks(locale);
  return {
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
    socialLinks.facebook,
    socialLinks.instagram,
    socialLinks.linkedin,
    socialLinks.youtube,
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
export const getIsaacPersonLd = (locale: string = "en"): WithContext<Person> => {
  const socialLinks = getSocialLinks(locale);
  return {
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
    socialLinks.facebook,
    socialLinks.instagram,
    socialLinks.linkedin,
    socialLinks.youtube,
  ],

  knowsLanguage: ["English", "Spanish"],

  hasCredential: {
    "@type": "EducationalOccupationalCredential",
    credentialCategory: "Professional Certificate",
    name: "Certified Health Care Reform Specialist",
  },
  };
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
  image?: string | string[]; // Can be single URL or array of URLs for multiple sizes
  imageObject?: any; // Sanity image object for generating multiple sizes
  category?: string;
  tags?: string[];
  canonicalUrl?: string;
}

/**
 * Formats a date string to ISO 8601 format with timezone
 * If the date is already in ISO format, returns it as-is
 * Otherwise, converts it to ISO 8601 with UTC timezone
 */
const formatDateToISO8601 = (dateString: string): string => {
  if (!dateString) return new Date().toISOString();
  
  // If already in ISO format, return as-is
  if (dateString.includes('T') && dateString.includes('Z')) {
    return dateString;
  }
  
  // If it's just a date, add time and timezone
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return `${dateString}T00:00:00Z`;
  }
  
  // Try to parse and convert to ISO
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    // Fallback to current date if parsing fails
  }
  
  return new Date().toISOString();
};

export const getBlogPostArticleLd = (
  post: BlogPostData
): WithContext<Article> => {
  const url = post.canonicalUrl || `${BASE_URL}/${post.locale}/blog/${post.slug}`;
  
  // Prepare image array with multiple sizes per Google's recommendations
  // Google recommends: 16x9, 4x3, and 1x1 aspect ratios with minimum 50K pixels
  // We'll generate: 1200x675 (16x9) = 810K pixels, 1200x900 (4x3) = 1.08M pixels, 1200x1200 (1x1) = 1.44M pixels
  let images: string[] | undefined = undefined;
  
  if (Array.isArray(post.image)) {
    // If array is provided, use it directly
    images = post.image;
  } else if (post.image) {
    // If single URL provided, use it (backward compatibility)
    images = [post.image];
  }
  
  // Format dates to ISO 8601 with timezone
  const datePublished = formatDateToISO8601(post.publishedAt);
  const dateModified = post.updatedAt 
    ? formatDateToISO8601(post.updatedAt)
    : datePublished;

  // Author as Person object following Google's best practices:
  // - Use Person type for people (not Organization)
  // - Include url property for author identification (link to author profile page)
  // - Only name in author.name (no job titles, prefixes, introductory words)
  // - Use separate publisher property for the organization
  const authorPerson: Person = {
    "@type": "Person",
    "@id": `${BASE_URL}/#isaacOrraiz`,
    name: post.author.trim(), // Only the name, no additional info
    url: `${BASE_URL}/about`, // Link to author's profile page for disambiguation
  };

  // Publisher as Organization (separate from author)
  // This is required and should be the organization that publishes the content
  const publisherOrg = {
    "@type": "Organization" as const,
    "@id": `${BASE_URL}/#organization`,
    name: "Isaac Plans Insurance",
    logo: {
      "@type": "ImageObject" as const,
      url: LOGO_URL,
    },
  };

  // Use BlogPosting type (more specific than Article for blog posts)
  // Google accepts Article, NewsArticle, or BlogPosting - BlogPosting is most appropriate for blogs
  // TypeScript type uses Article (base type), but JSON-LD uses "BlogPosting" string
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting" as any, // BlogPosting is valid per Google, but may not be in schema-dts types
    "@id": `${url}#article`,
    headline: post.title,
    description: post.description,
    image: images, // Array of image URLs (multiple sizes recommended: 16x9, 4x3, 1x1)
    datePublished: datePublished, // ISO 8601 format with timezone (e.g., "2024-01-05T08:00:00+08:00")
    dateModified: dateModified, // ISO 8601 format with timezone
    author: [authorPerson], // Array of Person objects (can include multiple authors)
    publisher: publisherOrg, // Organization that publishes the content
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    articleSection: post.category, // Category/section of the article
    keywords: post.tags?.join(", "), // Comma-separated keywords
    inLanguage: post.locale, // Language code (e.g., "en", "es")
    url: url, // Canonical URL of the article
  } as WithContext<Article>;
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
