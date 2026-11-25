"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listLineContacts, type CrmContactMatch, type IntakePagination, type LineContact } from "@/lib/intake-core/api-client";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

/**
 * "Sus clientes": the line's own contacts (Legal Shield: everyone carrying one of its tags), 20 a
 * page, newest first, so the associate can start a registro without searching (Ysmael's ask,
 * 2026-11-25). A client who already has a registro gets "Abrir registro" instead.
 *
 * Read page by page from the CRM through `/api/intake/<lob>?contactList=1`; the server only ever
 * lists the line's tags and returns name, email, phone and the date they came in.
 */
export default function LineContacts({
  lob,
  label,
  locale,
  busy,
  onStart,
  onOpen,
}: {
  lob: string;
  /** The line's name for the hint ("Legal Shield"). */
  label: string;
  locale: IntakeLocale;
  /** A registro is being created: the start buttons wait. */
  busy: boolean;
  onStart: (contact: CrmContactMatch) => void;
  onOpen: (token: string) => void;
}) {
  const hiddenKey = `intake-line-contacts-hidden:${lob}`;
  const [hidden, setHidden] = useState(false);
  const [page, setPage] = useState(1);
  const [contacts, setContacts] = useState<LineContact[]>([]);
  const [pagination, setPagination] = useState<IntakePagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(hiddenKey) === "1");
    } catch {
      /* shown */
    }
  }, [hiddenKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await listLineContacts(lob, page);
      setContacts(result.contacts);
      setPagination(result.pagination);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [lob, page]);

  useEffect(() => {
    if (!hidden) void load();
  }, [hidden, load]);

  function toggle() {
    setHidden((h) => {
      try {
        localStorage.setItem(hiddenKey, h ? "0" : "1");
      } catch {
        /* just for this visit */
      }
      return !h;
    });
  }

  const statusLabel = (s: LineContact["session"]) =>
    !s
      ? ""
      : s.status === "completed"
        ? tr(UI.statusCompleted, locale)
        : s.status === "in_progress"
          ? tr(UI.statusInProgress, locale)
          : tr(UI.statusDraft, locale);
  const added = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale === "es" ? "es-US" : "en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div className="mt-6 rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5" /> {tr(UI.lineContactsTitle, locale)}
          {pagination && !hidden && (
            <span className="text-sm font-normal text-muted-foreground">
              · {tr(UI.lineContactsCount, locale).replace("{total}", String(pagination.total))}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
          aria-expanded={!hidden}
        >
          {hidden ? tr(UI.showList, locale) : tr(UI.hideList, locale)}
          <ChevronDown className={`h-4 w-4 transition-transform ${hidden ? "" : "rotate-180"}`} />
        </button>
      </div>

      {!hidden && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{tr(UI.lineContactsHint, locale).replace("{label}", label)}</p>

          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : failed ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-amber-700 dark:text-amber-500">
              {tr(UI.lineContactsError, locale)}
              <Button size="sm" variant="outline" onClick={() => void load()}>
                {tr(UI.tryAgain, locale)}
              </Button>
            </div>
          ) : contacts.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{tr(UI.lineContactsEmpty, locale)}</p>
          ) : (
            <ul className="mt-3 divide-y rounded-md border">
              {contacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name || c.email || c.phone}</span>
                      {c.session && (
                        <Badge variant={c.session.status === "completed" ? "default" : "secondary"} className="shrink-0">
                          {statusLabel(c.session)}
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[c.phone, c.email].filter(Boolean).join(" · ")}
                      {added(c.dateAdded) ? ` · ${tr(UI.lineContactAdded, locale)} ${added(c.dateAdded)}` : ""}
                    </div>
                  </div>
                  {c.session ? (
                    <Button size="sm" variant="outline" onClick={() => onOpen(c.session!.token)}>
                      {tr(UI.openRegistro, locale)}
                    </Button>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => onStart(c)}>
                      {tr(UI.startForThis, locale)}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {pagination && pagination.totalPages > 1 && !failed && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> {tr(UI.prevPage, locale)}
              </Button>
              <span className="text-sm text-muted-foreground">
                {tr(UI.pageOf, locale)
                  .replace("{page}", String(pagination.page))
                  .replace("{total}", String(pagination.totalPages))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={loading || !pagination.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {tr(UI.nextPage, locale)} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
