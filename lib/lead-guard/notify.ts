import "server-only";

import { sendTelegramMessage } from "@/lib/telegram/api";
import { getTelegramLeadsConfig } from "@/lib/telegram/config";
import { resolveAdminChatId } from "@/lib/telegram/notify";

import type { LeadGuardReason } from "./assess";
import type { LeadGuardSurface } from "./constants";
import { REASON_LABELS, SURFACE_LABELS } from "./labels";
import { heldLeadsSummary, holdAlertsSentSince, markHoldNotified, type LeadHoldPreview } from "./store";

/**
 * Telegram lines to Isaac about held website leads, in Spanish. Same chat as the Telegram-lead
 * alerts: TELEGRAM_ADMIN_CHAT_ID, else the chat learned during setup (these alerts carry no
 * buttons, so a learned chat is acceptable here, unlike the AI Setter's cards).
 *
 * One line per hold, immediately — except past 6 lines in an hour (a flood): then only the daily
 * digest from the reconcile cron reports, so a bot can never bury the chat. PII-minimal: the first
 * name (letters only), the phone's last 4, the email domain. Never throws.
 */

const FLOOD_WINDOW_MS = 60 * 60_000;
const FLOOD_MAX_ALERTS = 6;
const SEND_TIMEOUT_MS = 8_000;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.isaacplans.com";
export const LEAD_HOLDS_ADMIN_PATH = "/es/admin/lead-holds";

/** Letters only, first two words, 30 characters: a link typed into a name never reaches the chat. */
function cleanFirstName(value: string | null): string | null {
  if (!value || value.includes("@")) return null;
  const words = value
    .replace(/[^\p{L}\p{M}'’-]+/gu, " ")
    .split(" ")
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2);
  const out = words.join(" ").slice(0, 30).trim();
  return out || null;
}

async function send(text: string): Promise<boolean> {
  const config = getTelegramLeadsConfig();
  if (!config.botToken) {
    console.warn("[lead-guard] alert skipped: TELEGRAM_BOT_TOKEN not set");
    return false;
  }
  const chatId = await resolveAdminChatId(config);
  if (!chatId) {
    console.warn("[lead-guard] alert skipped: no TELEGRAM_ADMIN_CHAT_ID and no learned admin chat");
    return false;
  }
  return Promise.race([
    sendTelegramMessage(chatId, text, config),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SEND_TIMEOUT_MS)),
  ]);
}

export async function notifyLeadHeld(input: {
  holdId: string;
  surface: LeadGuardSurface;
  reasons: LeadGuardReason[];
  preview: LeadHoldPreview;
}): Promise<void> {
  try {
    if ((await holdAlertsSentSince(FLOOD_WINDOW_MS)) >= FLOOD_MAX_ALERTS) {
      console.warn("[lead-guard] alert flood cap reached; the daily digest will report this hold");
      return;
    }
    const p = input.preview;
    const who = [
      cleanFirstName(p.firstName) ?? "(sin nombre)",
      p.phoneLast4 ? `tel ••${p.phoneLast4}` : null,
      p.emailDomain ? `correo @${p.emailDomain.replace(/[^a-z0-9.-]/gi, "")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const reasons = input.reasons.map((r) => REASON_LABELS[r] ?? r).join(" · ");
    const text = [
      "🛡️ Lead del sitio retenido para revisión",
      `Formulario: ${SURFACE_LABELS[input.surface] ?? input.surface}`,
      `Motivo: ${reasons || "revisión"}`,
      who,
      "No recibió email ni SMS automático todavía. Si es real, suéltelo:",
      `${SITE_URL}${LEAD_HOLDS_ADMIN_PATH}`,
    ].join("\n");
    if (await send(text)) await markHoldNotified(input.holdId);
  } catch (err) {
    console.error("[lead-guard] hold alert failed:", err instanceof Error ? err.message : String(err));
  }
}

/** The quarantine fallback ran (the hold could not be stored). */
export async function notifyQuarantined(input: { surface: LeadGuardSurface; reasons: string[]; inCrm: boolean }): Promise<void> {
  try {
    await send(
      [
        "⚠️ Lead del sitio retenido, pero la base de datos no lo pudo guardar.",
        input.inCrm
          ? "Quedó en el CRM con la etiqueta web_review, sin workflows. Revíselo allí."
          : "Tampoco se pudo crear en el CRM: revise los logs de Vercel ([lead-guard]).",
        `Formulario: ${SURFACE_LABELS[input.surface] ?? input.surface} · Motivo: ${input.reasons.join(", ")}`,
      ].join("\n")
    );
  } catch {
    /* never throws */
  }
}

/** Daily reconcile digest: only when something waits. */
export async function sendHeldLeadsDigest(): Promise<{ held: number }> {
  const { held, oldest } = await heldLeadsSummary();
  if (held === 0) return { held };
  const days = oldest ? Math.floor((Date.now() - oldest.getTime()) / (24 * 60 * 60_000)) : 0;
  await send(
    [
      `🛡️ ${held} lead${held === 1 ? "" : "s"} del sitio esperando revisión` +
        (days > 0 ? ` (el más antiguo, hace ${days} día${days === 1 ? "" : "s"})` : "") +
        ".",
      "No recibieron email ni SMS automático. Suelte los reales, descarte el resto:",
      `${SITE_URL}${LEAD_HOLDS_ADMIN_PATH}`,
    ].join("\n")
  );
  return { held };
}
