/**
 * On-image text for the sticker. This is rendered in the per-sticker language
 * (data.language), NOT the site locale, so it lives here rather than in next-intl.
 */
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import type { ClientTitle, LeadSourceKey, SaleType, StickerLanguage } from "@/lib/sale-sticker";

type StickerStrings = {
  saleHeadline: string;
  saleOfDay: (n: number) => string; // e.g. "Sale #3 of the day"
  saleNumberShort: (n: number) => string; // e.g. "SALE #3"
  numberBadgeLabel: string; // small caption under the big number
  saleType: Record<SaleType, string>;
  leadSourceLabel: Record<LeadSourceKey, string>;
  leadSourcePrefix: string;
  clientPrefix: string;
  clientTitle: Record<ClientTitle, string>; // prefix before the client name
  protectedWith: (title: ClientTitle) => string; // gender-aware tagline
  motivationalPhrase: string; // always-present team line
};

export const SALE_STICKER_STRINGS: Record<StickerLanguage, StickerStrings> = {
  en: {
    saleHeadline: "SALE!",
    saleOfDay: (n) => `Sale #${n} of the day`,
    saleNumberShort: (n) => `SALE #${n}`,
    numberBadgeLabel: "of the day",
    saleType: {
      in_person: "In Person",
      telesales: "Telesales",
    },
    leadSourceLabel: {
      live_transfer: "Live Transfer",
      facebook: "Facebook Lead",
      organic: "Organic Lead",
      cold: "Cold Lead",
      referral: "Referral",
      returning: "Returning Client",
      other: "",
    },
    leadSourcePrefix: "Lead",
    clientPrefix: "Client",
    clientTitle: { mr: "Mr.", mrs: "Mrs." },
    protectedWith: () => "Protected with the best company in the nation",
    motivationalPhrase: "Thanks team, let's go for more",
  },
  es: {
    saleHeadline: "¡VENTA!",
    saleOfDay: (n) => `Venta #${n} del día`,
    saleNumberShort: (n) => `VENTA #${n}`,
    numberBadgeLabel: "del día",
    saleType: {
      in_person: "En Persona",
      telesales: "Televenta",
    },
    leadSourceLabel: {
      live_transfer: "Transferencia en Vivo",
      facebook: "Lead de Facebook",
      organic: "Lead Orgánico",
      cold: "Lead Frío",
      referral: "Referido",
      returning: "Cliente Recurrente",
      other: "",
    },
    leadSourcePrefix: "Lead",
    clientPrefix: "Cliente",
    clientTitle: { mr: "El Señor", mrs: "La Señora" },
    protectedWith: (title) =>
      title === "mrs"
        ? "Protegida con la mejor compañía de la nación"
        : "Protegido con la mejor compañía de la nación",
    motivationalPhrase: "Gracias equipo, vamos por más",
  },
};

/** Resolve the displayed lead-source label, falling back to the custom text for "other". */
export function resolveLeadSourceLabel(
  language: StickerLanguage,
  leadSource: LeadSourceKey,
  leadSourceCustom: string
): string {
  if (leadSource === "other") return leadSourceCustom.trim();
  return SALE_STICKER_STRINGS[language].leadSourceLabel[leadSource];
}

/** Format the sale date for the sticker in the chosen language. */
export function formatStickerDate(saleDate: string, language: StickerLanguage): string {
  // saleDate is YYYY-MM-DD (local). Parse as a local date to avoid TZ drift.
  const [y, m, d] = saleDate.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return saleDate;
  const date = new Date(y, m - 1, d);
  return format(date, language === "es" ? "d 'de' MMMM, yyyy" : "MMMM d, yyyy", {
    locale: language === "es" ? es : enUS,
  });
}
