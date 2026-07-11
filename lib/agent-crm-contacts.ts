/**
 * Shared LeadConnector (Agent CRM) contact helpers: search, fetch, duplicate handling.
 * Used by newsletter sync, Clerk webhooks, and can be reused by create-contact flows.
 */

export const AGENT_CRM_API_BASE = "https://services.leadconnectorhq.com";
export const AGENT_CRM_API_VERSION = "2021-07-28";

export function agentCrmAuthHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    Version: AGENT_CRM_API_VERSION,
  };
}

export function agentCrmJsonHeaders(token: string): HeadersInit {
  return {
    ...agentCrmAuthHeaders(token),
    "Content-Type": "application/json",
  };
}

/** PI + location only (callers add feature flags like AGENT_CRM_SYNC_NEWSLETTER). */
export function agentCrmGetBaseCredentials(): { token: string; locationId: string } | null {
  const token = process.env.AGENT_CRM_PI;
  const locationId = process.env.AGENT_CRM_LOCATION_ID;
  if (!token || !locationId) return null;
  return { token, locationId };
}

export function agentCrmNormalizeContactTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t === "string" && t.trim()) out.push(t);
    else if (t && typeof t === "object" && "name" in t && typeof (t as { name: unknown }).name === "string") {
      const n = (t as { name: string }).name.trim();
      if (n) out.push(n);
    }
  }
  return out;
}

type LcContact = { id?: string; email?: string; phone?: string; tags?: unknown };

function parseContactsSearchResponse(data: unknown): LcContact[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const contacts = d.contacts ?? (d.data as Record<string, unknown> | undefined)?.contacts;
  if (Array.isArray(contacts)) return contacts as LcContact[];
  return [];
}

export async function agentCrmFetchContactById(
  contactId: string,
  locationId: string,
  token: string
): Promise<{ id: string; tags: string[] } | null> {
  const q = new URLSearchParams({ locationId });
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}?${q}`, {
    method: "GET",
    headers: agentCrmAuthHeaders(token),
  });
  if (!res.ok) {
    console.warn("[AGENT_CRM] Get contact failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const c = (data.contact ?? data) as LcContact;
  if (!c?.id) return null;
  return { id: c.id, tags: agentCrmNormalizeContactTags(c.tags) };
}

/** POST /contacts/search — GET ?email= is no longer supported. */
export async function agentCrmFindContactByEmail(
  email: string,
  locationId: string,
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<{ id: string; tags: string[] } | null> {
  const lower = email.toLowerCase().trim();
  const searchBodies: Record<string, unknown>[] = [
    {
      locationId,
      page: 1,
      pageLimit: 20,
      filters: [{ field: "email", operator: "eq", value: lower }],
    },
    {
      locationId,
      page: 1,
      pageLimit: 20,
      filters: [
        {
          group: "AND",
          filters: [{ field: "email", operator: "eq", value: lower }],
        },
      ],
    },
    {
      locationId,
      page: 1,
      pageLimit: 20,
      query: lower,
    },
  ];

  for (const body of searchBodies) {
    const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/search`, {
      method: "POST",
      headers: agentCrmJsonHeaders(token),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`${logPrefix} Contact search failed:`, res.status, text);
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    const list = parseContactsSearchResponse(data);
    if (list.length === 0) continue;
    const match =
      list.find((c) => c.email?.toLowerCase() === lower) ??
      list.find((c) => c.email?.toLowerCase().includes(lower)) ??
      list[0];
    if (!match?.id) continue;
    const full = await agentCrmFetchContactById(match.id, locationId, token);
    if (full) return full;
    return { id: match.id, tags: agentCrmNormalizeContactTags(match.tags) };
  }

  return null;
}

