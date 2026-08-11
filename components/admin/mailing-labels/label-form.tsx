"use client";

import { useMemo, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import IntakeAddressInput, { type ResolvedAddress } from "@/components/shared/intake-address-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import {
  isPrintableAddress,
  normalizeStateCode,
  normalizeZip,
} from "@/lib/mailing-labels/format";
import { CrmContactPicker } from "./crm-contact-picker";
import type {
  MailingLabelInput,
  MailingLabelLanguage,
  MailingLabelRecord,
} from "@/lib/mailing-labels/types";

/**
 * Manual add / edit form for one prospect. Street address uses the shared Places autocomplete
 * (components/shared/intake-address-input.tsx), which fills city, state, and ZIP in one pick —
 * and falls back to a plain text input when the Maps key is missing.
 */

export type LabelFormValues = MailingLabelInput;

const EMPTY: LabelFormValues = {
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  language: "en",
  phone: "",
  email: "",
  notes: "",
  crmContactId: null,
};

export function labelToFormValues(record: MailingLabelRecord): LabelFormValues {
  return {
    firstName: record.firstName,
    lastName: record.lastName,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode,
    language: record.language,
    phone: record.phone,
    email: record.email,
    notes: record.notes,
    crmContactId: record.crmContactId,
  };
}

export function LabelForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  saving,
  error,
  showCrmPicker,
}: {
  values: LabelFormValues;
  onChange: (next: LabelFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  /** Hidden while editing an existing row — the CRM link is already settled by then. */
  showCrmPicker?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof LabelFormValues>(key: K, value: LabelFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const canSubmit = useMemo(() => isPrintableAddress(values), [values]);
  const showInvalid = touched && !canSubmit;

  const applyResolved = (addr: ResolvedAddress) => {
    onChange({
      ...values,
      addressLine1: addr.line1 || values.addressLine1,
      city: addr.city || values.city,
      state: addr.state || values.state,
      postalCode: addr.zip || values.postalCode,
    });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (canSubmit) onSubmit();
      }}
    >
      {showCrmPicker ? (
        <CrmContactPicker
          disabled={saving}
          onPick={(contact) =>
            onChange({
              ...values,
              firstName: contact.firstName || values.firstName,
              lastName: contact.lastName || values.lastName,
              addressLine1: contact.address1 || values.addressLine1,
              city: contact.city || values.city,
              state: normalizeStateCode(contact.state) || values.state,
              postalCode: normalizeZip(contact.postalCode) || values.postalCode,
              phone: contact.phone || values.phone,
              email: contact.email || values.email,
              crmContactId: contact.id,
            })
          }
        />
      ) : null}

      {values.crmContactId ? (
        <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <Link2 className="h-4 w-4" />
          Linked to a CRM contact — their call notes will personalize the letter.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ml-first-name">First name</Label>
          <Input
            id="ml-first-name"
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ml-last-name">Last name</Label>
          <Input
            id="ml-last-name"
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ml-address1">
          Street address <span className="text-destructive">*</span>
        </Label>
        <IntakeAddressInput
          id="ml-address1"
          value={values.addressLine1}
          onChange={(v) => set("addressLine1", v)}
          onResolve={applyResolved}
          placeholder="Start typing the address…"
          locale="en"
          invalid={showInvalid && !values.addressLine1.trim()}
        />
        <p className="text-xs text-muted-foreground">
          Picking a suggestion fills in the city, state, and ZIP automatically.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ml-address2">Apt / unit / suite (optional)</Label>
        <Input
          id="ml-address2"
          value={values.addressLine2 ?? ""}
          onChange={(e) => set("addressLine2", e.target.value)}
          placeholder="Apt 3B"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ml-city">
            City <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ml-city"
            value={values.city}
            onChange={(e) => set("city", e.target.value)}
            className={showInvalid && !values.city.trim() ? "border-destructive" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ml-state">
            State <span className="text-destructive">*</span>
          </Label>
          <Select value={values.state || undefined} onValueChange={(v) => set("state", v)}>
            <SelectTrigger
              id="ml-state"
              className={showInvalid && !values.state ? "border-destructive" : ""}
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
          <Label htmlFor="ml-zip">
            ZIP <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ml-zip"
            value={values.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            inputMode="numeric"
            placeholder="33134"
            className={showInvalid && !values.postalCode.trim() ? "border-destructive" : ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="ml-language">Label language</Label>
          <Select
            value={values.language ?? "en"}
            onValueChange={(v) => set("language", v as MailingLabelLanguage)}
          >
            <SelectTrigger id="ml-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ml-phone">Phone (not printed)</Label>
          <Input
            id="ml-phone"
            value={values.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="(407) 555-0123"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ml-email">Email (not printed)</Label>
          <Input
            id="ml-email"
            type="email"
            value={values.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ml-notes">Notes (not printed)</Label>
        <Textarea
          id="ml-notes"
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          placeholder="What are you mailing them?"
        />
      </div>

      {showInvalid ? (
        <p className="text-sm text-destructive">
          A street address, city, state, and ZIP code are all required to print a label.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export { EMPTY as EMPTY_LABEL_FORM };
