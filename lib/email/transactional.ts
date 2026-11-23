/**
 * The agent platform's own emails (alerts to agents today; client emails later), sent through
 * Resend's REST API with fetch. Not Nodemailer's `EMAIL_*`: that is Isaac's own mailbox and brand.
 *
 * Env (both required; without them every send is skipped, with one log line per process):
 *  - `RESEND_API_KEY`: a Resend API key with sending access (secret; never in code).
 *  - `PLATFORM_EMAIL_FROM`: the sender, on the domain verified in Resend, e.g.
 *    `Health sharing guide <notifications@<product domain>>`.
 *
 * Server-only. Logs never carry a recipient, a subject or a body: only the outcome and a status.
 */

import "server-only";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string | null;
};

export type TransactionalResult =
  | { status: "sent"; id: string | null }
  /** Not configured on this deployment: nothing was sent, by design. */
  | { status: "skipped" }
  | { status: "failed"; retryable: boolean; httpStatus: number | null };

let warnedUnconfigured = false;

function resendConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PLATFORM_EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

/** Can this deployment send the platform's emails? Says why not once per process. */
export function transactionalEmailConfigured(): boolean {
  if (resendConfig()) return true;
  if (!warnedUnconfigured) {
    warnedUnconfigured = true;
    console.warn("[email] RESEND_API_KEY or PLATFORM_EMAIL_FROM is not set: the platform's emails are skipped.");
  }
  return false;
}

export async function sendTransactionalEmail(email: TransactionalEmail): Promise<TransactionalResult> {
  const config = resendConfig();
  if (!config) {
    transactionalEmailConfigured();
    return { status: "skipped" };
  }

  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.html ? { html: email.html } : {}),
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("[email] Resend request failed:", error instanceof Error ? error.name : "error");
    return { status: "failed", retryable: true, httpStatus: null };
  }

  if (response.ok) {
    const json = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return { status: "sent", id: typeof json?.id === "string" ? json.id : null };
  }
  // 429 and 5xx are worth another try; any other 4xx (a bad key, an unverified sender domain, a
  // malformed address) will fail the same way again.
  const retryable = response.status === 429 || response.status >= 500;
  console.warn(`[email] Resend answered ${response.status}${retryable ? " (will retry)" : ""}.`);
  return { status: "failed", retryable, httpStatus: response.status };
}
