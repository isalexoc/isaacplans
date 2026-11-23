/**
 * How an agent hands a link to a client without any CRM: the message typed in for them (in the
 * client's language, Spanish with "usted", naming the agent), and the WhatsApp (wa.me) and SMS
 * (sms:) links that open the agent's own phone with it. Nothing here sends anything: the agent's
 * phone does, from the agent's own number. Never Isaac's CRM.
 *
 * Browser-safe and free of imports (components/agent/delivery-buttons.tsx ships it), pure for
 * `pnpm test:agent-data`.
 */

export type DeliveryKind = "application" | "secure" | "guide";
export type DeliveryLocale = "en" | "es";

/** A name as it may go into a message: one line, no control characters, at most 60 characters. */
function cleanName(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 32 || code === 127 ? " " : ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 60);
}

/** "María López" → "María". */
export function firstNameOf(fullName: string | null | undefined): string {
  return cleanName(fullName).split(" ")[0] ?? "";
}

/**
 * The text typed in for the client: a greeting (with their first name when known), the agent's name,
 * what the link is, and the link itself at the end.
 */
export function deliveryMessage(
  kind: DeliveryKind,
  locale: DeliveryLocale,
  input: { agentName: string; clientFirstName?: string | null; url: string }
): string {
  const agent = cleanName(input.agentName);
  const first = kind === "guide" ? "" : cleanName(input.clientFirstName);
  const url = input.url.trim();
  if (locale === "es") {
    const hello = `Hola${first ? ` ${first}` : ""}${agent ? `, le saluda ${agent}` : ""}.`;
    if (kind === "application") return `${hello} Este es el enlace a su solicitud de cobertura de salud: ${url}`;
    if (kind === "secure") {
      return `${hello} Este es su enlace privado y seguro para escribir sus datos en su propio teléfono. Funciona una sola vez: ${url}`;
    }
    return `${hello} Esta es mi guía: vea los planes, cotice y aplique aquí: ${url}`;
  }
  const hello = `Hi${first ? ` ${first}` : ""}${agent ? `, this is ${agent}` : ""}.`;
  if (kind === "application") return `${hello} Here is the link to your health coverage application: ${url}`;
  if (kind === "secure") {
    return `${hello} Here is your private, secure link to type your details on your own phone. It works once: ${url}`;
  }
  return `${hello} Here is my guide: see the plans, get your quote and apply here: ${url}`;
}

/**
 * A client's phone as the digits wa.me and sms: take: a US or Canada number gets its 1 in front
 * ("(540) 555-0100" → "15405550100"); a number typed with "+" keeps its country code. Anything else
 * (too short, a typo) is null, and the WhatsApp and SMS buttons don't show for it.
 */
export function deliveryPhoneDigits(phone: string | null | undefined): string | null {
  if (typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  if (phone.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return digits;
  return null;
}

/** WhatsApp with the message typed in: to the client's number, or (null) to a contact the agent picks. */
export function whatsappDeliveryHref(digits: string | null, text: string): string {
  return `https://wa.me/${digits ?? ""}?text=${encodeURIComponent(text)}`;
}

/**
 * A text message with the body typed in. `?&body=` is the form both iPhone and Android read; with no
 * number the agent picks the recipient.
 */
export function smsDeliveryHref(digits: string | null, text: string): string {
  return `sms:${digits ? `+${digits}` : ""}?&body=${encodeURIComponent(text)}`;
}
