"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, UserPlus, Copy, Check, Pencil, Eye, ChevronDown, RotateCcw, Unlock, Lock, Send, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  listIntakes,
  createIntake,
  searchCrmContacts,
  resetIntakeLink,
  reopenIntake,
  sendIntakeLink,
  deleteIntake,
  type CrmContactMatch,
  type IntakePagination,
} from "@/lib/iul-intake-api";
import type { IntakeSummary, IntakeStatus } from "@/lib/iul-intake/types";
import { buildIntakeShareUrl } from "@/lib/iul-intake/share-url";
import { titleCaseName, isValidEmail, isValidPhone } from "@/lib/iul-intake/validation";
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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<IntakePagination | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Find-or-add
  const [crmQuery, setCrmQuery] = useState("");
  const [matches, setMatches] = useState<CrmContactMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLang, setNewLang] = useState<"en" | "es">("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

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
      const { sessions: rows, pagination: pg } = await listIntakes({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
      });
      setSessions(rows);
      setPagination(pg);
    } catch {
      setSessions([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset to the first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // If a delete empties the current page, fall back to the last valid page.
  useEffect(() => {
    if (pagination && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page]);

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
    const firstName = titleCaseName(newFirstName);
    const lastName = titleCaseName(newLastName);
    const email = newEmail.trim().toLowerCase();
    const phone = newPhone.replace(/\D/g, "");

    if (!firstName && !lastName && !email && !phone) {
      setError(tr(UI.startError, locale));
      return;
    }
    if (email && !isValidEmail(email)) {
      setError(tr(UI.errEmail, locale));
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError(tr(UI.errPhone, locale));
      return;
    }
    // Reflect the normalized values back to the user.
    setNewFirstName(firstName);
    setNewLastName(lastName);
    setNewEmail(email);
    setNewPhone(phone);

    setBusy(true);
    setError(null);
    try {
      const session = await createIntake({ firstName, lastName, email, phone, locale: newLang });
      goToForm(session.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  }

  function shareUrl(token: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    return buildIntakeShareUrl(token, locale, origin);
  }

  async function handleSendLink(s: IntakeSummary) {
    setSendingId(s.id);
    setError(null);
    try {
      await sendIntakeLink(s.token);
      setSentId(s.id);
      setTimeout(() => setSentId((id) => (id === s.id ? null : id)), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSendingId(null);
    }
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

  async function handleReopen(s: IntakeSummary, allow: boolean) {
    setReopeningId(s.id);
    setError(null);
    try {
      const updated = await reopenIntake(s.token, allow);
      setSessions((prev) => prev.map((row) => (row.id === s.id ? updated : row)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setReopeningId(null);
    }
  }

  async function handleDelete(s: IntakeSummary) {
    if (!window.confirm(tr(UI.deleteConfirm, locale))) return;
    setDeletingId(s.id);
    setError(null);
    try {
      await deleteIntake(s.token);
      // Drop it locally; reload to refresh the page/count (and backfill from the next page).
      setSessions((prev) => prev.filter((row) => row.id !== s.id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReset(s: IntakeSummary) {
    if (!window.confirm(tr(UI.resetConfirm, locale))) return;
    setResettingId(s.id);
    setError(null);
    try {
      const updated = await resetIntakeLink(s.token);
      setSessions((prev) => prev.map((row) => (row.id === s.id ? updated : row)));
      await copyLink(updated.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setResettingId(null);
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="ni-first">{tr(UI.firstName, locale)}</Label>
                    <Input
                      id="ni-first"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      onBlur={(e) => setNewFirstName(titleCaseName(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ni-last">{tr(UI.lastName, locale)}</Label>
                    <Input
                      id="ni-last"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      onBlur={(e) => setNewLastName(titleCaseName(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ni-email">{tr(UI.email, locale)}</Label>
                    <Input
                      id="ni-email"
                      type="email"
                      inputMode="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value.toLowerCase())}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ni-phone">{tr(UI.phone, locale)}</Label>
                    <Input
                      id="ni-phone"
                      type="tel"
                      inputMode="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ni-lang">{tr(UI.preferredLanguage, locale)}</Label>
                    <select
                      id="ni-lang"
                      value={newLang}
                      onChange={(e) => setNewLang(e.target.value as "en" | "es")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                    </select>
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
                    {s.crmContactId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-brand hover:text-brand"
                        disabled={sendingId === s.id}
                        onClick={() => handleSendLink(s)}
                      >
                        {sendingId === s.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : sentId === s.id ? (
                          <Check className="mr-1 h-4 w-4 text-green-600" />
                        ) : (
                          <Send className="mr-1 h-4 w-4" />
                        )}
                        {sentId === s.id ? tr(UI.linkSent, locale) : tr(UI.sendLink, locale)}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-600 hover:text-amber-700"
                      disabled={resettingId === s.id}
                      onClick={() => handleReset(s)}
                    >
                      {resettingId === s.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-1 h-4 w-4" />
                      )}
                      {tr(UI.resetLink, locale)}
                    </Button>
                    {s.status === "completed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={s.reopenedForClient ? "text-green-600 hover:text-green-700" : "text-blue-600 hover:text-blue-700"}
                        disabled={reopeningId === s.id}
                        onClick={() => handleReopen(s, !s.reopenedForClient)}
                      >
                        {reopeningId === s.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : s.reopenedForClient ? (
                          <Lock className="mr-1 h-4 w-4" />
                        ) : (
                          <Unlock className="mr-1 h-4 w-4" />
                        )}
                        {s.reopenedForClient ? tr(UI.lockClientEdit, locale) : tr(UI.allowClientEdit, locale)}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={deletingId === s.id}
                      onClick={() => handleDelete(s)}
                    >
                      {deletingId === s.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-4 w-4" />
                      )}
                      {tr(UI.deleteForm, locale)}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {tr(UI.prevPage, locale)}
            </Button>
            <span className="text-sm text-muted-foreground">
              {tr(UI.pageOf, locale)
                .replace("{page}", String(pagination.page))
                .replace("{total}", String(pagination.totalPages))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {tr(UI.nextPage, locale)}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
