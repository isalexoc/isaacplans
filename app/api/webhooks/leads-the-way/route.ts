import { NextResponse, after, type NextRequest } from "next/server";
import {
  getLeadsTheWayConfig,
  isLeadsTheWayConfigured,
} from "@/lib/leads-the-way/config";
import { createLeadsTheWayLogger } from "@/lib/leads-the-way/log";
import { htmlToText, parseLeadEmail } from "@/lib/leads-the-way/parse";
import { enqueueLead } from "@/lib/leads-the-way/store";
import {
  LEADS_THE_WAY_QUEUE_PATH,
  deriveLeadKey,
  processLeadJobById,
  toE164,
} from "@/lib/leads-the-way/process";
import { publishJob } from "@/lib/qstash/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Webhook only enqueues; the QStash consumer (or fallback) does the CRM work. */
export const maxDuration = 60;

/**
 * Inbound "Leads the Way" (Senior Life) order-confirmation email → queue job → CRM upsert.
 *
 * URL:  https://www.isaacplans.com/api/webhooks/leads-the-way?token=<LEADS_THE_WAY_WEBHOOK_SECRET>
 * Body: SendGrid Inbound Parse multipart/form-data (from, subject, text, html) — JSON also accepted.
 */

function verifySecret(req: NextRequest, secret: string | null): boolean {
  if (!secret) return false;
  const token = req.nextUrl.searchParams.get("token");
  if (token && token === secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.headers.get("x-ltw-secret") === secret) return true;
  return false;
}

type InboundEmail = { from: string; subject: string; text: string };

async function readInbound(req: NextRequest): Promise<InboundEmail> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    const text = String(form.get("text") ?? "");
    const html = String(form.get("html") ?? "");
    return {
      from: String(form.get("from") ?? ""),
      subject: String(form.get("subject") ?? ""),
      text: text.trim() ? text : html ? htmlToText(html) : "",
    };
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = String(body.text ?? body.body ?? "");
  const html = String(body.html ?? "");
  return {
    from: String(body.from ?? ""),
    subject: String(body.subject ?? ""),
    text: text.trim() ? text : html ? htmlToText(html) : "",
  };
}

export async function POST(req: NextRequest) {
  const config = getLeadsTheWayConfig();
  const log = createLeadsTheWayLogger(config.debug);

  if (!verifySecret(req, config.webhookSecret)) {
    log.warn("Inbound email unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { from, subject, text } = await readInbound(req);

  // Gmail forwarding-address verification: `ltw@parse.isaacplans.com` has no inbox (it routes here),
  // so surface Google's confirmation code/link in the logs. Runs even while the feature is disabled.
  if (/forwarding-noreply@google\.com/i.test(from) || /forwarding confirmation/i.test(subject)) {
    const code = text.match(/\b\d{6,12}\b/)?.[0] ?? null;
    const url = text.match(/https:\/\/mail\.google\.com\/\S+/)?.[0] ?? null;
    log.info("Gmail forwarding confirmation received — use this code/link to verify the address", {
      code,
      url,
      subject,
    });
    return NextResponse.json({ received: true, gmailConfirmation: true, code });
  }

  if (!config.enabled) {
    return NextResponse.json({ received: true, skipped: "disabled" });
  }
  if (!text.trim()) {
    return NextResponse.json({ received: true, skipped: "empty_body" });
  }

  // Only accept mail from the known Senior Life / Leads the Way senders.
  const fromLower = from.toLowerCase();
  const senderOk = config.allowedSenders.some((s) => fromLower.includes(s));
  if (!senderOk) {
    log.warn("Inbound email from disallowed sender", { from });
    return NextResponse.json({ received: true, skipped: "sender_not_allowed" });
  }

  const parsed = parseLeadEmail(text);
  const phoneE164 = toE164(parsed.phone);
  const leadKey = deriveLeadKey(parsed, { from, subject, rawText: text });

  const enq = await enqueueLead(
    {
      leadKey,
      phone: phoneE164,
      email: parsed.email ?? null,
      leadId: parsed.leadId ?? null,
      jobState: {
        step: "parse",
        rawText: text,
        from,
        subject,
        parsed: { ...parsed } as Record<string, string | undefined>,
      },
    },
    log
  );

  log.info("Inbound lead accepted", {
    leadKey,
    queued: enq.queued,
    reason: enq.reason,
    hasPhone: Boolean(phoneE164),
    leadId: parsed.leadId,
  });

  if (enq.queued) {
    const origin = req.nextUrl.origin;
    after(async () => {
      // Event-driven: hand the job to QStash (retries + Neon stays idle). Fall back to inline
      // processing when QStash is disabled or the publish fails.
      const published = await publishJob({
        path: LEADS_THE_WAY_QUEUE_PATH,
        body: { messageId: leadKey },
        requestOrigin: origin,
        retries: 3,
      });
      if (!published) {
        await processLeadJobById(leadKey, log);
      }
    });
  }

  return NextResponse.json({ received: true, queued: enq.queued, leadKey, skipped: enq.reason });
}

export function GET() {
  const config = getLeadsTheWayConfig();
  return NextResponse.json({
    ok: true,
    route: "leads-the-way-inbound",
    enabled: config.enabled,
    configured: isLeadsTheWayConfigured(config),
    aiFallback: config.aiFallback,
    debug: config.debug,
  });
}
