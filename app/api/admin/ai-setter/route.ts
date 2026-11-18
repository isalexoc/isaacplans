import { NextResponse, type NextRequest } from "next/server";

import type {
  InboxItem,
  InboxResponse,
  LeadItem,
  LeadsResponse,
  PreviewResponse,
  SettingsResponse,
  TemplateItem,
  ThreadResponse,
} from "@/components/admin/ai-setter/api-types";
import { NO_STORE, apiError, requireAdminUser } from "@/lib/aca-confirmation/route-helpers";
import { agentCrmContactUrl } from "@/lib/agent-crm-contacts";
import { getConfigStatus, getSlotPreview, getThreadPreview } from "@/lib/ai-setter/actions";
import { smsSegments } from "@/lib/ai-setter/guard";
import { createAiSetterLogger } from "@/lib/ai-setter/log";
import { PRODUCT_LABELS } from "@/lib/ai-setter/product";
import { aiSetterSettings } from "@/lib/ai-setter/settings";
import { countMessagesSince, getDailyStats, listInbox, listLeads } from "@/lib/ai-setter/store";
import { TEMPLATE_DESCRIPTIONS, templateCatalog } from "@/lib/ai-setter/templates";
import type { LeadRecord, MessageRecord, MessageStatus, ProductLine } from "@/lib/ai-setter/types";
import { localCalendarDateKey } from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const AGENT_TZ = "America/New_York";
const CONTACT_ID_RE = /^[A-Za-z0-9]{10,40}$/;
const INBOX_LIMIT = 100;
const LEADS_LIMIT = 200;
const SEVEN_DAYS_MS = 7 * 86_400_000;
const VIEWS = ["inbox", "leads", "settings", "thread", "preview"] as const;
/** Statuses whose `error` / decision says why the message did not go out. */
const PROBLEM_STATUSES: ReadonlySet<MessageStatus> = new Set(["stale", "blocked", "send_unknown", "failed"]);

type View = (typeof VIEWS)[number];

const DB_FAILURE = "No se pudo leer la base de datos. Si es la primera vez, aplica la migración 0045.";
const FAILURE_TEXT: Record<View, string> = {
  inbox: DB_FAILURE,
  leads: DB_FAILURE,
  settings: DB_FAILURE,
  thread: "No se pudo leer la conversación. Inténtalo de nuevo.",
  preview: "No se pudieron calcular las horas. Inténtalo de nuevo.",
};

const log = createAiSetterLogger();

