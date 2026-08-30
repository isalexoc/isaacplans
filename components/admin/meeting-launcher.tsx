"use client";

import { useState } from "react";
import { Loader2, Search, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchCrmContacts, type CrmContactMatch } from "@/lib/iul-intake-api";
import MeetingPanel from "@/components/crankwheel/meeting-panel";
import { useCrankwheelMeeting } from "@/hooks/use-crankwheel-meeting";

/**
 * Start a screen share with any CRM contact.
 *
 * This is the replacement for CrankWheel's own in-page CRM button, which does not render on
 * LeadConnector custom domains. It works because it never touches the CRM's page at all: the
 * contact is looked up through our own API, and the link is minted and delivered from here.
 *
 * The panel itself is the same component the IUL intake mounts — this page only supplies a
 * different way of choosing who the meeting is with.
 */
export default function MeetingLauncher() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CrmContactMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CrmContactMatch | null>(null);

  const meeting = useCrankwheelMeeting({
    target: selected
      ? {
          crmContactId: selected.id,
          contactName: selected.name ?? null,
          contactEmail: selected.email ?? null,
          contactPhone: selected.phone ?? null,
        }
      : {},
  });

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    setError(null);
    try {
      setMatches(await searchCrmContacts(query.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setMatches([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  function choose(contact: CrmContactMatch) {
    setSelected(contact);
    // Any link on screen belongs to the previous contact; the hook re-reads for the new one.
    meeting.reset();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Search className="h-5 w-5" /> Find a contact
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Name, email or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
          />
          <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0">
            {searching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>

        {searched && (
          <div className="mt-3">
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching contacts.</p>
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
                    <Button
                      size="sm"
                      variant={selected?.id === c.id ? "secondary" : "default"}
                      onClick={() => choose(c)}
                    >
                      <MonitorPlay className="mr-1 h-4 w-4" />
                      {selected?.id === c.id ? "Selected" : "Meet with"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {selected && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            Meeting with{" "}
            <span className="font-medium text-foreground">
              {selected.name || selected.email || selected.phone}
            </span>
          </p>
          <MeetingPanel
            locale="en"
            meeting={meeting.meeting}
            busy={meeting.busy}
            error={meeting.error}
            canSend
            onCreate={meeting.create}
            onRevoke={meeting.revoke}
            onSend={meeting.send}
            onReset={meeting.reset}
          />
        </div>
      )}
    </div>
  );
}
