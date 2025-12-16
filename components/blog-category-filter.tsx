"use client";

import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";

const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  'aca': { en: 'ACA / Obamacare', es: 'ACA / Obamacare' },
  'short-term-medical': { en: 'Short Term Medical', es: 'Seguro Médico de Corto Plazo' },
  'dental-vision': { en: 'Dental & Vision', es: 'Dental y Visión' },
  'hospital-indemnity': { en: 'Hospital Indemnity', es: 'Indemnización Hospitalaria' },
  'iul': { en: 'IUL', es: 'IUL' },
  'final-expense': { en: 'Final Expense', es: 'Gastos Finales' },
  'cancer-plans': { en: 'Cancer Plans', es: 'Planes de Cáncer' },
  'heart-stroke': { en: 'Heart & Stroke', es: 'Corazón y Derrame' },
  'general': { en: 'General Insurance', es: 'Seguro General' },
  'tips-guides': { en: 'Tips & Guides', es: 'Consejos y Guías' },
  'news': { en: 'Industry News', es: 'Noticias de la Industria' },
};

interface BlogCategoryFilterProps {
  categories: string[];
}

export function BlogCategoryFilter({ categories }: BlogCategoryFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  // Check if we're on a category page
  const categoryMatch = pathname.match(/\/blog\/category\/([^\/]+)/);
  const currentCategory = categoryMatch ? categoryMatch[1] : null;

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'all') {
      router.push(`/${locale}/blog`);
    } else {
      router.push(`/${locale}/blog/category/${value}`);
    }
  };

  // Filter categories to only show those that have posts available
  // Sort them alphabetically by their label
  const availableCategories = categories
    .filter((cat) => CATEGORY_LABELS[cat]) // Only include categories we have labels for
    .sort((a, b) => {
      const labelA = CATEGORY_LABELS[a]?.[locale as 'en' | 'es'] || a;
      const labelB = CATEGORY_LABELS[b]?.[locale as 'en' | 'es'] || b;
      return labelA.localeCompare(labelB);
    });

  return (
    <div className="mb-8 flex justify-center">
      <div className="relative w-full max-w-md">
        <label htmlFor="category-select" className="sr-only">
          {locale === 'en' ? 'Filter by category' : 'Filtrar por categoría'}
        </label>
        <select
          id="category-select"
          value={currentCategory || 'all'}
          onChange={handleCategoryChange}
          className="w-full px-4 py-3 pr-10 text-base font-medium bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer transition-colors hover:border-blue-400 dark:hover:border-blue-500"
        >
          <option value="all">
            {locale === 'en' ? 'All Posts' : 'Todas las Publicaciones'}
          </option>
          {availableCategories.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]?.[locale as 'en' | 'es'] || category}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-500 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

