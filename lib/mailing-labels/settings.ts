import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { DEFAULT_TAGLINES, normalizeStateCode, normalizeZip } from "./format";
import {
  DEFAULT_SHIPPING_PRESET,
  DEFAULT_STICKER_PRESET,
  isLabelPresetId,
  LABEL_PRESETS,
} from "./presets";
import {
  EMPTY_AGENT_OVERRIDE,
  EMPTY_SENDER_ADDRESS,
  type LabelAgentOverride,
  type MailingLabelSettings,
  type SenderAddress,
} from "./types";

/**
 * Tool settings kept in the shared `app_settings` key/value table (same mechanism as
 * lib/page-media/settings.ts) rather than a table of their own — it's two JSON blobs read only
 * by an admin, so a dedicated table would be overhead for nothing.
 *
 * Deliberately NOT cached: every read here happens behind admin auth, so there is no risk of
 * waking Neon from public traffic (see CLAUDE.md "Background Jobs & Cron").
 */

const SENDER_KEY = "mailing_labels_sender";
const DEFAULTS_KEY = "mailing_labels_defaults";
const AGENT_KEY = "mailing_labels_agent";

export const DEFAULT_MAILING_LABEL_SETTINGS: MailingLabelSettings = {
  sender: EMPTY_SENDER_ADDRESS,
  agent: EMPTY_AGENT_OVERRIDE,
  defaults: {
    stickerPreset: DEFAULT_STICKER_PRESET,
    shippingPreset: DEFAULT_SHIPPING_PRESET,
    showLogo: true,
    showAgentContact: true,
    showWhatsapp: true,
    taglines: { ...DEFAULT_TAGLINES },
  },
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSenderAddress(value: unknown): SenderAddress {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    businessName: str(raw.businessName),
    contactName: str(raw.contactName),
    addressLine1: str(raw.addressLine1),
    addressLine2: str(raw.addressLine2),
    city: str(raw.city),
    state: normalizeStateCode(str(raw.state)) || str(raw.state).toUpperCase().slice(0, 2),
    postalCode: normalizeZip(str(raw.postalCode)) || str(raw.postalCode),
    phone: str(raw.phone),
  };
}

export function normalizeAgentOverride(value: unknown): LabelAgentOverride {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    name: str(raw.name),
    phone: str(raw.phone),
    whatsapp: str(raw.whatsapp),
    email: str(raw.email).toLowerCase(),
  };
}

function normalizeDefaults(value: unknown): MailingLabelSettings["defaults"] {
  const raw = (value ?? {}) as Record<string, unknown>;
  const fallback = DEFAULT_MAILING_LABEL_SETTINGS.defaults;
  const taglines = (raw.taglines ?? {}) as Record<string, unknown>;

  const sticker = str(raw.stickerPreset);
  const shipping = str(raw.shippingPreset);

  return {
    stickerPreset:
      isLabelPresetId(sticker) && LABEL_PRESETS[sticker].kind === "sticker"
        ? sticker
        : fallback.stickerPreset,
    shippingPreset:
      isLabelPresetId(shipping) && LABEL_PRESETS[shipping].kind === "shipping"
        ? shipping
        : fallback.shippingPreset,
    showLogo: bool(raw.showLogo, fallback.showLogo),
    showAgentContact: bool(raw.showAgentContact, fallback.showAgentContact),
    showWhatsapp: bool(raw.showWhatsapp, fallback.showWhatsapp),
    taglines: {
      en: str(taglines.en) || fallback.taglines.en,
      es: str(taglines.es) || fallback.taglines.es,
    },
  };
}

function parseJson(value: string | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getMailingLabelSettings(): Promise<MailingLabelSettings> {
  try {
    const rows = await db
      .select({ key: appSettings.key, value: appSettings.value })
      .from(appSettings)
      .where(inArray(appSettings.key, [SENDER_KEY, DEFAULTS_KEY, AGENT_KEY]));

    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      sender: normalizeSenderAddress(parseJson(byKey.get(SENDER_KEY))),
      agent: normalizeAgentOverride(parseJson(byKey.get(AGENT_KEY))),
      defaults: normalizeDefaults(parseJson(byKey.get(DEFAULTS_KEY))),
    };
  } catch (error) {
    // Table not migrated yet, or Neon hiccup — fall back to built-in defaults so the tool
    // still opens and can print (only Priority Mail actually needs the sender).
    console.warn("[mailing-labels] Could not read settings:", error);
    return DEFAULT_MAILING_LABEL_SETTINGS;
  }
}

export async function getSenderAddress(): Promise<SenderAddress> {
  return (await getMailingLabelSettings()).sender;
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value: JSON.stringify(value), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: JSON.stringify(value), updatedAt: new Date() },
    });
}

export async function saveMailingLabelSettings(
  patch: Partial<{ sender: unknown; agent: unknown; defaults: unknown }>
): Promise<MailingLabelSettings | { error: string }> {
  try {
    if (patch.sender !== undefined) {
      await writeSetting(SENDER_KEY, normalizeSenderAddress(patch.sender));
    }
    if (patch.agent !== undefined) {
      await writeSetting(AGENT_KEY, normalizeAgentOverride(patch.agent));
    }
    if (patch.defaults !== undefined) {
      await writeSetting(DEFAULTS_KEY, normalizeDefaults(patch.defaults));
    }
    return await getMailingLabelSettings();
  } catch (error) {
    console.error("[mailing-labels] Could not save settings:", error);
    return {
      error:
        "Could not save. If this is the first use, apply the database migration (pnpm db:migrate).",
    };
  }
}
