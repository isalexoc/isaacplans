/**
 * The CRM update payload built from DECRYPTED intake answers. Pure (no DB, no network): the engine's
 * sync calls it, and `pnpm test:intake-autosave` checks it never carries an SSN, card or bank
 * number. Moved out of server.ts, which re-exports it.
 */

import type { AgentCrmCustomFieldValue, AgentCrmNativeFields } from "@/lib/agent-crm-contacts";
import { isFieldVisible, isRowFilled, allRepeaterFields } from "./fields";
import { crmFieldId } from "./ghl-field-ids";
import type { IntakeData, IntakeLobConfig, RepeaterRow } from "./types";

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

/** Default row rendering: `Label: value` pairs, unambiguous when read in the CRM. */
function defaultRowFormat(
  field: { rowFields?: { key: string; type: string; labelEn: string; crmLabel?: string }[] },
  row: RepeaterRow,
  index: number
): string {
  const parts: string[] = [];
  for (const sub of field.rowFields ?? []) {
    if (sub.type === "file") continue;
    const value = str(row[sub.key]);
    if (value) parts.push(`${sub.crmLabel ?? sub.labelEn}: ${value}`);
  }
  return parts.length ? `${index + 1}. ${parts.join(" | ")}` : "";
}

/**
 * Build the CRM update payload from DECRYPTED intake data.
 *
 * Native fields go on the contact body; custom fields resolve slug→id (unprovisioned ids are
 * collected into `skippedSlugs` and skipped, so a half-provisioned line still syncs). Repeaters
 * flatten either into one slot per row (`crmSlots`) or into a single newline-joined text field
 * (`crm`), because a GHL contact cannot hold a nested list.
 */
export function buildCrmPayloadFromData(
  config: IntakeLobConfig,
  data: IntakeData,
  /** Slug → GHL field id. Tests pass one that "provisions" every slug. */
  resolveId: (lob: string, slug: string) => string | null | undefined = crmFieldId
): {
  native: AgentCrmNativeFields;
  customFields: AgentCrmCustomFieldValue[];
  skippedSlugs: string[];
} {
  const native: AgentCrmNativeFields = {};
  const customFields: AgentCrmCustomFieldValue[] = [];
  const skippedSlugs: string[] = [];

  const pushCustom = (slug: string, value: string) => {
    const id = resolveId(config.lob, slug);
    if (!id) {
      skippedSlugs.push(slug);
      return;
    }
    customFields.push({ id, field_value: value });
  };

  for (const section of config.sections) {
    for (const field of section.fields) {
      if (!isFieldVisible(field, data)) continue;
      // Repeaters are handled below; file uploads are written by the files route.
      if (field.type === "repeater" || field.type === "file") continue;
      if (!field.crm) continue;
      // An SSN, card or bank number never goes to the CRM in plain text, whatever the config says.
      // (Today no sensitive slug has a provisioned id, so this changes nothing; it keeps one
      // provisioning run from starting to copy them out on every autosave.)
      if (field.sensitive) continue;

      const value = str(data[field.key]);
      if (!value) continue;

      if (field.crm.kind === "native") {
        native[field.crm.field] = value;
      } else {
        // Selects must send the CRM picklist label (e.g. "No"), not the internal value ("no").
        let outValue = value;
        if (field.type === "select" && field.options) {
          const opt = field.options.find((o) => o.value === value);
          if (opt) outValue = opt.labelEn;
        }
        pushCustom(field.crm.slug, outValue);
      }
    }
  }

  // GHL's contact record has no native slot for a second surname or an apartment line, and both
  // belong with the value they extend — a carrier name match needs both surnames, and mail needs
  // the unit number. Compose them into the native fields rather than dropping them; they stay
  // separate in our own record. Idempotent: the composition always rebuilds from our stored
  // fields, never from what is already on the contact.
  const secondLastName = str(data.secondLastName);
  if (secondLastName) {
    native.lastName = native.lastName ? `${native.lastName} ${secondLastName}` : secondLastName;
  }
  const address2 = str(data.address2);
  if (address2 && native.address1) {
    native.address1 = `${native.address1}, ${address2}`;
  }

  for (const field of allRepeaterFields(config.sections)) {
    if (!isFieldVisible(field, data)) continue;
    const raw = data[field.key];
    const rows: RepeaterRow[] = Array.isArray(raw) ? (raw as RepeaterRow[]) : [];
    const filled = rows.filter((r) => isRowFilled(field, r ?? {}));
    if (!filled.length) continue;

    const baseFormat = field.rowFormat ?? ((r: RepeaterRow, i: number) => defaultRowFormat(field, r, i));
    // Same rule inside a row: a person's SSN is blanked before the row becomes CRM text. The
    // repeater itself is marked sensitive, so it is never skipped as a whole (that would drop the
    // household from the contact).
    const sensitiveRowKeys = (field.rowFields ?? []).filter((sub) => sub.sensitive).map((sub) => sub.key);
    const format = (r: RepeaterRow, i: number) => {
      if (!sensitiveRowKeys.length) return baseFormat(r, i);
      const safe: RepeaterRow = { ...r };
      for (const key of sensitiveRowKeys) delete safe[key];
      return baseFormat(safe, i);
    };

    if (field.crmSlots?.length) {
      // One CRM field per row — readable at a glance in the contact record.
      field.crmSlots.forEach((slug, i) => {
        const row = filled[i];
        if (!row) return;
        const line = format(row, i);
        if (line) pushCustom(slug, line);
      });
    } else if (field.crm?.kind === "custom") {
      // Collapse every row into one text field.
      const text = filled.map((r, i) => format(r, i)).filter(Boolean).join("\n");
      if (text) pushCustom(field.crm.slug, text);
    }
  }

  return { native, customFields, skippedSlugs };
}
