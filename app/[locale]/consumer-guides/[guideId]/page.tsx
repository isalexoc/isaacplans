import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideDetailClient from "@/components/guide-detail-client";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { routing } from "@/i18n/routing";

// Mock guide data - In production, fetch from database
const MOCK_GUIDES: Record<string, {
  id: string;
  category: 'aca' | 'shortTerm' | 'dentalVision' | 'hospitalIndemnity' | 'iul' | 'finalExpense';
  title: string;
  titleEs?: string;
  description: string;
  descriptionEs?: string;
  thumbnail: string;
  thumbnailEs?: string;
  pdfUrl: string;
  pdfUrlEs?: string;
  content?: string;
  contentEs?: string;
}> = {
  'aca-guide-1': {
    id: 'aca-guide-1',
    category: 'aca',
    title: 'Complete Guide to ACA Open Enrollment',
    titleEs: 'Guía Completa de Inscripción Abierta ACA',
    description: 'Everything you need to know about enrolling in ACA health insurance, including deadlines, eligibility, and how to get subsidies.',
    descriptionEs: 'Todo lo que necesita saber sobre inscribirse en el seguro de salud ACA, incluyendo fechas límite, elegibilidad y cómo obtener subsidios.',
    thumbnail: 'guide_aca_en_jimeal', // English version
    thumbnailEs: 'guide_aca_es_y1t0bi', // Spanish version
    pdfUrl: 'https://res.cloudinary.com/isaacdev/image/upload/v1763579451/ACA_Guide_-_Isaac_Plans_Insurance_hhd7mx.pdf', // English PDF
    pdfUrlEs: 'https://res.cloudinary.com/isaacdev/image/upload/v1763579386/Gu%C3%ADa_del_Mercado_de_Salud_ACA_Isaac_Plans_Insurance_ftnoo7.pdf', // Spanish PDF
    content: 'This comprehensive guide covers all aspects of ACA Open Enrollment, including key dates, eligibility requirements, plan selection tips, and how to maximize your savings through subsidies and tax credits.',
    contentEs: 'Esta guía completa cubre todos los aspectos de la Inscripción Abierta ACA, incluyendo fechas clave, requisitos de elegibilidad, consejos para seleccionar planes y cómo maximizar sus ahorros a través de subsidios y créditos fiscales.',
  },
};

/* ───────── SEO ───────── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; guideId: string }>;
}): Promise<Metadata> {
  const { locale, guideId } = await params;
  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({ locale: supportedLocale, namespace: "guideDetailPage.meta" });

  const guide = MOCK_GUIDES[guideId];
  if (!guide) {
    return {
      title: "Guide Not Found",
    };
  }

  const isES = supportedLocale.startsWith("es");
  const title = isES && guide.titleEs ? guide.titleEs : guide.title;
  const description = isES && guide.descriptionEs ? guide.descriptionEs : guide.description;

  // Get locale-specific thumbnail for OG image
  const thumbnailId = isES && guide.thumbnailEs ? guide.thumbnailEs : guide.thumbnail;
  // Optimized Cloudinary URL for OG image (1200x630 is standard for social sharing)
  const ogImageUrl = thumbnailId 
    ? `https://res.cloudinary.com/isaacdev/image/upload/w_1200,h_630,c_fit,f_auto,q_auto/${thumbnailId}`
    : "https://res.cloudinary.com/isaacdev/image/upload/w_1200,h_630,c_fit,f_auto,q_auto/placeholder-guide.jpg";

  const routeKey = `/consumer-guides/${guideId}` as any;
  const slug = `/${locale}/consumer-guides/${guideId}`;
  const canonical = withLocalePrefix(supportedLocale, `/consumer-guides/${guideId}`);
  const ogLocale = ogLocaleOf(supportedLocale);

  return {
    title: t("title", { title }),
    description: t("description", { description }),
    keywords: t("keywords", { category: guide.category }),
    alternates: {
      canonical,
    },
    openGraph: {
      title: t("title", { title }),
      description: t("description", { description }),
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title", { title }),
      description: t("description", { description }),
      images: [ogImageUrl],
    },
  };
}

/* ───────── Page ───────── */
export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ locale: string; guideId: string }>;
}) {
  const { locale, guideId } = await params;
  const guide = MOCK_GUIDES[guideId];

  if (!guide) {
    notFound();
  }

  return <GuideDetailClient guide={guide} />;
}