/** POST /contacts/search by phone when email resolution fails on duplicate create. */
export async function agentCrmFindContactByPhone(
  phone: string,
  locationId: string,
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<{ id: string; tags: string[] } | null> {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  const normalized =
    digits.length === 11 && digits.startsWith("1")
      ? `+${digits}`
      : `+1${last10}`;

  const searchBodies: Record<string, unknown>[] = [
    {
      locationId,
      page: 1,
      pageLimit: 20,
      filters: [{ field: "phone", operator: "eq", value: phone.trim() }],
    },
    {
      locationId,
      page: 1,
      pageLimit: 20,
      filters: [{ field: "phone", operator: "eq", value: normalized }],
    },
    {
      locationId,
      page: 1,
      pageLimit: 20,
      query: last10,
    },
  ];

  for (const body of searchBodies) {
    const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/search`, {
      method: "POST",
      headers: agentCrmJsonHeaders(token),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`${logPrefix} Contact phone search failed:`, res.status, text);
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    const list = parseContactsSearchResponse(data);
    if (list.length === 0) continue;

    const byDigits = (c: LcContact) => {
      const p = c.phone?.replace(/\D/g, "") ?? "";
      return p.length >= 10 && p.slice(-10) === last10;
    };

    const match = list.find(byDigits) ?? list[0];
    if (!match?.id) continue;

    const full = await agentCrmFetchContactById(match.id, locationId, token);
    if (full) return full;
    return { id: match.id, tags: agentCrmNormalizeContactTags(match.tags) };
  }

  return null;
}

export type AgentCrmCreateContactErrorBody = {
  message?: string | string[];
  statusCode?: number;
  meta?: {
    contactId?: string;
    matchingField?: string;
    /** Other LC fields occasionally present on conflict responses */
    [key: string]: unknown;
  };
};

export function agentCrmErrorMessageString(err: AgentCrmCreateContactErrorBody): string {
  const m = err.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.join(" ");
  return "";
}

export function agentCrmIsDuplicateContactError(status: number, err: AgentCrmCreateContactErrorBody): boolean {
  const msg = agentCrmErrorMessageString(err).toLowerCase();
  return (
    status === 409 ||
    (status === 400 && (msg.includes("duplicat") || msg.includes("already exist"))) ||
    msg.includes("duplicate") ||
    msg.includes("duplicated")
  );
}

/** Native GHL contact fields we read/write directly (no custom field needed). */
export type AgentCrmNativeFields = Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  companyName: string;
  timezone: string; // IANA name, e.g. "America/New_York"
}>;

export type AgentCrmCustomFieldValue = { id: string; field_value: string };

export type AgentCrmContactSummary = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

/** Free-text search across name/email/phone for the intake "find or create" flow. */
export async function agentCrmSearchContacts(
  query: string,
  locationId: string,
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<AgentCrmContactSummary[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/search`, {
    method: "POST",
    headers: agentCrmJsonHeaders(token),
    body: JSON.stringify({ locationId, page: 1, pageLimit: 15, query: q }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`${logPrefix} Contact search failed:`, res.status, text);
    return [];
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const list = parseContactsSearchResponse(data) as Array<
    LcContact & { firstName?: string; lastName?: string; contactName?: string }
  >;
  return list
    .filter((c) => c.id)
    .map((c) => {
      const firstName = c.firstName ?? "";
      const lastName = c.lastName ?? "";
      const name = c.contactName ?? [firstName, lastName].filter(Boolean).join(" ");
      return {
        id: c.id as string,
        name,
        firstName,
        lastName,
        email: c.email ?? "",
        phone: c.phone ?? "",
      };
    });
}

export type AgentCrmContactNative = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
};

/** Fetch a contact's native fields for pre-filling a new intake form. */
export async function agentCrmGetContactNative(
  contactId: string,
  token: string
): Promise<AgentCrmContactNative | null> {
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}`, {
    headers: agentCrmAuthHeaders(token),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const c = data?.contact ?? data;
  if (!c?.id) return null;
  return {
    id: c.id,
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    dateOfBirth: c.dateOfBirth ?? "",
    address1: c.address1 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    postalCode: c.postalCode ?? "",
  };
}

/**
 * Create or resolve a contact for an intake session. Tries email/phone lookup first to avoid
 * duplicates, then creates a minimal contact. Returns the contact id (or null on failure).
 */
export async function agentCrmEnsureContact(
  input: { email?: string; phone?: string; firstName?: string; lastName?: string },
  locationId: string,
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<string | null> {
  const email = input.email?.trim();
  const phone = input.phone?.trim();

  if (email) {
    const found = await agentCrmFindContactByEmail(email, locationId, token, logPrefix);
    if (found?.id) return found.id;
  }
  if (phone) {
    const found = await agentCrmFindContactByPhone(phone, locationId, token, logPrefix);
    if (found?.id) return found.id;
  }

  const body: Record<string, unknown> = { locationId, source: "iul_intake" };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (input.firstName?.trim()) body.firstName = input.firstName.trim();
  if (input.lastName?.trim()) body.lastName = input.lastName.trim();

  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/`, {
    method: "POST",
    headers: agentCrmJsonHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.ok) {
    try {
      const data = JSON.parse(text);
      const id = data?.contact?.id ?? data?.id;
      if (typeof id === "string") return id;
    } catch {
      /* fall through */
    }
  }

  // Duplicate → resolve from the error meta or a follow-up search.
  let errBody: AgentCrmCreateContactErrorBody = {};
  try {
    errBody = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (agentCrmIsDuplicateContactError(res.status, errBody)) {
    const metaId = errBody.meta?.contactId;
    if (typeof metaId === "string") return metaId;
    if (email) {
      const found = await agentCrmFindContactByEmail(email, locationId, token, logPrefix);
      if (found?.id) return found.id;
    }
    if (phone) {
      const found = await agentCrmFindContactByPhone(phone, locationId, token, logPrefix);
      if (found?.id) return found.id;
    }
  }

  console.warn(`${logPrefix} Create contact failed:`, res.status, text);
  return null;
}

/**
 * Update a contact's native fields and custom fields in one PUT.
 * `customFields` items use `{ id, field_value }` per the LeadConnector v2 contact API.
 */
export async function agentCrmUpdateContact(
  contactId: string,
  payload: { native?: AgentCrmNativeFields; customFields?: AgentCrmCustomFieldValue[] },
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<boolean> {
  const body: Record<string, unknown> = { ...(payload.native ?? {}) };
  if (payload.customFields && payload.customFields.length > 0) {
    body.customFields = payload.customFields;
  }
  if (Object.keys(body).length === 0) return true;

  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: agentCrmJsonHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn(`${logPrefix} Update contact failed:`, res.status, await res.text());
    return false;
  }
  return true;
}

/** Read a contact's tags. Returns null on fetch failure, [] when the contact has none. */
export async function agentCrmGetContactTags(
  contactId: string,
  token: string
): Promise<string[] | null> {
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}`, {
    headers: agentCrmAuthHeaders(token),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const c = data?.contact ?? data;
  if (!c?.id) return null;
  return agentCrmNormalizeContactTags(c.tags);
}

/** Add tags to a contact (POST fires GHL "tag added" automations). */
export async function agentCrmAddContactTags(
  contactId: string,
  tags: string[],
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<boolean> {
  if (tags.length === 0) return true;
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: agentCrmJsonHeaders(token),
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    console.warn(`${logPrefix} Add tags failed:`, res.status, await res.text());
    return false;
  }
  return true;
}

/** Remove tags from a contact. Best-effort (used to allow re-triggering on re-add). */
export async function agentCrmRemoveContactTags(
  contactId: string,
  tags: string[],
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<boolean> {
  if (tags.length === 0) return true;
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}/tags`, {
    method: "DELETE",
    headers: agentCrmJsonHeaders(token),
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    // Not fatal — the tag may simply not be present yet.
    return false;
  }
  return true;
}

/**
 * Upload a file to the GHL media library (so it lives inside the CRM) and return its
 * CRM-hosted URL. Used to populate FILE_UPLOAD custom fields.
 */
export async function agentCrmUploadMedia(
  file: Blob,
  filename: string,
  locationId: string,
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<{ fileId: string; url: string } | null> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("hosted", "false");
  form.append("name", filename);
  form.append("altId", locationId);
  form.append("altType", "location");

  const res = await fetch(`${AGENT_CRM_API_BASE}/medias/upload-file`, {
    method: "POST",
    headers: agentCrmAuthHeaders(token), // multipart boundary set automatically
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`${logPrefix} Media upload failed:`, res.status, text);
    return null;
  }
  try {
    const data = JSON.parse(text);
    if (typeof data?.url === "string") {
      return { fileId: data.fileId ?? "", url: data.url };
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** A file attached to a FILE_UPLOAD custom field, as read back from the CRM contact. */
export type AgentCrmFieldFile = { url: string; name: string };

/** Derive a readable filename from a URL, dropping any query string. */
function fileNameFromUrl(url: string): string {
  const last = (url.split("/").pop() || "file").split("?")[0] || "file";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** Pull the file list off a contact's FILE_UPLOAD custom field value (shape varies). */
function parseFieldFiles(value: unknown): AgentCrmFieldFile[] {
  const entries: unknown[] = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [];
  const out: AgentCrmFieldFile[] = [];
  for (const e of entries) {
    if (typeof e === "string") {
      out.push({ url: e, name: fileNameFromUrl(e) });
    } else if (e && typeof e === "object") {
      const o = e as Record<string, unknown>;
      const meta = (o.meta && typeof o.meta === "object" ? (o.meta as Record<string, unknown>) : {}) as Record<string, unknown>;
      const url = typeof o.url === "string" ? o.url : typeof o.fileUrl === "string" ? o.fileUrl : "";
      if (!url) continue;
      const name =
        (typeof meta.name === "string" && meta.name) ||
        (typeof o.name === "string" && o.name) ||
        (typeof o.fileName === "string" && o.fileName) ||
        fileNameFromUrl(url);
      out.push({ url, name });
    }
  }
  return out;
}

/**
 * Upload a file directly to a contact's FILE_UPLOAD custom field via the dedicated
 * `forms/upload-custom-files` endpoint. This is the ONLY way GHL actually attaches files to a
 * file-upload field — setting `field_value` URLs on the contact update is accepted (200) but
 * silently ignored. The multipart key must be `<customFieldId>_<fileId>`.
 *
 * Returns the field's full file list (as GHL reports it after the upload), or null on failure.
 */
export async function agentCrmUploadCustomFieldFile(
  file: Blob,
  filename: string,
  contactId: string,
  locationId: string,
  customFieldId: string,
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<AgentCrmFieldFile[] | null> {
  const fileId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const form = new FormData();
  form.append(`${customFieldId}_${fileId}`, file, filename);

  const url = `${AGENT_CRM_API_BASE}/forms/upload-custom-files?contactId=${encodeURIComponent(contactId)}&locationId=${encodeURIComponent(locationId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: agentCrmAuthHeaders(token), // multipart boundary set automatically
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`${logPrefix} Upload custom-field file failed:`, res.status, text);
    return null;
  }
  if (process.env.IUL_INTAKE_DEBUG === "true") {
    console.info(`${logPrefix} Uploaded custom-field file ${customFieldId}:`, res.status, text.slice(0, 600));
  }
  try {
    const data = JSON.parse(text);
    const contact = (data?.contact ?? data) as { customFields?: Array<{ id?: string; value?: unknown }> };
    const cf = (contact.customFields ?? []).find((c) => c?.id === customFieldId);
    return parseFieldFiles(cf?.value);
  } catch {
    return [];
  }
}

/**
 * Set a FILE_UPLOAD custom field to the given list of CRM-hosted file URLs (full overwrite).
 * NOTE: GHL accepts this (200) but does NOT render files on FILE_UPLOAD fields set this way —
 * use `agentCrmUploadCustomFieldFile` to attach. Kept for best-effort removal/clearing.
 *
 * Set IUL_INTAKE_DEBUG=true to log the response body.
 */
export async function agentCrmSetFileField(
  contactId: string,
  fieldId: string,
  urls: string[],
  token: string,
  logPrefix = "[AGENT_CRM]"
): Promise<boolean> {
  const body = {
    customFields: [{ id: fieldId, field_value: urls.map((url) => ({ url })) }],
  };
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: agentCrmJsonHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn(`${logPrefix} Set file field failed:`, res.status, text);
    return false;
  }
  if (process.env.IUL_INTAKE_DEBUG === "true") {
    console.info(`${logPrefix} Set file field ${fieldId} (${urls.length} url(s)):`, res.status, text.slice(0, 600));
  }
  return true;
}
