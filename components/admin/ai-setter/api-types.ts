/**
 * Response shapes of /api/admin/ai-setter, shared by the route (which builds them) and the panel
 * (which reads them). Dates travel as ISO strings. Type-only imports from server modules are
 * erased at build time, so nothing server-side reaches the browser bundle.
 */

import type { getConfigStatus, getSlotPreview, getThreadPreview } from "@/lib/ai-setter/actions";
import type { smsSegments } from "@/lib/ai-setter/guard";
import type { getDailyStats } from "@/lib/ai-setter/store";
import type {
  Channel,
  Lang,
  LeadRecord,
  LeadStatus,
  MessageKind,
  MessageStatus,
  ProductLine,
  Register,
  WeeklySchedule,
} from "@/lib/ai-setter/types";

/** GSM-7 / UCS-2 split of one SMS text. */
export type SmsSegmentInfo = ReturnType<typeof smsSegments>;

/** One message waiting on Isaac (draft / shadow) or one that went wrong (stale, blocked, …). */
export type InboxItem = {
  messageId: string;
  contactId: string;
  firstName: string | null;
  product: ProductLine | null;
  productLabelEs: string | null;
  stateCode: string | null;
  language: Lang | null;
  register: Register | null;
  channel: Channel;
  kind: MessageKind;
  templateId: string | null;
  status: MessageStatus;
  /** Null after the 90-day text purge. */
  body: string | null;
  intent: string | null;
  guardFlags: string[];
  usedFallback: boolean;
  /** Why it did not go out (stale / blocked / failed / send_unknown only): a short code. */
  problem: string | null;
  createdAt: string;
  expiresAt: string | null;
  notBefore: string | null;
  crmUrl: string | null;
  /** SMS only; null for WhatsApp or an empty body. */
  segments: SmsSegmentInfo | null;
};

/** One lead as the panel lists it: state of the conversation, never message text. */
export type LeadItem = {
  contactId: string;
  firstName: string | null;
  status: LeadStatus;
  product: ProductLine | null;
  productLabelEs: string | null;
  stateCode: string | null;
  language: Lang | null;
  register: Register | null;
  lastInboundAt: string | null;
  lastAiOutboundAt: string | null;
  appointmentAt: string | null;
  /** Labels of the times offered and still live ("hoy a las 4:30 de la tarde"). */
  offeredLabels: string[];
  pausedUntil: string | null;
  pauseReason: string | null;
  optOutPending: boolean;
  callNowState: LeadRecord["callNowState"];
  updatedAt: string;
  crmUrl: string | null;
};

export type TemplateItem = {
  id: string;
  hash: string;
  /** HELP / opt-out: always sent by code, never approved by hand. */
  compliance: boolean;
  /** The stored approval matches the current text. */
  approved: boolean;
  /** Approved once, but the text changed since: needs a new approval. */
  approvalOutdated: boolean;
  description: { en: string; es: string };
  variants: Array<{ lang: Lang; register: Register; text: string }>;
};

export type ConfigStatus = ReturnType<typeof getConfigStatus>;
export type DailyStats = Awaited<ReturnType<typeof getDailyStats>>;
export type ThreadMessageItem = Awaited<ReturnType<typeof getThreadPreview>>[number];
export type ZonePreview = Awaited<ReturnType<typeof getSlotPreview>>[number];

export type SettingsView = {
  paused: boolean;
  busyUntil: string | null;
  schedule: WeeklySchedule;
  approvedTemplates: Record<string, string>;
  failedClosed: boolean;
};

export type InboxResponse = { success: true; items: InboxItem[] };
export type LeadsResponse = { success: true; leads: LeadItem[] };
export type ThreadResponse = { success: true; messages: ThreadMessageItem[] };
export type PreviewResponse = { success: true; zones: ZonePreview[] };

export type SettingsResponse = {
  success: true;
  settings: SettingsView;
  templates: TemplateItem[];
  config: ConfigStatus;
  /** `today` / `last7d` are null when the stats tables could not be read (e.g. before migration 0045). */
  stats: {
    day: string;
    today: DailyStats | null;
    last7d: Record<MessageStatus, number> | null;
  };
};

export type ActionResponse = { success: boolean; error?: string; data?: unknown };
