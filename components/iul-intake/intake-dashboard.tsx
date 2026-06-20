"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, UserPlus, Copy, Check, Pencil, Eye, ChevronDown } from "lucide-react";
import {
  listIntakes,
  createIntake,
  searchCrmContacts,
  type CrmContactMatch,
} from "@/lib/iul-intake-api";
import type { IntakeSummary, IntakeStatus } from "@/lib/iul-intake/types";
import { UI, pickLocale, tr } from "@/lib/iul-intake/ui-strings";
import IntakeBreadcrumb from "@/components/iul-intake/intake-breadcrumb";

const STATUS_VARIANT: Record<IntakeStatus, "secondary" | "default" | "outline"> = {
  draft: "outline",
  in_progress: "secondary",
  completed: "default",
};

export default function IntakeDashboard() {
  const locale = pickLocale(useLocale());
  const router = useRouter();

  const [sessions, setSessions] = useState<IntakeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IntakeStatus | "">("");

  // Find-or-add
  const [crmQuery, setCrmQuery] = useState("");
  const [matches, setMatches] = useState<CrmContactMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const statusLabel = useCallback(
    (s: IntakeStatus) =>
      s === "completed"
        ? tr(UI.statusCompleted, locale)
        : s === "in_progress"
          ? tr(UI.statusInProgress, locale)
          : tr(UI.statusDraft, locale),
    [locale]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listIntakes({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setSessions(rows);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSearch() {
    if (!crmQuery.trim()) return;
    setSearching(true);
    setSearched(false);
    setError(null);
    try {
      setMatches(await searchCrmContacts(crmQuery.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setMatches([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  function goToForm(token: string) {
    router.push({ pathname: "/iul/intake/[token]", params: { token } });
  }

  async function startFromContact(c: CrmContactMatch) {
    setBusy(true);
    setError(null);
    try {
      const session = await createIntake({ crmContactId: c.id, locale });
      goToForm(session.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  }

  async function createAndStart() {
    if (!newName.trim() && !newEmail.trim() && !newPhone.trim()) {
      setError(tr(UI.startError, locale));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await createIntake({ name: newName, email: newEmail, phone: newPhone, locale });
      goToForm(session.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  }

  function shareUrl(token: string): string {
    const slug = locale === "es" ? "iul/admision" : "iul/intake";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/${locale}/${slug}/${token}`;
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <IntakeBreadcrumb />

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
          {tr(UI.dashboardTitle, locale)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr(UI.dashboardSubtitle, locale)}</p>

        {/* Find or add a client */}
        <div className="mt-6 rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Search className="h-5 w-5" /> {tr(UI.findClient, locale)}
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder={tr(UI.searchCrm, locale)}
              value={crmQuery}
              onChange={(e) => setCrmQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
            />
            <Button onClick={handleSearch} disabled={searching || !crmQuery.trim()} className="shrink-0">
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {searching ? tr(UI.searching, locale) : tr(UI.searchBtn, locale)}
            </Button>
          </div>

          {searched && (
            <div className="mt-3">
              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tr(UI.noMatches, locale)}</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {matches.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.name || c.email || c.phone}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[c.email, c.phone].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <Button size="sm" disabled={busy} onClick={() => startFromContact(c)}>
                        {tr(UI.startForThis, locale)}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Create new contact */}
          <div className="mt-4 border-t pt-4">
            <button
              type="button"
              onClick={() => setShowCreate((s) => !s)}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              <UserPlus className="h-4 w-4" />
              {tr(UI.createNew, locale)}
              <ChevronDown className={`h-4 w-4 transition-transform ${showCreate ? "rotate-180" : ""}`} />
            </button>
            {showCreate && (
              <div className="mt-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="ni-name">{tr(UI.clientName, locale)}</Label>
                    <Input id="ni-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ni-email">{tr(UI.email, locale)}</Label>
                    <Input id="ni-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ni-phone">{tr(UI.phone, locale)}</Label>
                    <Input id="ni-phone" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  </div>
                </div>
                <Button className="mt-3" disabled={busy} onClick={createAndStart}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  {tr(UI.createAndStart, locale)}
                </Button>
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {/* Existing intakes */}
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input placeholder={tr(UI.search, locale)} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IntakeStatus | "")}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{tr(UI.allStatuses, locale)}</option>
            <option value="draft">{tr(UI.statusDraft, locale)}</option>
            <option value="in_progress">{tr(UI.statusInProgress, locale)}</option>
            <option value="completed">{tr(UI.statusCompleted, locale)}</option>
          </select>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border bg-white dark:bg-gray-950">
          {loading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {tr(UI.loading, locale)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">{tr(UI.noSessions, locale)}</div>
          ) : (
            <ul className="divide-y">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {s.contactName || s.contactEmail || s.contactPhone || s.token}
                      </span>
                      <Badge variant={STATUS_VARIANT[s.status]}>{statusLabel(s.status)}</Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[s.contactEmail, s.contactPhone].filter(Boolean).join(" · ")}
                      {s.updatedAt
                        ? ` · ${tr(UI.updated, locale)} ${new Date(s.updatedAt).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={{ pathname: "/iul/intake/[token]", params: { token: s.token } }}>
                        <Pencil className="mr-1 h-4 w-4" />
                        {tr(UI.edit, locale)}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={{ pathname: "/iul/intake/[token]/view", params: { token: s.token } }}>
                        <Eye className="mr-1 h-4 w-4" />
                        {tr(UI.view, locale)}
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copyLink(s.token)}>
                      {copiedToken === s.token ? (
                        <>
                          <Check className="mr-1 h-4 w-4 text-green-600" />
                          {tr(UI.linkCopied, locale)}
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-4 w-4" />
                          {tr(UI.copyLink, locale)}
                        </>
                      )}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
