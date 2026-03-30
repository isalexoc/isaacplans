/** Replace `{{PHONE_NUMBER}}` and `{states}` in legal / policy copy from messages. */
export function interpolateLegalCopy(
  text: string,
  opts: { phone: string; states: string }
): string {
  return text
    .replace(/\{\{PHONE_NUMBER\}\}/g, opts.phone)
    .replace(/\{states\}/g, opts.states);
}
