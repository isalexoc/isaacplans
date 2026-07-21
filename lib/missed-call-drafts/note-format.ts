import { NOTE_SEPARATOR, toBoldSans, formatLocalizedDate } from "@/lib/call-summary-note-format";
import type { CallLanguage } from "@/lib/call-summary-structured";

const LABELS = {
  en: { sms: "SMS", whatsapp: "WHATSAPP", footer: "Generated after a missed call — review before sending." },
  es: { sms: "SMS", whatsapp: "WHATSAPP", footer: "Generado después de una llamada perdida — revisa antes de enviar." },
} satisfies Record<CallLanguage, Record<string, string>>;

/**
 * Note body for the missed-call draft note. Mirrors the call-summary note's
 * visual style (separator, bold labels) so it reads consistently in GHL.
 */
export function formatMissedCallDraftNote(
  drafts: { sms: string; whatsapp: string },
  language: CallLanguage,
  meta: { dateAdded?: string; reason: string }
): string {
  const t = LABELS[language];
  const dateLine = formatLocalizedDate(meta.dateAdded, language);

  return [
    `${dateLine} · ${meta.reason}`,
    NOTE_SEPARATOR,
    `📱 ${toBoldSans(t.sms)}`,
    drafts.sms,
    "",
    `💬 ${toBoldSans(t.whatsapp)}`,
    drafts.whatsapp,
    NOTE_SEPARATOR,
    t.footer,
  ].join("\n");
}
