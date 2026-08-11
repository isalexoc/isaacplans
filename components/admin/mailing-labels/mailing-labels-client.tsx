"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  bulkMailingLabelAction,
  createMailingLabelRequest,
  fetchMailingLabels,
  generateLetterRequest,
  printMailingLabels,
  printProspectLetters,
  saveLetterRequest,
  saveMailingLabelSettingsRequest,
  setLetterKindRequest,
  updateMailingLabelRequest,
} from "@/lib/mailing-labels/api";
import { DEFAULT_TAGLINES } from "@/lib/mailing-labels/format";
import {
  DEFAULT_SHIPPING_PRESET,
  DEFAULT_STICKER_PRESET,
  type LabelPresetId,
} from "@/lib/mailing-labels/presets";
import {
  EMPTY_AGENT_OVERRIDE,
  EMPTY_SENDER_ADDRESS,
  type LabelAgentContact,
  type LabelAgentOverride,
  type LetterKind,
  type LabelSheetOptions,
  type MailingLabelRecord,
  type MailingLabelSettings,
  type MailingLabelSource,
  type MailingLabelStatus,
  type SenderAddress,
} from "@/lib/mailing-labels/types";
import { EMPTY_LABEL_FORM, LabelForm, labelToFormValues, type LabelFormValues } from "./label-form";
import { LabelQueuePanel } from "./label-queue-panel";
import { LetterPanel } from "./letter-panel";
import { LabelSettingsPanel } from "./label-settings-panel";
import { PriorityMailPanel } from "./priority-mail-panel";

const FALLBACK_SETTINGS: MailingLabelSettings = {
  sender: EMPTY_SENDER_ADDRESS,
  agent: EMPTY_AGENT_OVERRIDE,
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

  /**
   * Status is filtered client-side rather than in the query: the Letter and Priority Mail tabs
   * need prospects whose sticker was already printed, and the queue defaults to "pending".
   * One fetch, three views.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMailingLabels({ source: filters.source, q: filters.q });
      setLabels(data.labels);
      setSettings(data.settings);
      setSettingsLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load labels");
    } finally {
      setLoading(false);
    }
  }, [filters.source, filters.q]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), filters.q ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, filters.q]);

  const queueLabels = useMemo(
    () =>
      filters.status === "all"
        ? labels
        : labels.filter((l) => l.status === filters.status),
    [labels, filters.status]
  );

  /** Archived prospects are done with — they shouldn't clutter the letter or shipping pickers. */
  const activeLabels = useMemo(
    () => labels.filter((l) => l.status !== "archived"),
    [labels]
  );

  /** Runs `fn`, surfacing any failure in the shared banner. Returns whether it succeeded. */
  const withBusy = async (fn: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
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

  /** Replace one label in place so the letter editor updates without a full reload. */
  const mergeLabel = (updated: MailingLabelRecord) =>
    setLabels((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  const generateLetter = async (id: string): Promise<MailingLabelRecord | null> => {
    let result: MailingLabelRecord | null = null;
    await withBusy(async () => {
      result = await generateLetterRequest(id);
      mergeLabel(result);
    });
    return result;
  };

  const saveLetter = async (id: string, body: string): Promise<MailingLabelRecord | null> => {
    let result: MailingLabelRecord | null = null;
    await withBusy(async () => {
      result = await saveLetterRequest(id, body);
      mergeLabel(result);
    });
    return result;
  };

  const setLetterKind = async (
    id: string,
    kind: LetterKind
  ): Promise<MailingLabelRecord | null> => {
    let result: MailingLabelRecord | null = null;
    await withBusy(async () => {
      result = await setLetterKindRequest(id, kind);
      mergeLabel(result);
    });
    return result;
  };

  const printLetters = async (ids: string[]) => {
    await withBusy(() => printProspectLetters(ids));
  };

  const saveSettings = async (patch: {
    sender?: SenderAddress;
    agent?: LabelAgentOverride;
    defaults?: MailingLabelSettings["defaults"];
  }): Promise<boolean> =>
    withBusy(async () => {
      const next = await saveMailingLabelSettingsRequest(patch);
      setSettings(next);
    });

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="queue">Queue</TabsTrigger>
        <TabsTrigger value="add">{editing ? "Edit prospect" : "Add prospect"}</TabsTrigger>
        <TabsTrigger value="letter">Letter</TabsTrigger>
        <TabsTrigger value="priority">Priority Mail</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="queue">
        {settingsLoaded ? (
          <LabelQueuePanel
            labels={queueLabels}
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
              showCrmPicker={!editing}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="letter">
        <LetterPanel
          labels={activeLabels}
          onGenerate={generateLetter}
          onSave={saveLetter}
          onSetKind={setLetterKind}
          onPrint={printLetters}
          busy={busy}
          error={error}
        />
      </TabsContent>

      <TabsContent value="priority">
        {settingsLoaded ? (
          <PriorityMailPanel
            labels={activeLabels}
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
            // Remount after a successful save so the form shows what was actually stored
            // (the server normalizes state/ZIP, and seeing the real stored value is the point).
            key={JSON.stringify(settings.sender)}
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
