"use client";

import { Input } from "@/components/ui/input";
import { CARRIER_OPTIONS, getCarrier } from "@/lib/illustration-studio/carriers";
import { COVER_PHOTOS, coverPhotoThumbUrl } from "@/lib/illustration-studio/cover-photos";
import { MAX_PRESENTED_BY_LINES } from "@/lib/illustration-studio/pdf/theme";
import {
  COVER_PHOTO_KEYS,
  PREMIUM_MODES,
  type CarrierKey,
  type IllustrationExtraction,
  type PremiumMode,
  type PresentationData,
} from "@/lib/illustration-studio/types";
import { Field, Flag, MoneyInput, Section, SELECT_CLASS } from "./fields";

type Update = (patch: Partial<PresentationData>) => void;

/**
 * Re-brands for another carrier (detection can be wrong when an illustration names a second company
 * often). Text the agent or the illustration supplied is kept; only the old carrier's stock values
 * follow the switch.
 */
function switchCarrier(p: PresentationData, key: CarrierKey): Partial<PresentationData> {
  const from = getCarrier(p.carrierKey);
  const to = getCarrier(key);
  const follow = (current: string, oldDefault: string, newDefault: string) =>
    newDefault && (!current || current === oldDefault) ? newDefault : current;
  return {
    carrierKey: key,
    carrierDisplayName: follow(p.carrierDisplayName, from.displayName, to.displayName),
    issuerName: follow(p.issuerName, from.defaultIssuer, to.defaultIssuer),
    issuerLocation: follow(p.issuerLocation, from.defaultIssuerLocation, to.defaultIssuerLocation),
  };
}

export function ClientPolicySection({ p, update }: { p: PresentationData; update: Update }) {
  return (
    <Section title="Client & policy">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Client name"
          htmlFor="is-client"
          flag={p.clientName.trim() ? undefined : "Blank — the cover's “For …” line is left off."}
        >
          <Input id="is-client" maxLength={120} value={p.clientName} onChange={(e) => update({ clientName: e.target.value })} />
        </Field>
        <Field label="Prepared on" htmlFor="is-date">
          <Input
            id="is-date"
            type="date"
            value={p.preparedDate}
            onChange={(e) => e.target.value && update({ preparedDate: e.target.value })}
          />
        </Field>
        <Field label="Carrier" htmlFor="is-carrier" hint="Sets the logo and colors.">
          <select
            id="is-carrier"
            className={SELECT_CLASS}
            value={p.carrierKey}
            onChange={(e) => update(switchCarrier(p, e.target.value as CarrierKey))}
          >
            {CARRIER_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Carrier name as printed" htmlFor="is-carrier-name" hint="In the disclaimers and the PDF's title.">
          <Input
            id="is-carrier-name"
            maxLength={80}
            value={p.carrierDisplayName}
            onChange={(e) => update({ carrierDisplayName: e.target.value })}
          />
        </Field>
        <Field label="Product name" htmlFor="is-product" hint="The cover headline.">
          <Input id="is-product" maxLength={120} value={p.productName} onChange={(e) => update({ productName: e.target.value })} />
        </Field>
        <Field label="Product line" htmlFor="is-line" hint="The band under the headline.">
          <Input id="is-line" maxLength={80} value={p.productLine} onChange={(e) => update({ productLine: e.target.value })} />
        </Field>
        <Field label="Issued by" htmlFor="is-issuer">
          <Input id="is-issuer" maxLength={160} value={p.issuerName} onChange={(e) => update({ issuerName: e.target.value })} />
        </Field>
        <Field label="Issuer city, state" htmlFor="is-issuer-location">
          <Input
            id="is-issuer-location"
            maxLength={160}
            value={p.issuerLocation}
            onChange={(e) => update({ issuerLocation: e.target.value })}
          />
        </Field>
        <Field label="Policy form" htmlFor="is-form">
          <Input id="is-form" maxLength={80} value={p.policyForm} onChange={(e) => update({ policyForm: e.target.value })} />
        </Field>
      </div>
    </Section>
  );
}

/** The amber note for a number the grounding check couldn't find in the PDF — while it's unchanged. */
function groundingFlag(value: number, extracted: number | null, verified: boolean, missing: string): string | undefined {
  if (value <= 0) return missing;
  if (!verified && extracted !== null && value === extracted) {
    return "Not found in the illustration's text — check it against the PDF.";
  }
  return undefined;
}

export function PremiumSection({
  p,
  extraction,
  update,
}: {
  p: PresentationData;
  extraction: IllustrationExtraction;
  update: Update;
}) {
  return (
    <Section title="Premium & death benefit">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)]">
        <Field
          label="Planned premium"
          htmlFor="is-premium"
          flag={groundingFlag(p.premium.amount, extraction.premium.amount, extraction.premium.verified, "Enter the planned premium.")}
        >
          <MoneyInput
            id="is-premium"
            cents
            value={p.premium.amount}
            onChange={(amount) => update({ premium: { ...p.premium, amount } })}
          />
        </Field>
        <Field label="Paid" htmlFor="is-mode">
          <select
            id="is-mode"
            className={SELECT_CLASS}
            value={p.premium.mode}
            onChange={(e) => update({ premium: { ...p.premium, mode: e.target.value as PremiumMode } })}
          >
            {PREMIUM_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Death benefit"
          htmlFor="is-db"
          flag={groundingFlag(p.deathBenefit, extraction.initialDeathBenefit, extraction.initialDeathBenefitVerified, "Enter the death benefit.")}
        >
          <MoneyInput id="is-db" value={p.deathBenefit} onChange={(deathBenefit) => update({ deathBenefit })} />
        </Field>
      </div>
    </Section>
  );
}

