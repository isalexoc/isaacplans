/** Client-safe DTOs for Final Expense intake (no server-only imports). */

import type { FeIntakeData } from "./schema";

export type FeIntakeStatus = "draft" | "in_progress" | "completed";

/** Summary row for the agent dashboard list. */
export type FeIntakeSummary = {
  id: string;
  token: string;
  status: FeIntakeStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  crmContactId: string | null;
  /** Admin granted the client edit access after submission (re-locks on re-submit). */
  reopenedForClient: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
};

/** Full session payload returned to an authorized user (sensitive fields decrypted). */
export type FeIntakeSession = FeIntakeSummary & {
  data: FeIntakeData;
  locale: string;
  /** "owner" (agent) or "client" — controls UI affordances like sensitive reveal. */
  role: "owner" | "client";
};
