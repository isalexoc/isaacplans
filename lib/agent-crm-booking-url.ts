/**
 * Build Agent CRM booking widget URLs with optional prefill query params.
 * Omits empty values — passing `first_name=&email=` can break some embeds.
 */
export type AgentCrmBookingPrefill = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

export function appendAgentCrmBookingPrefill(
  baseUrl: string,
  prefill: AgentCrmBookingPrefill
): string {
  const qs = new URLSearchParams();
  const pairs: [string, string | undefined][] = [
    ["first_name", prefill.first_name],
    ["last_name", prefill.last_name],
    ["email", prefill.email],
    ["phone", prefill.phone],
  ];
  for (const [key, value] of pairs) {
    const t = value?.trim();
    if (t) qs.set(key, t);
  }
  const s = qs.toString();
  return s ? `${baseUrl}?${s}` : baseUrl;
}
