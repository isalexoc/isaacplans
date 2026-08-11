"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loadCrmContact,
  searchCrmContacts,
  type CrmContactNative,
  type CrmContactSummary,
} from "@/lib/mailing-labels/api";

/**
 * Find a prospect who is already in Agent CRM and pull their details into the form.
 *
 * Nearly every prospect being mailed to is already a CRM contact, so typing the address again by
 * hand is both slower and worse: a hand-typed row has no `crmContactId`, which is exactly what the
 * letter needs to draft from their call summaries.
 */

export function CrmContactPicker({
  onPick,
  disabled,
}: {
  onPick: (contact: CrmContactNative) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CrmContactSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Ignore responses from superseded keystrokes so a slow one can't overwrite a newer result.
  const requestRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const ticket = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchCrmContacts(q);
        if (requestRef.current === ticket) {
          setResults(found);
          setError(null);
        }
      } catch (e) {
        if (requestRef.current === ticket) {
          setError(e instanceof Error ? e.message : "CRM search failed");
          setResults([]);
        }
      } finally {
        if (requestRef.current === ticket) setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query]);

  const pick = async (contact: CrmContactSummary) => {
    setLoadingId(contact.id);
    setError(null);
    try {
      onPick(await loadCrmContact(contact.id));
      setQuery("");
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that contact");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <Label htmlFor="ml-crm-search" className="flex items-center gap-2">
        <UserPlus className="h-4 w-4" />
        Find them in your CRM
      </Label>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        {searching ? (
          <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
        <Input
          id="ml-crm-search"
          className="pl-8"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setTouched(true);
          }}
          placeholder="Search by name, phone, or email"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Pulls their address and links the contact, so the letter can use past call notes.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {results.length > 0 ? (
        <ul className="max-h-64 divide-y overflow-y-auto rounded-md border bg-background">
          {results.map((contact) => (
            <li key={contact.id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
                onClick={() => void pick(contact)}
                disabled={loadingId !== null}
              >
                <span className="flex w-full flex-col items-start">
                  <span className="font-medium">
                    {contact.name || "(no name)"}
                    {loadingId === contact.id ? (
                      <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[contact.phone, contact.email].filter(Boolean).join(" · ") || "no contact info"}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : touched && query.trim().length >= 2 && !searching && !error ? (
        <p className="text-sm text-muted-foreground">
          Nobody matched. Fill in the form below to add them by hand.
        </p>
      ) : null}
    </div>
  );
}
