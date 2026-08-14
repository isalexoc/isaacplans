"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { WhatsAppMark } from "@/components/icons/whatsapp-mark";
import IntakeAddressInput, { type ResolvedAddress } from "@/components/shared/intake-address-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import {
  missingSenderFields,
  normalizeStateCode,
  normalizeZip,
} from "@/lib/mailing-labels/format";
import {
  LABEL_PRESETS,
  SHIPPING_PRESET_IDS,
  STICKER_PRESET_IDS,
} from "@/lib/mailing-labels/presets";
import type {
  LabelAgentOverride,
  MailingLabelSettings,
  SenderAddress,
} from "@/lib/mailing-labels/types";

/**
 * Two groups of settings, both stored in the shared `app_settings` table:
 *  - the Priority Mail sender address (typed once, reused on every shipping label)
 *  - print defaults that pre-fill the sheet options
 */

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

export function LabelSettingsPanel({
  settings,
  onSave,
  saving,
  error,
}: {
  settings: MailingLabelSettings;
  /** Resolves true only when the save actually succeeded, so "Saved" can't lie. */
  onSave: (patch: {
    sender?: SenderAddress;
    agent?: LabelAgentOverride;
    defaults?: MailingLabelSettings["defaults"];
  }) => Promise<boolean>;
  saving: boolean;
  error: string | null;
}) {
  const [sender, setSender] = useState<SenderAddress>(settings.sender);
  const [agent, setAgent] = useState<LabelAgentOverride>(settings.agent);
  const [defaults, setDefaults] = useState(settings.defaults);
  const [saved, setSaved] = useState(false);

  // A partly filled sender is the failure mode that bit us: everything looked filled in, but the
  // state dropdown was untouched, so Priority Mail silently stayed disabled with no explanation
  // on this screen. Surface exactly what's still missing, per field and in summary.
  const missing = missingSenderFields(sender);
  const senderTouched = Object.values(sender).some((v) => v.trim() !== "");
  const senderIncomplete = senderTouched && missing.length > 0;
  const needsState = !normalizeStateCode(sender.state);
  const needsZip = !normalizeZip(sender.postalCode);

  const setSenderField = <K extends keyof SenderAddress>(key: K, value: SenderAddress[K]) =>
    setSender((prev) => ({ ...prev, [key]: value }));

  const applyResolved = (addr: ResolvedAddress) =>
    setSender((prev) => ({
      ...prev,
      addressLine1: addr.line1 || prev.addressLine1,
      city: addr.city || prev.city,
      state: addr.state || prev.state,
      postalCode: addr.zip || prev.postalCode,
    }));

  const save = async () => {
    setSaved(false);
    const ok = await onSave({ sender, agent, defaults });
    if (!ok) return; // The shared error banner explains why.
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Sender address (Priority Mail only)</CardTitle>
          <CardDescription>
            Printed in the FROM block of a Priority Mail label. It never appears on the everyday
            Avery sticker. Every field except the suite and phone is required — USPS won&apos;t take
            a partial return address, so Priority Mail stays locked until this is complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {senderIncomplete ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Still needed before you can print a Priority Mail label:{" "}
                <strong>{missing.join(", ")}</strong>.
              </span>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ml-sender-business">Business name</Label>
              <Input
                id="ml-sender-business"
                value={sender.businessName}
                onChange={(e) => setSenderField("businessName", e.target.value)}
                placeholder="Isaac Plans Insurance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-sender-contact">Your name</Label>
              <Input
                id="ml-sender-contact"
                value={sender.contactName}
                onChange={(e) => setSenderField("contactName", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ml-sender-address1">
              Street address{" "}
              {senderTouched && !sender.addressLine1.trim() ? <RequiredMark /> : null}
            </Label>
            <IntakeAddressInput
              id="ml-sender-address1"
              value={sender.addressLine1}
              onChange={(v) => setSenderField("addressLine1", v)}
              onResolve={applyResolved}
              placeholder="Start typing your address…"
              locale="en"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ml-sender-address2">Suite / unit (optional)</Label>
            <Input
              id="ml-sender-address2"
              value={sender.addressLine2}
              onChange={(e) => setSenderField("addressLine2", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ml-sender-city">
                City {senderTouched && !sender.city.trim() ? <RequiredMark /> : null}
              </Label>
              <Input
                id="ml-sender-city"
                value={sender.city}
                onChange={(e) => setSenderField("city", e.target.value)}
                className={senderTouched && !sender.city.trim() ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-sender-state">
                State {senderTouched && needsState ? <RequiredMark /> : null}
              </Label>
              <Select
                value={sender.state || undefined}
                onValueChange={(v) => setSenderField("state", v)}
              >
                <SelectTrigger
                  id="ml-sender-state"
                  className={senderTouched && needsState ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATE_OPTIONS.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-sender-zip">
                ZIP {senderTouched && needsZip ? <RequiredMark /> : null}
              </Label>
              <Input
                id="ml-sender-zip"
                value={sender.postalCode}
                onChange={(e) => setSenderField("postalCode", e.target.value)}
                inputMode="numeric"
                className={senderTouched && needsZip ? "border-destructive" : ""}
              />
            </div>
          </div>

          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="ml-sender-phone">Phone (optional)</Label>
            <Input
              id="ml-sender-phone"
              value={sender.phone}
              onChange={(e) => setSenderField("phone", e.target.value)}
              placeholder="(407) 555-0123"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">How you sign labels and letters</CardTitle>
          <CardDescription>
            Leave a field blank to use your Leave-Behind agent profile. Fill one in to print
            something different — a shorter name, or a separate number for mailers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ml-agent-name">Name to print</Label>
              <Input
                id="ml-agent-name"
                value={agent.name}
                onChange={(e) => setAgent((p) => ({ ...p, name: e.target.value }))}
                placeholder="Isaac Orraiz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-agent-phone">Phone to print</Label>
              <Input
                id="ml-agent-phone"
                value={agent.phone}
                onChange={(e) => setAgent((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(540) 426-1804"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-agent-whatsapp" className="flex items-center gap-1.5">
                <WhatsAppMark size={15} />
                WhatsApp to print
              </Label>
              <Input
                id="ml-agent-whatsapp"
                value={agent.whatsapp}
                onChange={(e) => setAgent((p) => ({ ...p, whatsapp: e.target.value }))}
                placeholder="(540) 681-3507"
              />
              <p className="text-xs text-muted-foreground">
                Your WhatsApp line, which is not the same number as the phone above. Blank uses
                your published one, (540) 681-3507.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-agent-email">Email on letters</Label>
              <Input
                id="ml-agent-email"
                type="email"
                value={agent.email}
                onChange={(e) => setAgent((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Print defaults</CardTitle>
          <CardDescription>What the sheet options start out set to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ml-def-sticker">Default sticker size</Label>
              <Select
                value={defaults.stickerPreset}
                onValueChange={(v) => setDefaults((p) => ({ ...p, stickerPreset: v }))}
              >
                <SelectTrigger id="ml-def-sticker">
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
              <Label htmlFor="ml-def-shipping">Default Priority Mail size</Label>
              <Select
                value={defaults.shippingPreset}
                onValueChange={(v) => setDefaults((p) => ({ ...p, shippingPreset: v }))}
              >
                <SelectTrigger id="ml-def-shipping">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ml-def-tag-en">Tagline (English)</Label>
              <Input
                id="ml-def-tag-en"
                value={defaults.taglines.en}
                onChange={(e) =>
                  setDefaults((p) => ({ ...p, taglines: { ...p.taglines, en: e.target.value } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ml-def-tag-es">Tagline (Spanish)</Label>
              <Input
                id="ml-def-tag-es"
                value={defaults.taglines.es}
                onChange={(e) =>
                  setDefaults((p) => ({ ...p, taglines: { ...p.taglines, es: e.target.value } }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="ml-def-logo"
              checked={defaults.showLogo}
              onCheckedChange={(v) => setDefaults((p) => ({ ...p, showLogo: v }))}
            />
            <Label htmlFor="ml-def-logo" className="font-normal">
              Show the Senior Life logo header by default
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="ml-def-agent"
              checked={defaults.showAgentContact}
              onCheckedChange={(v) => setDefaults((p) => ({ ...p, showAgentContact: v }))}
            />
            <Label htmlFor="ml-def-agent" className="font-normal">
              Show my name &amp; phone by default
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="ml-def-whatsapp"
              checked={defaults.showWhatsapp}
              onCheckedChange={(v) => setDefaults((p) => ({ ...p, showWhatsapp: v }))}
            />
            <Label htmlFor="ml-def-whatsapp" className="flex items-center gap-1.5 font-normal">
              <WhatsAppMark size={15} />
              Show my WhatsApp number by default
            </Label>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save settings
        </Button>
        {saved ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-4 w-4" /> Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}
