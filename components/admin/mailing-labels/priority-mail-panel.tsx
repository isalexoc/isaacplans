"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Printer } from "lucide-react";
import { WhatsAppMark } from "@/components/icons/whatsapp-mark";
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
  isCompleteSenderAddress,
  mailingLabelDisplayName,
  missingSenderFields,
} from "@/lib/mailing-labels/format";
import {
  getLabelPreset,
  LABEL_PRESETS,
  SHIPPING_PRESET_IDS,
  type LabelPresetId,
} from "@/lib/mailing-labels/presets";
import type {
  LabelAgentContact,
  LabelSheetOptions,
  MailingLabelRecord,
  MailingLabelSettings,
} from "@/lib/mailing-labels/types";
import { LabelPreview } from "./label-preview";

/**
 * Priority Mail mode: return address over delivery address, one recipient per page. Separate from
 * the everyday Avery sticker because it's used occasionally (shipped packages) and has different
 * rules — the sender block is mandatory and there's no tagline or decoration competing.
 *
 * The output is printed, trimmed, and pasted into the white area of a real USPS Label 228 tag, so
 * it deliberately prints neither "FROM:" nor "TO:" — the tag already has both.
 */

export function PriorityMailPanel({
  labels,
  settings,
  agent,
  onPrint,
  onGoToSettings,
  busy,
  error,
}: {
  labels: MailingLabelRecord[];
  settings: MailingLabelSettings;
  agent: LabelAgentContact | null;
  onPrint: (ids: string[], preset: LabelPresetId, options: LabelSheetOptions) => Promise<void>;
  onGoToSettings: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [presetId, setPresetId] = useState<LabelPresetId>(
    settings.defaults.shippingPreset as LabelPresetId
  );
  const [showLogo, setShowLogo] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(settings.defaults.showWhatsapp);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const preset = getLabelPreset(presetId);
  const senderReady = isCompleteSenderAddress(settings.sender);
  const missing = useMemo(() => missingSenderFields(settings.sender), [settings.sender]);

  const options: LabelSheetOptions = useMemo(
    () => ({
      startOffset: 0,
      showLogo,
      showAgentContact: false,
      showWhatsapp,
      taglines: settings.defaults.taglines,
    }),
    [showLogo, showWhatsapp, settings.defaults.taglines]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return labels;
    return labels.filter((l) =>
      [l.firstName, l.lastName, l.city, l.addressLine1]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [labels, query]);

  const selectedIds = useMemo(
    () => labels.filter((l) => selected.has(l.id)).map((l) => l.id),
    [labels, selected]
  );

  const previewRecord = labels.find((l) => selected.has(l.id)) ?? labels[0] ?? null;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {!senderReady ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Add your sender address first
            </CardTitle>
            <CardDescription>
              USPS requires a return address on Priority Mail. Missing: {missing.join(", ")}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={onGoToSettings}>
              Open Settings
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Priority Mail label</CardTitle>
          <CardDescription>{preset.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_auto]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ml-ship-preset">Label size</Label>
                <Select value={presetId} onValueChange={(v) => setPresetId(v as LabelPresetId)}>
                  <SelectTrigger id="ml-ship-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIPPING_PRESET_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {LABEL_PRESETS[id].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Switch id="ml-ship-logo" checked={showLogo} onCheckedChange={setShowLogo} />
                <Label htmlFor="ml-ship-logo" className="font-normal">
                  Senior Life logo
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Prints beside the return address. Off by default so nothing competes with the
                address blocks — carriers and scanners read a clean label best.
              </p>

              <div className="flex items-center gap-3">
                <Switch
                  id="ml-ship-whatsapp"
                  checked={showWhatsapp}
                  onCheckedChange={setShowWhatsapp}
                />
                <Label
                  htmlFor="ml-ship-whatsapp"
                  className="flex items-center gap-1.5 font-normal"
                >
                  <WhatsAppMark size={15} />
                  My WhatsApp number
                  {agent?.whatsapp ? (
                    <span className="text-muted-foreground">— {agent.whatsapp}</span>
                  ) : null}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Added under the return address, so whoever opens the package can message you
                back. Change the number in Settings.
              </p>

              <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                No &ldquo;FROM:&rdquo; or &ldquo;TO:&rdquo; is printed — the USPS Label 228 tag you
                paste this onto already has both.
              </p>

              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p className="font-medium">Sender (FROM)</p>
                {senderReady ? (
                  <div className="text-muted-foreground">
                    {[settings.sender.businessName, settings.sender.contactName]
                      .filter(Boolean)
                      .map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    <div>{settings.sender.addressLine1}</div>
                    {settings.sender.addressLine2 ? (
                      <div>{settings.sender.addressLine2}</div>
                    ) : null}
                    <div>
                      {settings.sender.city}, {settings.sender.state}{" "}
                      {settings.sender.postalCode}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not set yet.</p>
                )}
                <Button variant="link" className="h-auto p-0 text-xs" onClick={onGoToSettings}>
                  Edit in Settings
                </Button>
              </div>
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
                  previewScale={presetId === "usps_half_5126" ? 0.42 : 0.62}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Add a prospect to see a preview.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              onClick={async () => {
                await onPrint(selectedIds, presetId, options);
                setSelected(new Set());
              }}
              disabled={busy || selectedIds.length === 0 || !senderReady}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              Generate PDF
              {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Button>
            {selectedIds.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {Math.ceil(selectedIds.length / preset.perPage)}{" "}
                {Math.ceil(selectedIds.length / preset.perPage) === 1 ? "page" : "pages"}
              </span>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Who are you shipping to?</CardTitle>
          <CardDescription>
            Pick from the same queue. Printing here does not mark the label printed — the sticker
            and the shipping label are separate jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, or street"
          />
          {visible.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No prospects match.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {visible.map((record) => (
                <li key={record.id} className="flex items-start gap-3 p-3">
                  <Checkbox
                    id={`ml-ship-${record.id}`}
                    checked={selected.has(record.id)}
                    onCheckedChange={() => toggleOne(record.id)}
                  />
                  <Label htmlFor={`ml-ship-${record.id}`} className="cursor-pointer font-normal">
                    <span className="font-medium">{mailingLabelDisplayName(record)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {record.addressLine1}
                      {record.addressLine2 ? `, ${record.addressLine2}` : ""} — {record.city},{" "}
                      {record.state} {record.postalCode}
                    </span>
                  </Label>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
