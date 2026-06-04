import type { BlogCategory, CTASettings } from "./types";

export type CTADefaults = Omit<CTASettings, "enableCTA">;

export const CATEGORY_CTA: Record<BlogCategory, CTADefaults> = {
  aca:                          { ctaType: "quote",        ctaText: "Get Your Free ACA Quote",            ctaPosition: "bottom" },
  "temporary-health-insurance": { ctaType: "quote",        ctaText: "Get a Free Short-Term Health Quote", ctaPosition: "bottom" },
  "dental-vision":              { ctaType: "quote",        ctaText: "Get Your Dental & Vision Quote",     ctaPosition: "bottom" },
  "hospital-indemnity":         { ctaType: "quote",        ctaText: "Get Your Free Coverage Quote",       ctaPosition: "bottom" },
  iul:                          { ctaType: "consultation", ctaText: "Schedule a Free IUL Consultation",   ctaPosition: "bottom" },
  "final-expense":              { ctaType: "quote",        ctaText: "Get Your Final Expense Quote",       ctaPosition: "bottom" },
  "cancer-plans":               { ctaType: "quote",        ctaText: "Get Your Cancer Plan Quote",         ctaPosition: "bottom" },
  "heart-stroke":               { ctaType: "quote",        ctaText: "Get Your Coverage Quote",            ctaPosition: "bottom" },
  general:                      { ctaType: "consultation", ctaText: "Schedule a Free Consultation",       ctaPosition: "bottom" },
  "tips-guides":                { ctaType: "consultation", ctaText: "Talk to an Insurance Expert",        ctaPosition: "bottom" },
  news:                         { ctaType: "consultation", ctaText: "Get Expert Insurance Advice",        ctaPosition: "bottom" },
};

export function getDefaultCTA(category: BlogCategory): CTASettings {
  return { enableCTA: true, ...CATEGORY_CTA[category] };
}
