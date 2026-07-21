"use client";

import { useEffect, useState } from "react";
import { Loader2, ExternalLink, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type OpenLoopItem = {
  contactId: string;
  locationId: string;
  noteId: string | null;
  disposition: string;
  dispositionMeta: { emoji: string; en: string; es: string };
  lineOfBusiness: string;
  lobMeta: { emoji: string; en: string; es: string };
  followUpDate: string | null;
  followUpDateIso: string | null;
  processedAt: string;
  contactName: string;
  nextStepsPreview: string[];
  crmUrl: string;
};

const DISPOSITION_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  follow_up: "secondary",
  appointment_set: "default",
  needs_info: "outline",
  no_decision: "outline",
};

function isOverdue(followUpDateIso: string | null): boolean {
  if (!followUpDateIso) return false;
  return new Date(followUpDateIso).getTime() < Date.now();
}

export default function OpenLoopDashboard() {
  const [items, setItems] = useState<OpenLoopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/call-dashboard");
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to load");
        if (!cancelled) setItems(data.items);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const overdueCount = items.filter((i) => isOverdue(i.followUpDateIso)).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <PhoneCall className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Callback Priority</h1>
            <p className="text-sm text-muted-foreground">
              Contacts with an open follow-up loop, soonest promised callback first.
              {!loading && items.length > 0 && overdueCount > 0 && (
                <span className="ml-1 font-medium text-red-600">{overdueCount} overdue.</span>
              )}
            </p>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 overflow-hidden rounded-lg border bg-white dark:bg-gray-950">
          {loading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No open follow-ups — every recent call is closed out.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const overdue = isOverdue(item.followUpDateIso);
                return (
                  <li key={item.contactId} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{item.contactName}</span>
                        <Badge variant={DISPOSITION_VARIANT[item.disposition] ?? "outline"}>
                          {item.dispositionMeta.emoji} {item.dispositionMeta.en}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.lobMeta.emoji} {item.lobMeta.en}
                        </span>
                      </div>
                      {item.followUpDate && (
                        <div className={`mt-1 text-sm ${overdue ? "font-medium text-red-600" : "text-foreground"}`}>
                          {overdue ? "Overdue — was: " : "Follow-up: "}
                          {item.followUpDate}
                        </div>
                      )}
                      {item.nextStepsPreview.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {item.nextStepsPreview.map((step, i) => (
                            <li key={i}>• {step}</li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        Last call: {new Date(item.processedAt).toLocaleString()}
                      </div>
                    </div>
                    <a
                      href={item.crmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
                    >
                      Open in CRM <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Card className="mt-4 p-4 text-xs text-muted-foreground">
          Shows the most recent completed call per contact (last 90 days) with an open
          disposition — follow-up, appointment set, needs info, or no decision. Sales,
          not-interested, and voicemail-only calls don&apos;t appear here.
        </Card>
      </div>
    </main>
  );
}
