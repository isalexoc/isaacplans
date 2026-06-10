"use client";

import { useState } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { Link } from "@/i18n/navigation";

const CATEGORY_LABELS: Record<string, string> = {
  aca: "ACA / Health",
  "temporary-health-insurance": "Temporary Health",
  "dental-vision": "Dental & Vision",
  "hospital-indemnity": "Hospital Indemnity",
  iul: "IUL / Life Insurance",
  "final-expense": "Final Expense",
  "cancer-plans": "Cancer Plans",
  "heart-stroke": "Heart & Stroke",
  general: "General Insurance",
  "tips-guides": "Tips & Guides",
  news: "News",
};

const CATEGORY_LABELS_ES: Record<string, string> = {
  aca: "ACA / Salud",
  "temporary-health-insurance": "Salud Temporal",
  "dental-vision": "Dental y Visión",
  "hospital-indemnity": "Indemnización Hospitalaria",
  iul: "IUL / Vida",
  "final-expense": "Gastos Finales",
  "cancer-plans": "Planes de Cáncer",
  "heart-stroke": "Corazón y Derrame",
  general: "Seguro General",
  "tips-guides": "Consejos y Guías",
  news: "Noticias",
};

export type LeadMagnetCard = {
  _id: string;
  title: string;
  subtitle: string;
  slug: string;
  category: string;
  coverImage: { asset: { url: string }; alt: string } | null;
  downloadCount: number;
};

interface Props {
  guides: LeadMagnetCard[];
  locale: string;
}

export default function LeadMagnetsListingClient({ guides, locale }: Props) {
  const isES = locale.startsWith("es");
  const labels = isES ? CATEGORY_LABELS_ES : CATEGORY_LABELS;

  const categories = Array.from(new Set(guides.map((g) => g.category))).filter(
    (c) => CATEGORY_LABELS[c]
  );

  const [selected, setSelected] = useState<string>("all");

  const filtered = selected === "all" ? guides : guides.filter((g) => g.category === selected);

  return (
    <div className="space-y-8">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelected("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selected === "all"
              ? "bg-[hsl(var(--custom))] text-white shadow-md"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {isES ? "Todos" : "All"}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selected === cat
                ? "bg-[hsl(var(--custom))] text-white shadow-md"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {labels[cat] ?? cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-16">
          {isES ? "No hay guías disponibles en esta categoría." : "No guides available in this category."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((guide) => (
            <Link
              key={guide._id}
              href={`/lead-magnets/${guide.slug}` as never}
              className="group flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200"
            >
              {/* Cover image */}
              <div className="relative h-44 bg-gray-100 dark:bg-gray-700 overflow-hidden">
                {guide.coverImage?.asset?.url ? (
                  <Image
                    src={guide.coverImage.asset.url}
                    alt={guide.coverImage.alt ?? guide.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.05)]">
                    <Download className="w-10 h-10 text-[hsl(var(--custom)/0.4)]" />
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="inline-block bg-white/90 dark:bg-gray-900/90 text-[hsl(var(--custom))] text-xs font-semibold px-2.5 py-1 rounded-full">
                    {labels[guide.category] ?? guide.category}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 p-5 gap-3">
                <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug group-hover:text-[hsl(var(--custom))] transition-colors line-clamp-2">
                  {guide.title}
                </h3>
                {guide.subtitle && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{guide.subtitle}</p>
                )}
                <div className="mt-auto pt-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
                  {guide.downloadCount > 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {guide.downloadCount.toLocaleString()} {isES ? "descargas" : "downloads"}
                    </span>
                  )}
                  <span className="ml-auto text-xs font-semibold text-[hsl(var(--custom))] group-hover:underline">
                    {isES ? "Descargar gratis →" : "Download free →"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
