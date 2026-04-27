import { NextRequest, NextResponse } from "next/server";

/**
 * Append / update mailing address on an existing CRM contact (after initial lead capture).
 * Verifies `email` and/or `phone` match the contact before updating.
 */

function unwrapContactRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const c = r.contact;
  if (c && typeof c === "object") return c as Record<string, unknown>;
  const d = r.data;
  if (d && typeof d === "object") {
    const dc = (d as Record<string, unknown>).contact;
    if (dc && typeof dc === "object") return dc as Record<string, unknown>;
    return d as Record<string, unknown>;
  }
  return r as Record<string, unknown>;
}

function extractCrmEmail(contact: Record<string, unknown>): string {
  for (const key of ["email", "primaryEmail", "primary_email"] as const) {
    const e = contact[key];
    if (typeof e === "string" && e.includes("@")) {
      return e.toLowerCase().trim();
    }
  }
  const additional = contact.additionalEmails;
  if (Array.isArray(additional)) {
    for (const item of additional) {
      if (typeof item === "string" && item.includes("@")) {
        return item.toLowerCase().trim();
      }
      if (item && typeof item === "object" && "email" in item) {
        const em = (item as { email?: string }).email;
        if (typeof em === "string" && em.includes("@")) {
          return em.toLowerCase().trim();
        }
      }
    }
  }
  return "";
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function last10(s: string): string {
  const d = digitsOnly(s);
  return d.length >= 10 ? d.slice(-10) : d;
}

function phonesMatch(a: string, b: string): boolean {
  return last10(a) === last10(b) && last10(a).length === 10;
}

const DOB_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getTodayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidPastOrTodayIsoDate(value: string): boolean {
  if (!DOB_ISO_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return false;
  }
  return value <= getTodayIsoLocal();
}

/** LeadConnector rejects top-level `address2`; apt/unit uses custom field `apt_or_unit_number`. */
const APT_OR_UNIT_FIELD_KEY = "apt_or_unit_number";
const LEAD_SOURCE_DETAILS_FIELD_KEY = "lead_source_details";

/** API list responses may use `fieldKey: "contact.apt_or_unit_number"` with `key` omitted. */
function normalizeLeadConnectorFieldKeySegment(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("contact.")) return s.slice("contact.".length);
  return s;
}

function unwrapCustomFieldDefinition(field: unknown): Record<string, unknown> | null {
  if (!field || typeof field !== "object") return null;
  const o = field as Record<string, unknown>;
  const inner = o.customField;
  if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  return o;
}

function isAptOrUnitFieldDefinition(def: Record<string, unknown>): boolean {
  const key = typeof def.key === "string" ? def.key.toLowerCase() : "";
  if (
    key === APT_OR_UNIT_FIELD_KEY ||
    key.replace(/[_\s-]/g, "") === "aptorunitnumber"
  ) {
    return true;
  }
  const fieldKeyRaw = typeof def.fieldKey === "string" ? def.fieldKey : "";
  const fk = normalizeLeadConnectorFieldKeySegment(fieldKeyRaw);
  if (
    fk === APT_OR_UNIT_FIELD_KEY ||
    fk.replace(/[_\s-]/g, "") === "aptorunitnumber"
  ) {
    return true;
  }
  const name = typeof def.name === "string" ? def.name.toLowerCase() : "";
  if (name.includes("apt") && name.includes("unit")) {
    return true;
  }
  return false;
}

function isLeadSourceDetailsFieldDefinition(def: Record<string, unknown>): boolean {
  const key = typeof def.key === "string" ? def.key.toLowerCase() : "";
  if (
    key === LEAD_SOURCE_DETAILS_FIELD_KEY ||
    key.replace(/[_\s-]/g, "") === "leadsourcedetails"
  ) {
    return true;
  }
  const fieldKeyRaw = typeof def.fieldKey === "string" ? def.fieldKey : "";
  const fk = normalizeLeadConnectorFieldKeySegment(fieldKeyRaw);
  if (
    fk === LEAD_SOURCE_DETAILS_FIELD_KEY ||
    fk.replace(/[_\s-]/g, "") === "leadsourcedetails"
  ) {
    return true;
  }
  const name = typeof def.name === "string" ? def.name.toLowerCase() : "";
  return name.includes("lead") && name.includes("source") && name.includes("detail");
}

