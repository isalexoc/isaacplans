"use client";

import { useEffect, useState } from "react";
import { Loader2, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LOB_META, DISPOSITION_META } from "@/lib/call-summary-note-format";
import type { CallDisposition, LineOfBusiness } from "@/lib/call-summary-structured";

type CountRow = { key: string; count: number };

type MetricsResponse = {
  days: number;
  totalCallEvents: number;
  completed: number;
  skippedNoAnswer: number;
  contactRate: number | null;
  dispositionCounts: CountRow[];
  lineOfBusinessCounts: CountRow[];
};

const DAY_OPTIONS = [7, 30, 90];

function withPercentages(rows: CountRow[]): Array<CountRow & { pct: number }> {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return rows
    .map((r) => ({ ...r, pct: total > 0 ? (r.count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </Card>
  );
}

export default function CallMetricsView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/call-metrics?days=${days}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load");
        if (!cancelled) setData(json);
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
  }, [days]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Call Metrics</h1>
              <p className="text-sm text-muted-foreground">Contact rate and call mix for a date range</p>
            </div>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {loading || !data ? (
          <div className="mt-6 flex items-center justify-center rounded-lg border bg-white p-10 text-muted-foreground dark:bg-gray-950">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Dial attempts" value={String(data.totalCallEvents)} />
              <StatCard label="Answered" value={String(data.completed)} />
              <StatCard label="No answer / busy / failed" value={String(data.skippedNoAnswer)} />
              <StatCard
                label="Contact rate"
                value={data.contactRate === null ? "—" : `${Math.round(data.contactRate * 100)}%`}
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold">Disposition mix (answered calls)</h2>
                {data.dispositionCounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed calls in this range.</p>
                ) : (
                  <ul className="space-y-2">
                    {withPercentages(data.dispositionCounts).map((row) => {
                      const meta = DISPOSITION_META[row.key as CallDisposition];
                      return (
                        <li key={row.key} className="flex items-center justify-between text-sm">
                          <span>
                            {meta?.emoji ?? "•"} {meta?.en ?? row.key}
                          </span>
                          <span className="text-muted-foreground">
                            {row.count} ({Math.round(row.pct)}%)
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <h2 className="mb-3 text-sm font-semibold">Line of business (answered calls)</h2>
                {data.lineOfBusinessCounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed calls in this range.</p>
                ) : (
                  <ul className="space-y-2">
                    {withPercentages(data.lineOfBusinessCounts).map((row) => {
                      const meta = LOB_META[row.key as LineOfBusiness];
                      return (
                        <li key={row.key} className="flex items-center justify-between text-sm">
                          <span>
                            {meta?.emoji ?? "•"} {meta?.en ?? row.key}
                          </span>
                          <span className="text-muted-foreground">
                            {row.count} ({Math.round(row.pct)}%)
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
