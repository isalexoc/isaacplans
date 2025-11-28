import Link from "next/link";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { type SanityDocument } from "next-sanity";
import { client } from "@/sanity/lib/client";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";

const CATEGORIES_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
]{
  category
}`;

const options = { next: { revalidate: 30 } };

// Category labels mapping with images
const CATEGORY_LABELS: Record<string, { en: string; es: string; description: { en: string; es: string }; image?: string }> = {
  aca: {
    en: "ACA / Obamacare",
    es: "ACA / Obamacare",
    description: {
      en: "Learn about Affordable Care Act plans, enrollment periods, and subsidies",
      es: "Aprende sobre planes de la Ley de Cuidado de Salud Asequible, períodos de inscripción y subsidios",
    },
    image: "aca_obamacare_w1tive",
  },
  "short-term-medical": {
    en: "Short Term Medical",
    es: "Seguro Médico de Corto Plazo",
    description: {
      en: "Temporary health coverage for gaps between major medical plans",
      es: "Cobertura de salud temporal para brechas entre planes médicos principales",
    },
    image: "short-term-medical_zfopfc",
  },
  "dental-vision": {
    en: "Dental & Vision",
    es: "Dental y Visión",
    description: {
      en: "Affordable dental and vision insurance plans",
      es: "Planes de seguro dental y de visión asequibles",
    },
    image: "dental-vision_mfu7ip",
  },
  "hospital-indemnity": {
    en: "Hospital Indemnity",
    es: "Indemnización Hospitalaria",
    description: {
      en: "Cash benefits for hospital stays and medical procedures",
      es: "Beneficios en efectivo para estancias hospitalarias y procedimientos médicos",
    },
    image: "hospital-indemnity_a2hjke",
  },
  iul: {
    en: "IUL (Indexed Universal Life)",
    es: "IUL (Seguro Universal de Vida Indexado)",
    description: {
      en: "Life insurance with cash value growth potential",
      es: "Seguro de vida con potencial de crecimiento de valor en efectivo",
    },
    image: "iul_zxgyef",
  },
  "final-expense": {
    en: "Final Expense / Burial",
    es: "Gastos Finales / Sepultura",
    description: {
      en: "Life insurance to cover funeral and burial costs",
      es: "Seguro de vida para cubrir costos de funeral y sepultura",
    },
    image: "final-expense_qkkzvd",
  },
  "cancer-plans": {
    en: "Cancer Plans",
    es: "Planes de Cáncer",
    description: {
      en: "Specialized insurance coverage for cancer treatment",
      es: "Cobertura de seguro especializada para tratamiento del cáncer",
    },
    image: "cancer-plans_ntdmxh",
  },
  "heart-stroke": {
    en: "Heart Attack & Stroke Plans",
    es: "Planes de Ataque Cardíaco y Derrame",
    description: {
      en: "Insurance coverage for heart attack and stroke events",
      es: "Cobertura de seguro para eventos de ataque cardíaco y derrame",
    },
    image: "heart-attack-stroke_btnlju",
  },
  general: {
    en: "General Insurance",
    es: "Seguro General",
    description: {
      en: "General insurance information and tips",
      es: "Información y consejos generales sobre seguros",
    },
    image: "general-insurance_utbmcj",
  },
  "tips-guides": {
    en: "Insurance Tips & Guides",
    es: "Consejos y Guías de Seguros",
    description: {
      en: "Helpful tips and comprehensive guides for insurance",
      es: "Consejos útiles y guías completas sobre seguros",
    },
    image: "insurance-tips-guides_wvrix3",
  },
  news: {
    en: "Industry News",
    es: "Noticias de la Industria",
    description: {
      en: "Latest news and updates from the insurance industry",
      es: "Últimas noticias y actualizaciones de la industria de seguros",
    },
    image: "news-insurance-news_tkd88r",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const title = locale === "en" ? "Blog Categories | Isaac Plans Insurance" : "Categorías del Blog | Isaac Plans Insurance";
  const description = locale === "en"
    ? "Browse all blog categories and find articles about ACA, IUL, dental vision, and more insurance topics"
    : "Explora todas las categorías del blog y encuentra artículos sobre ACA, IUL, dental visión y más temas de seguros";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale),
      type: "website",
    },
  };
}

export default async function CategoriesPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "blogPage" });

  // Get all posts to count categories
  const posts = await client.fetch<SanityDocument[]>(
    CATEGORIES_QUERY,
    { locale },
    options
  );

  // Count posts per category
  const categoryCounts: Record<string, number> = {};
  posts.forEach((post) => {
    if (post.category) {
      categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1;
    }
  });

  // Get all categories from CATEGORY_LABELS, but only show those with posts
  const allCategories = Object.keys(CATEGORY_LABELS)
    .map((category) => ({
      id: category,
      count: categoryCounts[category] || 0,
      label: CATEGORY_LABELS[category]?.[locale] || category,
      description: CATEGORY_LABELS[category]?.description[locale] || "",
      image: CATEGORY_LABELS[category]?.image,
    }))
    .filter((category) => category.count > 0) // Only show categories with posts
    .sort((a, b) => {
      // Sort by post count (descending), then alphabetically by label
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    });

  return (
    <main className="container mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {locale === "en" ? "Back to Blog" : "Volver al Blog"}
        </Link>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
          {locale === "en" ? "Blog Categories" : "Categorías del Blog"}
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          {locale === "en"
            ? "Explore our blog posts by category"
            : "Explora nuestras publicaciones del blog por categoría"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {allCategories.map((category) => {
            const imageUrl = category.image
              ? `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400,h_250,c_fill,g_auto/${category.image}`
              : null;

            return (
              <Link
                key={category.id}
                href={`/${locale}/blog/category/${category.id}`}
                className="group"
              >
                <article className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  {/* Category Image */}
                  {imageUrl ? (
                    <div className="relative w-full h-48 overflow-hidden">
                      <Image
                        src={imageUrl}
                        alt={category.label}
                        fill
                        className="object-cover object-top group-hover:scale-110 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  ) : (
                    <div className="relative w-full h-48 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                      <svg
                        className="w-16 h-16 text-blue-300 dark:text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-block px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                        {category.label}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {category.count} {locale === "en" ? "posts" : "publicaciones"}
                      </span>
                    </div>
                    {category.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2 flex-1">
                        {category.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors text-sm font-medium mt-auto">
                      <span>
                        {locale === "en" ? "View Posts" : "Ver Publicaciones"}
                      </span>
                      <svg
                        className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
      </div>
    </main>
  );
}