async function resolveAptOrUnitCustomFieldId(
  baseUrl: string,
  locationId: string,
  piToken: string
): Promise<string | null> {
  const envId = process.env.AGENT_CRM_CUSTOM_FIELD_APT_OR_UNIT_ID?.trim();
  if (envId) return envId;

  try {
    const res = await fetch(`${baseUrl}/locations/${encodeURIComponent(locationId)}/customFields`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${piToken}`,
        Version: "2021-07-28",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { customFields?: unknown };
    const list = data.customFields ?? data;
    if (!Array.isArray(list)) return null;
    for (const field of list) {
      const def = unwrapCustomFieldDefinition(field);
      if (!def) continue;
      if (!isAptOrUnitFieldDefinition(def)) continue;
      const id = def.id;
      if (typeof id === "string") return id;
    }
  } catch (e) {
    console.warn("[contact-append-address] Could not list custom fields:", e);
  }
  return null;
}

async function resolveLeadSourceDetailsCustomField(
  baseUrl: string,
  locationId: string,
  piToken: string
): Promise<{ id: string; key?: string } | null> {
  const envId = process.env.AGENT_CRM_CUSTOM_FIELD_LEAD_SOURCE_DETAILS_ID?.trim();
  if (envId) {
    return { id: envId, key: LEAD_SOURCE_DETAILS_FIELD_KEY };
  }

  try {
    const res = await fetch(`${baseUrl}/locations/${encodeURIComponent(locationId)}/customFields`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${piToken}`,
        Version: "2021-07-28",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { customFields?: unknown };
    const list = data.customFields ?? data;
    if (!Array.isArray(list)) return null;
    for (const field of list) {
      const def = unwrapCustomFieldDefinition(field);
      if (!def || !isLeadSourceDetailsFieldDefinition(def)) continue;
      const id = typeof def.id === "string" ? def.id : "";
      if (!id) continue;
      const key = typeof def.key === "string" ? def.key : undefined;
      return { id, key };
    }
  } catch (e) {
    console.warn("[contact-append-address] Could not resolve lead_source_details field:", e);
  }
  return null;
}

type CrmCustomFieldRow = { id: string; field_value: string | string[]; key?: string };

/** Preserve existing contact custom fields when adding apt (PUT can replace the whole array). */
function mergeCustomFieldsWithApt(
  existingOnContact: unknown,
  aptFieldId: string,
  aptValue: string
): CrmCustomFieldRow[] {
  const out: CrmCustomFieldRow[] = [];
  if (Array.isArray(existingOnContact)) {
    for (const row of existingOnContact) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      if (!id || id === aptFieldId) continue;
      const raw = r.field_value ?? r.value;
      if (raw === undefined || raw === null) continue;
      const field_value = Array.isArray(raw)
        ? raw
        : String(raw);
      out.push({
        id,
        key: typeof r.key === "string" ? r.key : undefined,
        field_value,
      });
    }
  }
  out.push({
    id: aptFieldId,
    key: APT_OR_UNIT_FIELD_KEY,
    field_value: aptValue,
  });
  return out;
}

function mergeCustomFieldsWithUpdates(
  existingOnContact: unknown,
  updates: CrmCustomFieldRow[]
): CrmCustomFieldRow[] {
  const out: CrmCustomFieldRow[] = [];
  const byId = new Map<string, CrmCustomFieldRow>();

  if (Array.isArray(existingOnContact)) {
    for (const row of existingOnContact) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      if (!id) continue;
      const raw = r.field_value ?? r.value;
      if (raw === undefined || raw === null) continue;
      byId.set(id, {
        id,
        key: typeof r.key === "string" ? r.key : undefined,
        field_value: Array.isArray(raw) ? raw : String(raw),
      });
    }
  }

  for (const update of updates) {
    byId.set(update.id, update);
  }

  for (const item of byId.values()) {
    out.push(item);
  }

  return out;
}

