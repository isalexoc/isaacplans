"use client";

import { useState, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, BookOpen, TrendingUp, Sparkles, Download, Filter } from "lucide-react";
import { GuideCard, type Guide } from "./guide-card";
import { useSearchParams } from "next/navigation";

const CATEGORIES = [
  { id: 'aca', icon: FileText, color: 'blue' },
  { id: 'shortTerm', icon: BookOpen, color: 'green' },
  { id: 'dentalVision', icon: FileText, color: 'purple' },
  { id: 'hospitalIndemnity', icon: FileText, color: 'orange' },
  { id: 'iul', icon: TrendingUp, color: 'indigo' },
  { id: 'finalExpense', icon: FileText, color: 'red' },
] as const;

// Mock guides data - Replace with database fetch
// In production, fetch from /api/guides endpoint
const MOCK_GUIDES: Guide[] = [
  // ACA Guides - Only one guide for now
  {
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
  },
];

function ConsumerGuidesContent() {
  const t = useTranslations("consumerGuidesPage");
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const searchParams = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get('category') || 'all'
  );
  const [guides] = useState<Guide[]>(MOCK_GUIDES);

  const filteredGuides = selectedCategory === 'all' 
    ? guides 
    : guides.filter(g => g.category === selectedCategory);

  const categoryGuides = CATEGORIES.map(cat => ({
    ...cat,
    guides: guides.filter(g => g.category === cat.id),
    count: guides.filter(g => g.category === cat.id).length
  }));

  return (
    <main className="w-full flex flex-col overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-gradient-to-br from-blue-500 to-purple-500 p-4 shadow-lg">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            {t("hero.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-700 dark:text-gray-300 mb-6">
            {t("hero.description")}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>{guides.length} {isES ? "Guías Disponibles" : "Available Guides"}</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{CATEGORIES.length} {isES ? "Categorías" : "Categories"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-8 bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {isES ? "Explorar Guías" : "Browse Guides"}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {isES 
                  ? "Filtra por categoría para encontrar la guía que necesitas"
                  : "Filter by category to find the guide you need"}
              </p>
            </div>
            <div className="w-full sm:w-auto sm:min-w-[280px]">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full h-12 text-base bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 focus:border-blue-500 dark:focus:border-blue-500 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <SelectValue placeholder={isES ? "Seleccionar categoría" : "Select category"} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-base py-3 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <span className="font-medium">{t("categories.all")}</span>
                      <span className="ml-auto text-sm text-gray-500">
                        ({guides.length})
                      </span>
                    </div>
                  </SelectItem>
                  {CATEGORIES.map((category) => {
                    const Icon = category.icon;
                    const categoryT = t(`categories.${category.id}`);
                    const count = categoryGuides.find(c => c.id === category.id)?.count || 0;
                    return (
                      <SelectItem 
                        key={category.id} 
                        value={category.id}
                        className="text-base py-3 cursor-pointer"
                        disabled={count === 0}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <Icon className={`w-5 h-5 ${
                            category.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                            category.color === 'green' ? 'text-green-600 dark:text-green-400' :
                            category.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                            category.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                            category.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                            'text-red-600 dark:text-red-400'
                          }`} />
                          <span className="font-medium flex-1">{categoryT}</span>
                          <span className={`text-sm ${
                            count === 0 ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            ({count})
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Guides Display */}
          <div className="mt-8">
            {selectedCategory === 'all' ? (
              <div className="space-y-12">
                {categoryGuides.map((category) => {
                  if (category.count === 0) return null;
                  const Icon = category.icon;
                  return (
                    <div key={category.id} className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          category.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/20' :
                          category.color === 'green' ? 'bg-green-100 dark:bg-green-900/20' :
                          category.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/20' :
                          category.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/20' :
                          category.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/20' :
                          'bg-red-100 dark:bg-red-900/20'
                        }`}>
                          <Icon className={`w-6 h-6 ${
                            category.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                            category.color === 'green' ? 'text-green-600 dark:text-green-400' :
                            category.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                            category.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                            category.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                            'text-red-600 dark:text-red-400'
                          }`} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {t(`categories.${category.id}`)}
                        </h2>
                        <span className="text-sm text-gray-500">
                          ({category.count} {isES ? "guías" : "guides"})
                        </span>
                      </div>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                        {category.guides.map((guide) => (
                          <GuideCard
                            key={guide.id}
                            guide={guide}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                {filteredGuides.length > 0 ? (
                  <>
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {t(`categories.${selectedCategory}`)} {t("guides.title")}
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400">
                        {t("guides.description", { category: t(`categories.${selectedCategory}`) })}
                      </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                      {filteredGuides.map((guide) => (
                        <GuideCard
                          key={guide.id}
                          guide={guide}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16">
                    <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-lg text-gray-500 dark:text-gray-400">
                      {isES 
                        ? "No hay guías disponibles en esta categoría por el momento."
                        : "No guides available in this category at the moment."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-xl">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {t("cta.title")}
              </h2>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                {t("cta.description")}
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span>{t("cta.benefits.0")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-500" />
                  <span>{t("cta.benefits.1")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-green-500" />
                  <span>{t("cta.benefits.2")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

export default function ConsumerGuidesClient() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    }>
      <ConsumerGuidesContent />
    </Suspense>
  );
}