function parseView(value: string | null): View | null {
  if (value === null || value === "") return "inbox";
  return VIEWS.find((view) => view === value) ?? null;
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function crmLocationId(): string | null {
  return process.env.AGENT_CRM_LOCATION_ID?.trim() || null;
}

function crmUrl(locationId: string | null, contactId: string): string | null {
  return locationId ? agentCrmContactUrl(locationId, contactId) : null;
}

function productLabelEs(product: ProductLine | null): string | null {
  return product ? PRODUCT_LABELS[product].es : null;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

function json<T>(body: T): NextResponse {
  return NextResponse.json(body, { headers: NO_STORE });
}

// ─── Inbox ─────────────────────────────────────────────────────────────────────────────────

/** A short code (never text): the stored error first, else what the compliance decision recorded. */
function problemOf(message: MessageRecord): string | null {
  if (!PROBLEM_STATUSES.has(message.status)) return null;
  if (message.error) return message.error;
  const decision = message.decision ?? {};
  if (typeof decision.blockedBy === "string") return decision.blockedBy;
  return typeof decision.reason === "string" ? decision.reason : null;
}

function toInboxItem(row: MessageRecord & { lead: LeadRecord | null }, locationId: string | null): InboxItem {
  const product = row.lead?.product ?? null;
  return {
    messageId: row.id,
    contactId: row.contactId,
    firstName: row.lead?.firstName ?? null,
    product,
    productLabelEs: productLabelEs(product),
    stateCode: row.lead?.stateCode ?? null,
    language: row.lead?.language ?? null,
    register: row.lead?.register ?? null,
    channel: row.channel,
    kind: row.kind,
    templateId: row.templateId,
    status: row.status,
    body: row.body,
    intent: row.intent,
    guardFlags: row.guardFlags,
    usedFallback: row.usedFallback,
    problem: problemOf(row),
    createdAt: row.createdAt.toISOString(),
    expiresAt: iso(row.expiresAt),
    notBefore: iso(row.notBefore),
    crmUrl: crmUrl(locationId, row.contactId),
    segments: row.channel === "SMS" && row.body ? smsSegments(row.body) : null,
  };
}

async function inboxBody(): Promise<InboxResponse> {
  const rows = await listInbox(INBOX_LIMIT);
  const locationId = crmLocationId();
  return { success: true, items: rows.map((row) => toInboxItem(row, locationId)) };
}

// ─── Leads ─────────────────────────────────────────────────────────────────────────────────

function toLeadItem(lead: LeadRecord, locationId: string | null): LeadItem {
  return {
    contactId: lead.contactId,
    firstName: lead.firstName,
    status: lead.status,
    product: lead.product,
    productLabelEs: productLabelEs(lead.product),
    stateCode: lead.stateCode,
    language: lead.language,
    register: lead.register,
    lastInboundAt: iso(lead.lastInboundAt),
    lastAiOutboundAt: iso(lead.lastAiOutboundAt),
    appointmentAt: iso(lead.appointmentAt),
    offeredLabels: lead.offeredSlots.map((slot) => slot.label),
    pausedUntil: iso(lead.pausedUntil),
    pauseReason: lead.pauseReason,
    optOutPending: lead.optOutPending,
    callNowState: lead.callNowState,
    updatedAt: lead.updatedAt.toISOString(),
    crmUrl: crmUrl(locationId, lead.contactId),
  };
}

async function leadsBody(): Promise<LeadsResponse> {
  const leads = await listLeads({ limit: LEADS_LIMIT });
  const locationId = crmLocationId();
  return { success: true, leads: leads.map((lead) => toLeadItem(lead, locationId)) };
}

// ─── Settings ──────────────────────────────────────────────────────────────────────────────

function templateItems(approvedTemplates: Record<string, string>): TemplateItem[] {
  return templateCatalog().map((entry) => {
    const stored: string | undefined = approvedTemplates[entry.id];
    return {
      id: entry.id,
      hash: entry.hash,
      compliance: entry.compliance,
      approved: stored === entry.hash,
      approvalOutdated: stored !== undefined && stored !== entry.hash,
      description: TEMPLATE_DESCRIPTIONS[entry.id],
      variants: entry.variants,
    };
  });
}

/** Stats never take the settings view down: before migration 0045 the panel still shows config. */
async function readStats(day: string): Promise<SettingsResponse["stats"]> {
  const [today, last7d] = await Promise.all([
    getDailyStats(day).catch((error: unknown) => {
      log.warn("Admin: daily stats unavailable", { error: errorName(error) });
      return null;
    }),
    countMessagesSince(new Date(Date.now() - SEVEN_DAYS_MS)).catch((error: unknown) => {
      log.warn("Admin: message counts unavailable", { error: errorName(error) });
      return null;
    }),
  ]);
  return { day, today, last7d };
}

async function settingsBody(): Promise<SettingsResponse> {
  const day = localCalendarDateKey(new Date(), AGENT_TZ);
  const [settings, stats] = await Promise.all([aiSetterSettings.read(), readStats(day)]);
  return {
    success: true,
    settings: {
      paused: settings.paused,
      busyUntil: iso(settings.busyUntil),
      schedule: settings.schedule,
      approvedTemplates: settings.approvedTemplates,
      failedClosed: settings.failedClosed,
    },
    templates: templateItems(settings.approvedTemplates),
    config: getConfigStatus(),
    stats,
  };
}

// ─── Thread & slot preview (both read GHL) ─────────────────────────────────────────────────

async function threadBody(contactId: string): Promise<ThreadResponse> {
  return { success: true, messages: await getThreadPreview(contactId) };
}

async function previewBody(): Promise<PreviewResponse> {
  return { success: true, zones: await getSlotPreview() };
}

async function renderView(view: View, request: NextRequest): Promise<NextResponse> {
  switch (view) {
    case "inbox":
      return json(await inboxBody());
    case "leads":
      return json(await leadsBody());
    case "settings":
      return json(await settingsBody());
    case "thread": {
      const contactId = request.nextUrl.searchParams.get("contactId") ?? "";
      if (!CONTACT_ID_RE.test(contactId)) return apiError(400, "Contacto inválido.");
      return json(await threadBody(contactId));
    }
    case "preview":
      return json(await previewBody());
  }
}

/**
 * GET /api/admin/ai-setter?view=inbox|leads|settings|thread|preview — admin only, never cached.
 * `thread` also takes `contactId`. `thread` and `preview` read GHL; the others read the app DB.
 */
export async function GET(request: NextRequest) {
  const userId = await requireAdminUser();
  if (userId instanceof NextResponse) return userId;

  const view = parseView(request.nextUrl.searchParams.get("view"));
  if (!view) return apiError(400, "Vista desconocida.");

  try {
    return await renderView(view, request);
  } catch (error) {
    log.error("Admin view failed", { view, error: errorName(error) });
    return apiError(500, FAILURE_TEXT[view]);
  }
}