function getCustomFieldStringValue(
  existingOnContact: unknown,
  fieldId: string
): string {
  if (!Array.isArray(existingOnContact)) return "";
  for (const row of existingOnContact) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (r.id !== fieldId) continue;
    const raw = r.field_value ?? r.value;
    if (typeof raw === "string") return raw.trim();
    if (Array.isArray(raw)) return raw.map((v) => String(v)).join(", ").trim();
    return String(raw ?? "").trim();
  }
  return "";
}

/**
 * LeadConnector accepts standard address fields on the contact model.
 * Do not send `locationId` in the JSON body (PUT updates in this repo omit it);
 * scope with `?locationId=` on the URL like other contact endpoints.
 * Apt/unit is stored on custom field `apt_or_unit_number`, not `address2`.
 */
export async function POST(request: NextRequest) {
  try {
    const piToken = process.env.AGENT_CRM_PI;
    const locationId = process.env.AGENT_CRM_LOCATION_ID;

    if (!piToken || !locationId) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      contactId,
      email,
      phone,
      dateOfBirth,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = body as Record<string, string | undefined>;

    if (
      !contactId ||
      !email?.trim() ||
      !dateOfBirth?.trim() ||
      !addressLine1?.trim() ||
      !city?.trim() ||
      !state?.trim() ||
      !postalCode?.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          required: [
            "contactId",
            "email",
            "dateOfBirth",
            "addressLine1",
            "city",
            "state",
            "postalCode",
          ],
        },
        { status: 400 }
      );
    }

    const zipNorm = postalCode.replace(/\D/g, "");
    if (zipNorm.length < 5) {
      return NextResponse.json(
        { success: false, error: "Invalid postal code" },
        { status: 400 }
      );
    }

    const dobNorm = dateOfBirth.trim();
    if (!isValidPastOrTodayIsoDate(dobNorm)) {
      return NextResponse.json(
        { success: false, error: "Invalid date of birth" },
        { status: 400 }
      );
    }

    const baseUrl = "https://services.leadconnectorhq.com";
    const q = new URLSearchParams({ locationId });

    const getRes = await fetch(
      `${baseUrl}/contacts/${encodeURIComponent(contactId)}?${q}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${piToken}`,
          Version: "2021-07-28",
        },
      }
    );

    if (!getRes.ok) {
      const errTxt = await getRes.text();
      console.error("[contact-append-address] GET contact failed:", getRes.status, errTxt);
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    const raw = await getRes.json();
    const contact = unwrapContactRecord(raw);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }
    // When `id` is present it must match; some responses omit `id` on nested `contact`.
    if (
      contact.id != null &&
      String(contact.id) !== String(contactId)
    ) {
      console.error("[contact-append-address] Contact id mismatch:", {
        requested: contactId,
        got: contact.id,
      });
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    const requestedEmail = email.toLowerCase().trim();
    const crmEmail = extractCrmEmail(contact);
    const crmPhone = typeof contact.phone === "string" ? contact.phone : "";
    const emailOk = Boolean(crmEmail) && crmEmail === requestedEmail;
    const phoneOk =
      Boolean(phone?.trim()) &&
      Boolean(crmPhone) &&
      phonesMatch(phone!, crmPhone);

    if (!emailOk && !phoneOk) {
      console.warn("[contact-append-address] Auth mismatch:", {
        requestedEmail,
        crmEmailPresent: Boolean(crmEmail),
        crmEmailMasked: crmEmail ? `${crmEmail.slice(0, 2)}***` : "",
        phoneOkAttempted: Boolean(phone?.trim()),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          hint: "Email or phone did not match this contact.",
        },
        { status: 403 }
      );
    }

    const aptTrimmed = addressLine2?.trim() ?? "";
    let aptFieldId: string | null = null;
    if (aptTrimmed) {
      aptFieldId = await resolveAptOrUnitCustomFieldId(baseUrl, locationId, piToken);
      if (!aptFieldId) {
        console.warn(
          "[contact-append-address] Custom field apt_or_unit_number not found; merge apt into address1. Set AGENT_CRM_CUSTOM_FIELD_APT_OR_UNIT_ID or ensure the field exists in CRM."
        );
      }
    }

    const street1 = aptTrimmed && !aptFieldId
      ? `${addressLine1.trim()}, ${aptTrimmed}`
      : addressLine1.trim();

    const addressPayload: Record<string, unknown> = {
      dateOfBirth: dobNorm,
      address1: street1,
      city: city.trim(),
      state:
        state.trim().length === 2
          ? state.trim().toUpperCase()
          : state.trim(),
      postalCode: postalCode.trim(),
    };
    const ctry = (country || "US").trim().toUpperCase();
    if (ctry) {
      addressPayload.country = ctry;
    }
    const customFieldUpdates: CrmCustomFieldRow[] = [];
    if (aptTrimmed && aptFieldId) {
      customFieldUpdates.push({
        id: aptFieldId,
        key: APT_OR_UNIT_FIELD_KEY,
        field_value: aptTrimmed,
      });
    }

    const leadSourceDetailsField = await resolveLeadSourceDetailsCustomField(
      baseUrl,
      locationId,
      piToken
    );
    if (leadSourceDetailsField?.id) {
      const existingLeadDetails = getCustomFieldStringValue(
        contact.customFields,
        leadSourceDetailsField.id
      );
      const submittedAt =
        new Date().toLocaleString() +
        " " +
        (Intl.DateTimeFormat().resolvedOptions().timeZone || "");
      const step2Details = [
        "Final Expense Step 2",
        "====================",
        "",
        "Step 2 details:",
        `  Date of birth: ${dobNorm}`,
        `  Street address: ${addressLine1.trim()}`,
        `  Apt / unit: ${aptTrimmed || "Not provided"}`,
        `  City: ${city.trim()}`,
        `  State: ${state.trim().length === 2 ? state.trim().toUpperCase() : state.trim()}`,
        `  ZIP: ${postalCode.trim()}`,
        `  Country: ${ctry || "US"}`,
        "",
        `Step 2 submitted: ${submittedAt}`,
      ].join("\n");

      const nextLeadDetails = existingLeadDetails
        ? `${existingLeadDetails}\n\n${step2Details}`
        : step2Details;

      customFieldUpdates.push({
        id: leadSourceDetailsField.id,
        key: leadSourceDetailsField.key,
        field_value: nextLeadDetails,
      });
    }

    if (customFieldUpdates.length > 0) {
      addressPayload.customFields = mergeCustomFieldsWithUpdates(
        contact.customFields,
        customFieldUpdates
      );
    }

    const putUrl = `${baseUrl}/contacts/${encodeURIComponent(contactId)}?${q}`;

    let putRes = await fetch(putUrl, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${piToken}`,
        Version: "2021-07-28",
      },
      body: JSON.stringify(addressPayload),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error(
        "[contact-append-address] CRM PUT failed:",
        putRes.status,
        errText
      );

      // Some workspaces reject `country`; retry without it.
      if (addressPayload.country != null) {
        const { country: _c, ...withoutCountry } = addressPayload;
        putRes = await fetch(putUrl, {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${piToken}`,
            Version: "2021-07-28",
          },
          body: JSON.stringify(withoutCountry),
        });
      }

      if (!putRes.ok) {
        const err2 = await putRes.text();
        console.error(
          "[contact-append-address] CRM PUT retry failed:",
          putRes.status,
          err2
        );
        return NextResponse.json(
          {
            success: false,
            error: "Failed to save address",
            details:
              process.env.NODE_ENV === "development" ? err2.slice(0, 500) : undefined,
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[contact-append-address]", e);
    return NextResponse.json(
      { success: false, error: "Unexpected error" },
      { status: 500 }
    );
  }
}
