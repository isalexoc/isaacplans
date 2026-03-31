export const BLOG_CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  aca: { en: "ACA / Obamacare", es: "ACA / Obamacare" },
  "temporary-health-insurance": {
    en: "Temporary health insurance",
    es: "Seguro médico temporal",
  },
  /** @deprecated Legacy Sanity value — same display as temporary-health-insurance */
  "short-term-medical": {
    en: "Temporary health insurance",
    es: "Seguro médico temporal",
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