export function CoverSection({ p, update }: { p: PresentationData; update: Update }) {
  // An illustration can supply more lines than fit; they stay visible (and flagged) until removed.
  const count = Math.max(MAX_PRESENTED_BY_LINES, p.presentedBy.lines.length);
  const lines = Array.from({ length: count }, (_, i) => p.presentedBy.lines[i] ?? "");

  function setLine(index: number, value: string) {
    const next = lines.map((line, i) => (i === index ? value : line));
    // Trailing blanks are dropped so the card doesn't print empty lines; ones in between are kept.
    while (next.length > 0 && !next[next.length - 1].trim()) next.pop();
    update({ presentedBy: { ...p.presentedBy, lines: next } });
  }

  return (
    <Section title="Cover">
      <fieldset>
        <legend className="text-sm font-medium">Photo</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COVER_PHOTO_KEYS.map((key) => {
            const selected = p.coverPhoto === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => update({ coverPhoto: key })}
                className={`overflow-hidden rounded-md border-2 text-left transition ${
                  selected ? "border-brand ring-2 ring-brand/30" : "border-transparent hover:border-muted-foreground/40"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary already sizes it */}
                <img src={coverPhotoThumbUrl(key)} alt="" className="aspect-[4/3] w-full object-cover" />
                <span className="block px-2 py-1 text-xs">{COVER_PHOTOS[key].label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-3">
        <Field
          label="Presented by"
          htmlFor="is-agent"
          hint="Kept for your next summary."
          flag={p.presentedBy.name.trim() ? undefined : "Blank — the “Presented By” card will be empty."}
        >
          <Input
            id="is-agent"
            maxLength={120}
            placeholder="Your name"
            value={p.presentedBy.name}
            onChange={(e) => update({ presentedBy: { ...p.presentedBy, name: e.target.value } })}
          />
        </Field>
        {lines.map((line, i) => (
          <div key={i}>
            <Input
              aria-label={`Presented by, line ${i + 1}`}
              maxLength={160}
              placeholder={["Agency or street address", "City, state ZIP", "Phone or email"][i]}
              value={line}
              onChange={(e) => setLine(i, e.target.value)}
            />
            {i >= MAX_PRESENTED_BY_LINES && line.trim() && (
              <Flag>Only {MAX_PRESENTED_BY_LINES} lines fit on the cover — this one won&apos;t print.</Flag>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
