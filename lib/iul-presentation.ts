import { cache } from "react";
import { sanityFetch } from "@/sanity/lib/live";
import { urlFor } from "@/sanity/lib/image";

/**
 * Read path for the /iul/presentation slide deck.
 *
 * The whole deck lives in one Sanity singleton (_id: "iulPresentation") where
 * every user-visible string is an `xEn`/`xEs` field pair. `mapIulPresentation`
 * collapses those pairs to the requested locale and resolves Sanity image
 * references to plain `{ url, alt }` objects, so the client slide components
 * receive serializable data in the same shape the old message JSON had.
 */

export const IUL_PRESENTATION_QUERY = `*[_type == "iulPresentation" && _id == "iulPresentation"][0]`;

export type IulLocale = "en" | "es";

export interface IulSlideData {
  key: string;
  type: string;
  data: Record<string, unknown>;
}

export interface IulPresentationContent {
  meta: Record<string, string>;
  ui: Record<string, string>;
  labels: Record<string, string>;
  slides: IulSlideData[];
}

/** Sanity object _type → the dispatch type used by IULSlideContent. */
const SLIDE_TYPE_BY_SANITY_TYPE: Record<string, string> = {
  iulSlideAgent: "agent",
  iulSlideDiscovery: "discovery",
  iulSlideRetirementProduct: "retirementProduct",
  iulSlideScenario: "scenario",
  iulSlideBank: "bank",
  iulSlideBankExample: "bankExample",
  iulSlideBankCosts: "bankCosts",
  iulSlideBankTeaser: "bankTeaser",
  iulSlideIulHero: "iulHero",
  iulSlideIulWho: "iulWho",
  iulSlideIulComparison: "iulComparison",
  iulSlideIulStructure: "iulStructure",
  iulSlideIulIndexing: "iulIndexing",
  iulSlideIulTerms: "iulTerms",
  iulSlideIulNotInvested: "iulNotInvested",
  iulSlideIulHowItWorks: "iulHowItWorks",
  iulSlideIulIllustrationCta: "iulIllustrationCTA",
  iulSlideCompany: "company",
};

interface SanityDoc {
  meta?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  labels?: Record<string, unknown>;
  slides?: (Record<string, unknown> & { _type: string; _key: string })[];
}

function isImageValue(value: Record<string, unknown>): boolean {
  const asset = value.asset as { _ref?: string } | undefined;
  return typeof asset?._ref === "string";
}

/**
 * Recursively collapse `{ xEn, xEs }` pairs to `x` for the locale (falling
 * back to English when the Spanish value is missing), resolve image
 * references to `{ url, alt }`, and drop Sanity `_type`/`_key` metadata.
 */
function localize(value: unknown, locale: IulLocale): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => localize(item, locale));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  const source = value as Record<string, unknown>;

  if (isImageValue(source)) {
    const altEn = typeof source.altEn === "string" ? source.altEn : "";
    const altEs = typeof source.altEs === "string" ? source.altEs : "";
    return {
      url: urlFor(source as Parameters<typeof urlFor>[0]).url(),
      alt: locale === "es" ? altEs || altEn : altEn,
    };
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (key.startsWith("_")) continue;
    if (key.endsWith("Es") && `${key.slice(0, -2)}En` in source) continue;
    if (key.endsWith("En") && `${key.slice(0, -2)}Es` in source) {
      const base = key.slice(0, -2);
      const localized = locale === "es" ? source[`${base}Es`] ?? entry : entry;
      result[base] = localize(localized, locale);
      continue;
    }
    result[key] = localize(entry, locale);
  }
  return result;
}

export function mapIulPresentation(
  doc: Record<string, unknown>,
  locale: IulLocale,
  extras?: { licenseStates?: { code: string; name: string }[] }
): IulPresentationContent {
  const sanityDoc = doc as SanityDoc;

  const slides: IulSlideData[] = (sanityDoc.slides ?? []).map((slide, index) => {
    const type = SLIDE_TYPE_BY_SANITY_TYPE[slide._type] ?? slide._type;
    const data = localize(slide, locale) as Record<string, unknown>;
    data.type = type;
    if (type === "agent" && extras?.licenseStates) {
      data.states = extras.licenseStates;
    }
    return { key: slide._key ?? `slide${index + 1}`, type, data };
  });

  return {
    meta: (localize(sanityDoc.meta ?? {}, locale) ?? {}) as Record<string, string>,
    ui: (localize(sanityDoc.ui ?? {}, locale) ?? {}) as Record<string, string>,
    labels: (localize(sanityDoc.labels ?? {}, locale) ?? {}) as Record<string, string>,
    slides,
  };
}

/** Shared fetch for the page + generateMetadata (deduped per request). */
export const getIulPresentation = cache(async (): Promise<Record<string, unknown> | null> => {
  const { data } = await sanityFetch({
    query: IUL_PRESENTATION_QUERY,
    tags: ["iul-presentation"],
  });
  return (data as Record<string, unknown> | null) ?? null;
});
