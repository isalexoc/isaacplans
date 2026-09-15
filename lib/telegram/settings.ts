/**
 * Small pieces of Telegram pipeline state that outlive a request: the learned admin chat id, the
 * business-connection record, and notification rate-limit stamps.
 *
 * Uses the existing generic `app_settings` key/value table rather than a new one — these are a
 * handful of scalars, not a business record.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

const PREFIX = "telegram_";

export async function getTelegramSetting(key: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, `${PREFIX}${key}`))
      .limit(1);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setTelegramSetting(key: string, value: string): Promise<void> {
  try {
    await db
      .insert(appSettings)
      .values({ key: `${PREFIX}${key}`, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  } catch (err) {
    console.warn("[TELEGRAM_LEADS] setTelegramSetting failed (non-fatal)", { key, error: String(err) });
  }
}

export type TelegramBusinessConnection = {
  id: string;
  userChatId: string | null;
  isEnabled: boolean;
  updatedAt: string;
};

export async function getBusinessConnection(): Promise<TelegramBusinessConnection | null> {
  const raw = await getTelegramSetting("business_connection");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TelegramBusinessConnection;
  } catch {
    return null;
  }
}

export async function setBusinessConnection(
  connection: Omit<TelegramBusinessConnection, "updatedAt">
): Promise<void> {
  await setTelegramSetting(
    "business_connection",
    JSON.stringify({ ...connection, updatedAt: new Date().toISOString() })
  );
}
