/**
 * Pure normalization of a raw Telegram `Update` into the handful of fields this pipeline uses.
 * No IO, never throws — so the webhook can classify an update before deciding anything.
 */

export type NormalizedUpdate =
  | {
      kind: "business_connection";
      updateId: string;
      connectionId: string | null;
      userChatId: string | null;
      isEnabled: boolean;
    }
  | {
      kind: "business_message" | "edited_business_message" | "message";
      updateId: string;
      chatId: string | null;
      chatType: string | null;
      messageId: string | null;
      businessConnectionId: string | null;
      text: string;
      messageDate: Date | null;
      fromId: string | null;
    }
  | { kind: "other"; updateId: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeMessage(
  kind: "business_message" | "edited_business_message" | "message",
  updateId: string,
  msg: Record<string, unknown>
): NormalizedUpdate {
  const chat = asRecord(msg.chat);
  const from = asRecord(msg.from);
  const dateSeconds = typeof msg.date === "number" ? msg.date : null;
  // Captions carry the text when the provider sends a photo with the lead written underneath.
  const text =
    (typeof msg.text === "string" && msg.text) ||
    (typeof msg.caption === "string" && msg.caption) ||
    "";

  return {
    kind,
    updateId,
    chatId: idOf(chat?.id),
    chatType: typeof chat?.type === "string" ? chat.type : null,
    messageId: idOf(msg.message_id),
    businessConnectionId: idOf(msg.business_connection_id),
    text,
    messageDate: dateSeconds ? new Date(dateSeconds * 1000) : null,
    fromId: idOf(from?.id),
  };
}

export function normalizeUpdate(raw: unknown): NormalizedUpdate {
  const update = asRecord(raw);
  const updateId = idOf(update?.update_id) ?? "unknown";
  if (!update) return { kind: "other", updateId };

  const connection = asRecord(update.business_connection);
  if (connection) {
    return {
      kind: "business_connection",
      updateId,
      connectionId: idOf(connection.id),
      userChatId: idOf(connection.user_chat_id),
      // Bot API 9.x replaced `is_enabled` with `rights` (absent/empty ⇒ disconnected); accept both.
      isEnabled:
        typeof connection.is_enabled === "boolean"
          ? connection.is_enabled
          : Boolean(connection.rights),
    };
  }

  const businessMessage = asRecord(update.business_message);
  if (businessMessage) return normalizeMessage("business_message", updateId, businessMessage);

  const editedBusiness = asRecord(update.edited_business_message);
  if (editedBusiness) {
    return normalizeMessage("edited_business_message", updateId, editedBusiness);
  }

  const message = asRecord(update.message);
  if (message) return normalizeMessage("message", updateId, message);

  return { kind: "other", updateId };
}
