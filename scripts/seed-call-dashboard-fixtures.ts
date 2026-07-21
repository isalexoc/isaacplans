/**
 * Dev-only: inserts a few fabricated call_summary_processed rows so the
 * Callback Priority and Call Metrics admin pages can be visually verified
 * locally without a real call. Run: pnpm seed:call-dashboard
 */
import "dotenv/config";
import { markCallProcessed } from "../lib/agent-crm-call-summary-store";
import type { StructuredCallSummary } from "../lib/call-summary-structured";

const CONTACT_PREFIX = "seed-fixture-";

function iso(daysFromNow: number, hour = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function summary(overrides: Partial<StructuredCallSummary>): StructuredCallSummary {
  return {
    language: "en",
    lineOfBusiness: "final_expense",
    disposition: "follow_up",
    title: "Seed fixture",
    summary: "Fixture data seeded for local dashboard verification.",
    ...overrides,
  };
}

async function main() {
  const rows: Array<{
    id: string;
    status: "completed" | "skipped";
    disposition?: StructuredCallSummary["disposition"];
    lineOfBusiness?: StructuredCallSummary["lineOfBusiness"];
    followUpDateIso?: string;
    structured?: StructuredCallSummary;
    errorMessage?: string;
    processedDaysAgo?: number;
  }> = [
    {
      id: "1",
      status: "completed",
      disposition: "follow_up",
      lineOfBusiness: "final_expense",
      followUpDateIso: iso(1),
      structured: summary({
        disposition: "follow_up",
        followUpDate: "Tomorrow 2 PM",
        followUpDateIso: iso(1),
        clientProfile: { name: "María López (seed)" },
        nextSteps: [{ action: "Call back with Carlos on the line", date: "Tomorrow 2 PM", owner: "agent" }],
      }),
    },
    {
      id: "2",
      status: "completed",
      disposition: "appointment_set",
      lineOfBusiness: "aca",
      followUpDateIso: iso(-1), // overdue
      structured: summary({
        lineOfBusiness: "aca",
        disposition: "appointment_set",
        followUpDate: "Yesterday 11 AM (overdue seed row)",
        followUpDateIso: iso(-1),
        clientProfile: { name: "Carlos Ramírez (seed)" },
        nextSteps: [{ action: "Confirm household income docs", owner: "client" }],
      }),
    },
    {
      id: "3",
      status: "completed",
      disposition: "no_decision",
      lineOfBusiness: "iul",
      structured: summary({
        lineOfBusiness: "iul",
        disposition: "no_decision",
        clientProfile: { name: "Johnny (seed, no follow-up date)" },
      }),
    },
    {
      id: "4",
      status: "completed",
      disposition: "sale",
      lineOfBusiness: "final_expense",
      structured: summary({ disposition: "sale", clientProfile: { name: "Rosa Martínez (seed, closed)" } }),
    },
    {
      id: "5",
      status: "skipped",
      errorMessage: "call_status_no-answer",
      processedDaysAgo: 0,
    },
    {
      id: "6",
      status: "skipped",
      errorMessage: "call_status_busy",
      processedDaysAgo: 0,
    },
  ];

  for (const row of rows) {
    await markCallProcessed({
      messageId: `${CONTACT_PREFIX}msg-${row.id}`,
      contactId: `${CONTACT_PREFIX}contact-${row.id}`,
      locationId: "seed-location",
      status: row.status,
      errorMessage: row.errorMessage ?? null,
      disposition: row.disposition ?? null,
      lineOfBusiness: row.lineOfBusiness ?? null,
      followUpDateIso: row.followUpDateIso ? new Date(row.followUpDateIso) : null,
      structuredSummary: row.structured ?? null,
    });
    console.log(`Seeded ${row.id}: status=${row.status} disposition=${row.disposition ?? row.errorMessage ?? "-"}`);
  }

  console.log(`\nDone. Visit /en/admin/call-dashboard and /en/admin/call-metrics to verify.`);
  console.log(`Contact IDs are prefixed "${CONTACT_PREFIX}" for easy manual cleanup later.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
