export const BLOG_CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  aca: { en: "ACA / Obamacare", es: "ACA / Obamacare" },
  "short-term-medical": {
    en: "Short Term Medical",
    es: "Seguro Médico de Corto Plazo",
  },
  "dental-vision": { en: "Dental & Vision", es: "Dental y Visión" },
  "hospital-indemnity": {
    en: "Hospital Indemnity",
    es: "Indemnización Hospitalaria",
  },
  iul: { en: "IUL", es: "IUL" },
  "final-expense": { en: "Final Expense", es: "Gastos Finales" },
  "cancer-plans": { en: "Cancer Plans", es: "Planes de Cáncer" },
  "heart-stroke": { en: "Heart & Stroke", es: "Corazón y Derrame" },
  general: { en: "General Insurance", es: "Seguro General" },
  "tips-guides": { en: "Tips & Guides", es: "Consejos y Guías" },
  news: { en: "Industry News", es: "Noticias de la Industria" },
};

export function getBlogCategoryLabel(
  category: string | undefined,
  locale: string
): string {
  if (!category) return "";
  return (
    BLOG_CATEGORY_LABELS[category]?.[locale as "en" | "es"] ?? category
  );
}
