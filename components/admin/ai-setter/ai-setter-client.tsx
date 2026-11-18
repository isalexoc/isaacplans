"use client";

/**
 * /admin/ai-setter: Isaac's control panel for the AI Setter.
 *
 *   Bandeja — approve, edit, reject or regenerate what the AI wants to send; shadow-mode replies
 *             and messages that went wrong also land here.
 *   Leads   — where each conversation stands; pause, resume or take one over.
 *   Ajustes — config status, template approvals, weekly hours and the slot preview.
 *
 * Mobile first (works at 500 px). Every write is one POST with a fresh Idempotency-Key, all
 * action buttons are disabled while it runs, and the views reload afterwards. Nothing polls:
 * the panel refreshes when Isaac comes back to the tab.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InboxResponse, LeadsResponse, PreviewResponse, SettingsResponse } from "./api-types";
import { InboxTab } from "./inbox-tab";
import { LeadsTab } from "./leads-tab";
import { SettingsTab } from "./settings-tab";
import { SetterHeader } from "./setter-header";
import { TEMPLATES_ANCHOR_ID } from "./templates-panel";
import { useAdminActions, useApiView, useNow, useRefreshOnReturn } from "./use-ai-setter-api";

type TabId = "inbox" | "leads" | "settings";

const TAB_IDS: readonly TabId[] = ["inbox", "leads", "settings"];
/** A regenerated draft comes from a fresh QStash turn: look again once it has had time to run. */
const REGENERATE_RELOAD_MS = 20_000;
/**
 * Tabs stay mounted (hidden when inactive) so a half-edited draft or schedule survives a peek at
 * another tab. Radix leaves force-mounted inactive content visible, hence the data-state rule.
 */
const TAB_CONTENT_CLASS = "mt-4 data-[state=inactive]:hidden";

function isTabId(value: string): value is TabId {
  return TAB_IDS.some((id) => id === value);
}

type AiSetterClientProps = {
  /** From `?m=` (validated by the page): scroll to and highlight this inbox card. */
  focusMessageId: string | null;
};

/** One delayed inbox reload at a time, cancelled on unmount. */
function useDelayedReload(reload: () => Promise<void>, delayMs: number): () => void {
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );
  return useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      void reload();
    }, delayMs);
  }, [reload, delayMs]);
}

export default function AiSetterClient({ focusMessageId }: AiSetterClientProps) {
  const [tab, setTab] = useState<TabId>("inbox");
  const [visited, setVisited] = useState<ReadonlySet<TabId>>(() => new Set<TabId>(["inbox"]));
  const nowMs = useNow(30_000);

  const overview = useApiView<SettingsResponse>("view=settings");
  const inbox = useApiView<InboxResponse>("view=inbox");
  const leads = useApiView<LeadsResponse>(visited.has("leads") ? "view=leads" : null);
  const preview = useApiView<PreviewResponse>(visited.has("settings") ? "view=preview" : null);

  const { reload: reloadOverview } = overview;
  const { reload: reloadInbox } = inbox;
  const { reload: reloadLeads } = leads;
  const reloadAll = useCallback(async () => {
    await Promise.all([reloadOverview(), reloadInbox(), reloadLeads()]);
  }, [reloadOverview, reloadInbox, reloadLeads]);

  const { busyKey, run } = useAdminActions(reloadAll);
  const reloadInboxLater = useDelayedReload(reloadInbox, REGENERATE_RELOAD_MS);
  useRefreshOnReturn(reloadAll);

  const selectTab = (value: string) => {
    if (!isTabId(value)) return;
    setTab(value);
    setVisited((prev) => (prev.has(value) ? prev : new Set([...prev, value])));
  };

  const openTemplates = () => {
    selectTab("settings");
    window.setTimeout(() => {
      document.getElementById(TEMPLATES_ANCHOR_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const drafts = inbox.data?.items.filter((item) => item.status === "draft").length ?? 0;
  const unapprovedTemplates = overview.data?.templates.filter((t) => !t.compliance && !t.approved).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <SetterHeader overview={overview} nowMs={nowMs} busyKey={busyKey} run={run} />
      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbox">Bandeja{drafts > 0 ? ` (${drafts})` : ""}</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="settings">Ajustes</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" forceMount className={TAB_CONTENT_CLASS}>
          <InboxTab
            inbox={inbox}
            nowMs={nowMs}
            busyKey={busyKey}
            run={run}
            focusMessageId={focusMessageId}
            unapprovedTemplates={unapprovedTemplates}
            onOpenTemplates={openTemplates}
            onRegenerated={reloadInboxLater}
          />
        </TabsContent>
        <TabsContent value="leads" forceMount className={TAB_CONTENT_CLASS}>
          <LeadsTab leads={leads} nowMs={nowMs} busyKey={busyKey} run={run} />
        </TabsContent>
        <TabsContent value="settings" forceMount className={TAB_CONTENT_CLASS}>
          <SettingsTab overview={overview} preview={preview} busyKey={busyKey} run={run} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
