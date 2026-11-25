/**
 * How an agent with no CRM hands a link to a client: the message typed in for them (naming the
 * agent and the product), and the WhatsApp (wa.me) and SMS (sms:) links that open the agent's OWN
 * phone with it. Nothing here sends anything, and nothing goes through Isaac's CRM.
 *
 * Mirrors lib/tenancy/delivery.ts on the (unmerged) agent-platform pilot branch, generalized to a
 * product noun and a meeting link, so the two can fold together later.
 *
 * Browser-safe and free of imports beyond types; pure, so `pnpm test:staff-access` covers it.
 */

export type DeliveryKind = "application" | "secure" | "meeting";
export type DeliveryLocale = "en" | "es";

/** A value as it may go into a message: one line, no control characters, at most 60 characters. */
function cleanText(value: string | null | undefined): string {
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
  return cleanText(fullName).split(" ")[0] ?? "";
}

/**
 * The text typed in for the client: a greeting (with their first name when known), the agent's
 * name, what the link is, and the link itself at the end. `product` names the application, e.g.
 * "su solicitud de LegalShield". Spanish uses "usted", like the forms.
 */
export function deliveryMessage(
  kind: DeliveryKind,
  locale: DeliveryLocale,
  input: { agentName: string; product: string; clientFirstName?: string | null; url: string }
): string {
  const agent = cleanText(input.agentName);
  const first = cleanText(input.clientFirstName);
  const product = cleanText(input.product);
  const url = input.url.trim();
  if (locale === "es") {
    const hello = `Hola${first ? ` ${first}` : ""}${agent ? `, le saluda ${agent}` : ""}.`;
    if (kind === "application") return `${hello} Este es el enlace a ${product}: ${url}`;
    if (kind === "secure") {
      return `${hello} Este es su enlace privado para escribir sus datos en su propio teléfono. Funciona una sola vez: ${url}`;
    }
    return `${hello} Para ver la presentación en su pantalla, abra este enlace: ${url}`;
  }
  const hello = `Hi${first ? ` ${first}` : ""}${agent ? `, this is ${agent}` : ""}.`;
  if (kind === "application") return `${hello} Here is the link to ${product}: ${url}`;
  if (kind === "secure") {
    return `${hello} Here is your private link to type your details on your own phone. It works once: ${url}`;
  }
  return `${hello} To see the presentation on your screen, open this link: ${url}`;
}

/**
 * A client's phone as the digits wa.me and sms: take: a US or Canada number gets its 1 in front
 * ("(540) 555-0100" → "15405550100"); a number typed with "+" keeps its country code. Anything else
 * (too short, a typo) is null, and the buttons then open without a recipient.
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
