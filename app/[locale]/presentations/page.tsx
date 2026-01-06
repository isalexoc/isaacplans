import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import {
  ogLocaleOf,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { BlogUserAuth } from "@/components/blog-user-auth";
import PresentationsDashboard from "@/components/presentations-dashboard";
import { sanityFetch } from "@/sanity/lib/live";
import { PRESENTATION_SCRIPT_QUERY } from "@/lib/sanity/queries/presentationScripts";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "presentations.meta" });

  const title = t("title", { defaultValue: "Presentations - Admin" });
  const description = t("description", { defaultValue: "Admin presentations area" });

  const canonical = `/${locale}/presentations`;
  const ogLocale = ogLocaleOf(locale);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        "en-US": "/en/presentations",
        "es-ES": "/es/presentations",
        "x-default": "/en/presentations",
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PresentationsPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const { userId } = await auth();
  
  // Redirect to sign-in if not authenticated
  if (!userId) {
    redirect(`/${locale}/sign-in?redirect_url=/${locale}/presentations`);
  }

  // Check if user is admin via publicMetadata
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

  if (!isAdmin) {
    redirect(`/${locale}/unauthorized`);
  }

  const t = await getTranslations({ locale, namespace: "presentations" });

  const scriptOptions = { 
    next: { 
      revalidate: 3600, // 1 hour cache
      tags: ['presentation-scripts'] 
    } 
  };

  // Fetch scripts for all lines of business
  const linesOfBusiness = ['iul', 'aca', 'dentalVision', 'hospitalIndemnity', 'finalExpense', 'shortTermMedical'];
  
  const scriptPromises = linesOfBusiness.map(async (lob) => {
    const result = await sanityFetch({
      query: PRESENTATION_SCRIPT_QUERY,
      params: { lineOfBusiness: lob },
      ...scriptOptions,
    });
    return [lob, result.data || null] as const;
  });

  const scriptResults = await Promise.all(scriptPromises);
  const scripts = Object.fromEntries(scriptResults);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 max-w-7xl">
      {/* User Auth Component */}
      <div className="flex justify-end mb-4 md:mb-6">
        <BlogUserAuth />
      </div>

      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 md:mb-4">
          {t("title", { defaultValue: "Presentations" })}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          {t("description", { defaultValue: "Sales scripts and presentation guides for phone conversations" })}
        </p>
      </div>

      {/* Presentations Dashboard */}
      <PresentationsDashboard scripts={scripts} />
    </div>
  );
}

