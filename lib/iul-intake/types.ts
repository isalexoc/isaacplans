/** Client-safe DTOs for IUL intake (no server-only imports). */

import type { IntakeData } from "./schema";

export type IntakeStatus = "draft" | "in_progress" | "completed";

/** Summary row for the agent dashboard list. */
export type IntakeSummary = {
  id: string;
  token: string;
  status: IntakeStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  crmContactId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
};

/** Full session payload returned to an authorized user (sensitive fields decrypted). */
export type IntakeSession = IntakeSummary & {
  data: IntakeData;
  locale: string;
  /** "owner" (agent) or "client" — controls UI affordances like sensitive reveal. */
  role: "owner" | "client";
};
