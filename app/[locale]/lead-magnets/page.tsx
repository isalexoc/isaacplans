import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { sanityFetch } from "@/sanity/lib/live";
import LeadMagnetsListingClient, { type LeadMagnetCard } from "@/components/lead-magnets-listing-client";

export const revalidate = 3600;

const LISTING_QUERY = `*[_type == "leadMagnet" && status == "published"] | order(publishedAt desc) {
  _id,
  title,
  subtitle,
  "slug": slug.current,
  category,
  coverImage { asset->{ url }, alt },
  downloadCount
}`;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isES = locale.startsWith("es");

  const title = isES
    ? "Guías Gratuitas de Seguros | Isaac Plans"
    : "Free Insurance Guides | Isaac Plans";
  const description = isES
    ? "Descarga guías gratuitas sobre ACA, gastos finales, vida, dental y más. Recursos educativos de Isaac Plans Insurance."
    : "Download free guides on ACA, final expense, life insurance, dental and more. Educational resources from Isaac Plans Insurance.";

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function LeadMagnetsPage() {
  const locale = await getLocale();
  const isES = locale.startsWith("es");

  const result = await sanityFetch({ query: LISTING_QUERY });

  const guides = (result.data ?? []) as LeadMagnetCard[];

  return (
    <>
      {/* Hero */}
      <div className="bg-gradient-to-b from-[hsl(var(--custom)/0.08)] to-transparent border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-[hsl(var(--custom)/0.1)] text-[hsl(var(--custom))] text-sm font-semibold px-4 py-1.5 rounded-full">
            <BookOpen className="w-4 h-4" />
            {isES ? "Recursos Gratuitos" : "Free Resources"}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {isES ? "Guías Gratuitas de Seguros" : "Free Insurance Guides"}
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            {isES
              ? "Recursos educativos escritos por expertos para ayudarte a tomar mejores decisiones sobre tu seguro."
              : "Expert-written resources to help you make smarter decisions about your insurance coverage."}
          </p>
        </div>
      </div>

      {/* Listing */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {guides.length === 0 ? (
          <div className="text-center py-24 text-gray-400 dark:text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">
              {isES ? "Pronto habrá guías disponibles." : "Guides coming soon."}
            </p>
          </div>
        ) : (
          <LeadMagnetsListingClient guides={guides} locale={locale} />
        )}
      </main>
    </>
  );
}
