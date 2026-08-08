"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  bulkMailingLabelAction,
  createMailingLabelRequest,
  fetchMailingLabels,
  printMailingLabels,
  saveMailingLabelSettingsRequest,
  updateMailingLabelRequest,
} from "@/lib/mailing-labels/api";
import { DEFAULT_TAGLINES } from "@/lib/mailing-labels/format";
import {
  DEFAULT_SHIPPING_PRESET,
  DEFAULT_STICKER_PRESET,
  type LabelPresetId,
} from "@/lib/mailing-labels/presets";
import {
  EMPTY_SENDER_ADDRESS,
  type LabelAgentContact,
  type LabelSheetOptions,
  type MailingLabelRecord,
  type MailingLabelSettings,
  type MailingLabelSource,
  type MailingLabelStatus,
  type SenderAddress,
} from "@/lib/mailing-labels/types";
import { EMPTY_LABEL_FORM, LabelForm, labelToFormValues, type LabelFormValues } from "./label-form";
import { LabelQueuePanel } from "./label-queue-panel";
import { LabelSettingsPanel } from "./label-settings-panel";
import { PriorityMailPanel } from "./priority-mail-panel";

const FALLBACK_SETTINGS: MailingLabelSettings = {
  sender: EMPTY_SENDER_ADDRESS,
  defaults: {
    stickerPreset: DEFAULT_STICKER_PRESET,
    shippingPreset: DEFAULT_SHIPPING_PRESET,
    showLogo: true,
    showAgentContact: true,
    taglines: { ...DEFAULT_TAGLINES },
  },
};

type Filters = {
  status: MailingLabelStatus | "all";
  source: MailingLabelSource | "all";
  q: string;
};

export function MailingLabelsClient({ agent }: { agent: LabelAgentContact | null }) {
  const [tab, setTab] = useState("queue");
  const [labels, setLabels] = useState<MailingLabelRecord[]>([]);
  const [settings, setSettings] = useState<MailingLabelSettings>(FALLBACK_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ status: "pending", source: "all", q: "" });

  const [form, setForm] = useState<LabelFormValues>(EMPTY_LABEL_FORM);
  const [editing, setEditing] = useState<MailingLabelRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMailingLabels(filters);
      setLabels(data.labels);
      setSettings(data.settings);
      setSettingsLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load labels");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), filters.q ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, filters.q]);

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async (
    ids: string[],
    preset: LabelPresetId,
    options: LabelSheetOptions,
    markPrinted = true
  ) => {
    await withBusy(async () => {
      await printMailingLabels({ ids, preset, options, markPrinted });
      await load();
    });
  };

  const handleBulkStatus = async (ids: string[], status: MailingLabelStatus) => {
    await withBusy(async () => {
      await bulkMailingLabelAction(ids, { status });
      await load();
    });
  };

  const handleBulkDelete = async (ids: string[]) => {
    await withBusy(async () => {
      await bulkMailingLabelAction(ids, { action: "delete" });
      await load();
    });
  };

  const submitForm = async () => {
    setSavingForm(true);
    setFormError(null);
    try {
      if (editing) {
        await updateMailingLabelRequest(editing.id, form);
      } else {
        await createMailingLabelRequest(form);
      }
      setForm(EMPTY_LABEL_FORM);
      setEditing(null);
      await load();
      setTab("queue");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingForm(false);
    }
  };

  const startEdit = (record: MailingLabelRecord) => {
    setEditing(record);
    setForm(labelToFormValues(record));
    setFormError(null);
    setTab("add");
  };

  const saveSettings = async (patch: {
    sender?: SenderAddress;
    defaults?: MailingLabelSettings["defaults"];
  }) => {
    await withBusy(async () => {
      const next = await saveMailingLabelSettingsRequest(patch);
      setSettings(next);
    });
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="queue">Queue</TabsTrigger>
        <TabsTrigger value="add">{editing ? "Edit prospect" : "Add prospect"}</TabsTrigger>
        <TabsTrigger value="priority">Priority Mail</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="queue">
        {settingsLoaded ? (
          <LabelQueuePanel
            labels={labels}
            settings={settings}
            agent={agent}
            loading={loading}
            filters={filters}
            onFiltersChange={setFilters}
            onPrint={(ids, preset, options) => handlePrint(ids, preset, options, true)}
            onBulkStatus={handleBulkStatus}
            onBulkDelete={handleBulkDelete}
            onEdit={startEdit}
            busy={busy}
            error={error}
          />
        ) : (
          <p className="py-8 text-sm text-muted-foreground">Loading…</p>
        )}
      </TabsContent>

      <TabsContent value="add">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {editing ? "Edit prospect" : "Add a prospect by hand"}
            </CardTitle>
            <CardDescription>
              Leads from the Get Covered funnel, the intake form, and Leads the Way land in the
              queue on their own — use this for walk-ins, referrals, and anyone you met offline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LabelForm
              values={form}
              onChange={setForm}
              onSubmit={submitForm}
              onCancel={
                editing
                  ? () => {
                      setEditing(null);
                      setForm(EMPTY_LABEL_FORM);
                      setTab("queue");
                    }
                  : undefined
              }
              submitLabel={editing ? "Save changes" : "Add to queue"}
              saving={savingForm}
              error={formError}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="priority">
        {settingsLoaded ? (
          <PriorityMailPanel
            labels={labels}
            settings={settings}
            onPrint={(ids, preset, options) => handlePrint(ids, preset, options, false)}
            onGoToSettings={() => setTab("settings")}
            busy={busy}
            error={error}
          />
        ) : (
          <p className="py-8 text-sm text-muted-foreground">Loading…</p>
        )}
      </TabsContent>

      <TabsContent value="settings">
        {settingsLoaded ? (
          <LabelSettingsPanel
            key={`${settings.sender.addressLine1}-${settings.defaults.stickerPreset}`}
            settings={settings}
            onSave={saveSettings}
            saving={busy}
            error={error}
          />
        ) : (
          <p className="py-8 text-sm text-muted-foreground">Loading…</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
