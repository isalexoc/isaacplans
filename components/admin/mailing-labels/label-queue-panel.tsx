"use client";

import { useMemo, useState } from "react";
import { Loader2, Printer, RotateCcw, Trash2, Archive, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mailingLabelDisplayName } from "@/lib/mailing-labels/format";
import {
  getLabelPreset,
  isStickerPreset,
  LABEL_PRESETS,
  STICKER_PRESET_IDS,
  type LabelPresetId,
} from "@/lib/mailing-labels/presets";
import {
  MAILING_LABEL_SOURCE_LABELS,
  MAILING_LABEL_SOURCES,
  type LabelAgentContact,
  type LabelSheetOptions,
  type MailingLabelRecord,
  type MailingLabelSettings,
  type MailingLabelSource,
  type MailingLabelStatus,
} from "@/lib/mailing-labels/types";
import { LabelPreview } from "./label-preview";

const STATUS_STYLES: Record<MailingLabelStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  printed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  archived: "bg-muted text-muted-foreground",
};

export function LabelQueuePanel({
  labels,
  settings,
  agent,
  loading,
  filters,
  onFiltersChange,
  onPrint,
  onBulkStatus,
  onBulkDelete,
  onEdit,
  busy,
  error,
}: {
  labels: MailingLabelRecord[];
  settings: MailingLabelSettings;
  agent: LabelAgentContact | null;
  loading: boolean;
  filters: { status: MailingLabelStatus | "all"; source: MailingLabelSource | "all"; q: string };
  onFiltersChange: (next: {
    status: MailingLabelStatus | "all";
    source: MailingLabelSource | "all";
    q: string;
  }) => void;
  onPrint: (ids: string[], preset: LabelPresetId, options: LabelSheetOptions) => Promise<void>;
  onBulkStatus: (ids: string[], status: MailingLabelStatus) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onEdit: (record: MailingLabelRecord) => void;
  busy: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [presetId, setPresetId] = useState<LabelPresetId>(
    settings.defaults.stickerPreset as LabelPresetId
  );
  const [startOffset, setStartOffset] = useState(0);
  const [showLogo, setShowLogo] = useState(settings.defaults.showLogo);
  const [showAgentContact, setShowAgentContact] = useState(settings.defaults.showAgentContact);
  const [taglineEn, setTaglineEn] = useState(settings.defaults.taglines.en);
  const [taglineEs, setTaglineEs] = useState(settings.defaults.taglines.es);

  const preset = getLabelPreset(presetId);
  const supportsBranding = isStickerPreset(preset) && preset.supportsBranding;

  const options: LabelSheetOptions = useMemo(
    () => ({
      startOffset,
      showLogo,
      showAgentContact,
      taglines: { en: taglineEn, es: taglineEs },
    }),
    [startOffset, showLogo, showAgentContact, taglineEn, taglineEs]
  );

  const selectedIds = useMemo(
    () => labels.filter((l) => selected.has(l.id)).map((l) => l.id),
    [labels, selected]
  );

  const allVisibleSelected = labels.length > 0 && labels.every((l) => selected.has(l.id));

  const toggleAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(labels.map((l) => l.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const previewRecord =
    labels.find((l) => selected.has(l.id)) ?? labels[0] ?? null;

  const sheetsNeeded = isStickerPreset(preset)
    ? Math.max(1, Math.ceil((startOffset + Math.max(selectedIds.length, 1)) / preset.perPage))
    : Math.max(1, Math.ceil(Math.max(selectedIds.length, 1) / preset.perPage));

  const run = async (fn: () => Promise<void>) => {
    await fn();
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Sheet options</CardTitle>
          <CardDescription>
            {isStickerPreset(preset) ? preset.description : preset.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ml-preset">Label size</Label>
                  <Select
                    value={presetId}
                    onValueChange={(v) => {
                      setPresetId(v as LabelPresetId);
                      setStartOffset(0);
                    }}
                  >
                    <SelectTrigger id="ml-preset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STICKER_PRESET_IDS.map((id) => (
                        <SelectItem key={id} value={id}>
                          {LABEL_PRESETS[id].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ml-start">Start at position</Label>
                  <Select
                    value={String(startOffset)}
                    onValueChange={(v) => setStartOffset(Number(v))}
                  >
                    <SelectTrigger id="ml-start">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: preset.perPage }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {i === 0 ? "1 (full sheet)" : `${i + 1} — skip first ${i}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Reuse a partly used sheet by skipping the labels you already peeled off.
                  </p>
                </div>
              </div>

              {supportsBranding ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch id="ml-logo" checked={showLogo} onCheckedChange={setShowLogo} />
                    <Label htmlFor="ml-logo" className="font-normal">
                      Senior Life logo header
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      id="ml-agent"
                      checked={showAgentContact}
                      onCheckedChange={setShowAgentContact}
                    />
                    <Label htmlFor="ml-agent" className="font-normal">
                      My name &amp; phone
                      {agent ? "" : " (add them in the Leave-Behind profile first)"}
                    </Label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ml-tag-en">Tagline (English labels)</Label>
                      <Input
                        id="ml-tag-en"
                        value={taglineEn}
                        onChange={(e) => setTaglineEn(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ml-tag-es">Tagline (Spanish labels)</Label>
                      <Input
                        id="ml-tag-es"
                        value={taglineEs}
                        onChange={(e) => setTaglineEs(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This size prints the address only — a logo and footer aren&apos;t legible at 1
                  inch tall.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              {previewRecord ? (
                <LabelPreview
                  record={previewRecord}
                  preset={preset}
                  options={options}
                  agent={agent}
                  sender={settings.sender}
                  previewScale={0.9}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Add a prospect to see a preview.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              onClick={() => run(() => onPrint(selectedIds, presetId, options))}
              disabled={busy || selectedIds.length === 0}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              Generate PDF
              {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Button>
            <Button
              variant="outline"
              onClick={() => run(() => onBulkStatus(selectedIds, "pending"))}
              disabled={busy || selectedIds.length === 0}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to pending
            </Button>
            <Button
              variant="outline"
              onClick={() => run(() => onBulkStatus(selectedIds, "archived"))}
              disabled={busy || selectedIds.length === 0}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => run(() => onBulkDelete(selectedIds))}
              disabled={busy || selectedIds.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            {selectedIds.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {sheetsNeeded} {sheetsNeeded === 1 ? "sheet" : "sheets"}
              </span>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="text-base">Queue</CardTitle>
              <CardDescription>
                {labels.length} {labels.length === 1 ? "prospect" : "prospects"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="ml-q" className="text-xs">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ml-q"
                    className="w-44 pl-8"
                    value={filters.q}
                    placeholder="Name, city, street"
                    onChange={(e) => onFiltersChange({ ...filters, q: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(v) =>
                    onFiltersChange({ ...filters, status: v as MailingLabelStatus | "all" })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="printed">Printed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Source</Label>
                <Select
                  value={filters.source}
                  onValueChange={(v) =>
                    onFiltersChange({ ...filters, source: v as MailingLabelSource | "all" })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {MAILING_LABEL_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MAILING_LABEL_SOURCE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : labels.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              Nothing here yet. Labels appear automatically when a lead&apos;s address comes in, or
              add one by hand from the <strong>Add prospect</strong> tab.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labels.map((record) => (
                    <TableRow key={record.id} data-state={selected.has(record.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(record.id)}
                          onCheckedChange={() => toggleOne(record.id)}
                          aria-label={`Select ${mailingLabelDisplayName(record)}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {mailingLabelDisplayName(record)}
                        {record.language === "es" ? (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            ES
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.addressLine1}
                        {record.addressLine2 ? `, ${record.addressLine2}` : ""}
                        <br />
                        {record.city}, {record.state} {record.postalCode}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {MAILING_LABEL_SOURCE_LABELS[record.source]}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[record.status]}`}
                        >
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(record)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
