/**
 * Pure input handling for Phone Finder: read a GHL contact, normalise what the lead typed, and plan
 * the EnformionGO searches.
 *
 * Names matter more than anything else here. Most leads are Hispanic, so "Maria Garcia Lopez" is
 * one person with two surnames, the intake engines write BOTH surnames into GHL's lastName
 * (lib/intake-core/server.ts), and public records often carry only the first one. Ad forms also
 * put the whole name in the first-name box. So the search tries the name as typed, then the
 * paternal surname alone — misses are free.
 */

import { createHash } from "crypto";

import { normalizeStateCode, normalizeZip } from "@/lib/mailing-labels/format";
import { toE164Nanp } from "@/lib/telegram/parse";

// ── Contact snapshot ─────────────────────────────────────────────────────────

export type ContactSnapshot = {
  id: string;
  locationId: string;
  firstName: string;
  lastName: string;
  /** contactName / name, used only when first and last are both empty. */
  fullName: string;
  email: string;
  phone: string;
  /** Every number in GHL's additionalPhones, as stored. */
  additionalPhones: string[];
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  tags: string[];
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** GET /contacts/{id} answers `{ contact: {...} }`; tolerate a bare record too. */
export function parseContactSnapshot(raw: unknown): ContactSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const outer = raw as Record<string, unknown>;
  const c = (outer.contact && typeof outer.contact === "object" ? outer.contact : outer) as Record<
    string,
    unknown
  >;
  const id = str(c.id);
  if (!id) return null;

  const additionalPhones: string[] = [];
  if (Array.isArray(c.additionalPhones)) {
    for (const item of c.additionalPhones) {
      if (typeof item === "string" && item.trim()) additionalPhones.push(item.trim());
      else if (item && typeof item === "object") {
        const p = str((item as Record<string, unknown>).phone);
        if (p) additionalPhones.push(p);
      }
    }
  }

  const tags: string[] = [];
  if (Array.isArray(c.tags)) {
    for (const t of c.tags) if (typeof t === "string" && t.trim()) tags.push(t.trim());
  }

  const dob = c.dateOfBirth;
  return {
    id,
    locationId: str(c.locationId),
    firstName: str(c.firstName),
    lastName: str(c.lastName),
    fullName: str(c.contactName) || str(c.name),
    email: str(c.email),
    phone: str(c.phone),
    additionalPhones,
    address1: str(c.address1),
    city: str(c.city),
    state: str(c.state),
    postalCode: str(c.postalCode),
    dateOfBirth: typeof dob === "number" ? new Date(dob).toISOString() : str(dob),
    tags,
  };
}

// ── Names ────────────────────────────────────────────────────────────────────

export type LeadName = {
  first: string;
  /** Extra given names ("Maria Elena" -> "Elena"). */
  middle: string;
  /** Surname groups, particles attached: "de la Cruz Martinez" -> ["de la Cruz", "Martinez"]. */
  surnames: string[];
};

const PARTICLES = new Set([
  "de", "del", "la", "las", "los", "da", "das", "do", "dos", "di", "du",
  "van", "von", "der", "den", "san", "santa",
]);
const CONJUNCTIONS = new Set(["y", "e"]);
/** Things people type into a name box that are not a name. */
const JUNK_NAMES = new Set([
  "unknown", "na", "n/a", "none", "lead", "test", "cliente", "client", "customer",
  "facebook", "fb", "user", "nombre", "name", "no", "sin", "nada", "x", "xx", "xxx",
]);

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function cleanNamePart(value: string): string {
  return stripAccents(value)
    .replace(/[^A-Za-z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return value.split(" ").filter(Boolean);
}

function surnameGroups(parts: string[]): string[] {
  const groups: string[] = [];
  let pending: string[] = [];
  for (const tok of parts) {
    const low = tok.toLowerCase();
    if (CONJUNCTIONS.has(low)) continue;
    if (PARTICLES.has(low)) {
      pending.push(tok);
      continue;
    }
    groups.push([...pending, tok].join(" "));
    pending = [];
  }
  if (pending.length > 0) {
    if (groups.length > 0) groups[groups.length - 1] += ` ${pending.join(" ")}`;
    else groups.push(pending.join(" "));
  }
  return groups;
}

/**
 * Split what the lead typed into first / middle / surnames. Null when there is no usable first
 * name AND surname — a first name alone would match half the country.
 */
export function splitLeadName(firstName: string, lastName: string, fullName = ""): LeadName | null {
  let firstTokens = tokens(cleanNamePart(firstName));
  let lastTokens = tokens(cleanNamePart(lastName));
  if (firstTokens.length === 0 && lastTokens.length === 0 && fullName) {
    firstTokens = tokens(cleanNamePart(fullName));
  }

  // The whole name typed into one box.
  if (lastTokens.length === 0 && firstTokens.length >= 2) {
    const givenCount = firstTokens.length >= 4 ? 2 : 1;
    lastTokens = firstTokens.slice(givenCount);
    firstTokens = firstTokens.slice(0, givenCount);
  } else if (firstTokens.length === 0 && lastTokens.length >= 2) {
    firstTokens = lastTokens.slice(0, 1);
    lastTokens = lastTokens.slice(1);
  }

  const first = firstTokens[0] ?? "";
  const middle = firstTokens.slice(1).join(" ");
  const surnames = surnameGroups(lastTokens);
  if (first.length < 2 || JUNK_NAMES.has(first.toLowerCase())) return null;
  if (surnames.length === 0 || surnames.every((g) => JUNK_NAMES.has(g.toLowerCase()))) return null;
  return { first, middle, surnames };
}

export function fullLastName(name: LeadName): string {
  return name.surnames.join(" ");
}

/** "Maria Elena Garcia Lopez" — what Trestle gets as `name`. */
export function displayName(name: LeadName): string {
  return [name.first, name.middle, fullLastName(name)].filter(Boolean).join(" ");
}

/** The paternal surname alone, or null when it would be the same as the full last name. */
export function firstSurnameOnly(name: LeadName): string | null {
  const firstGroup = name.surnames[0] ?? "";
  const paternal = firstGroup.includes("-") ? firstGroup.split("-")[0]! : firstGroup;
  if (!paternal || paternal === fullLastName(name)) return null;
  return paternal;
}

// ── Lead inputs ──────────────────────────────────────────────────────────────

export type LeadInputs = {
  name: LeadName | null;
  /** "" when absent or a placeholder like no@no.com. */
  email: string;
  address: { line1: string; city: string; state: string; zip: string };
  /** "MM/DD/YYYY" (EnformionGO's format) or "". */
  dob: string;
  primaryRaw: string;
  /** +1XXXXXXXXXX when the phone on file is a real NANP number. */
  primaryE164: string | null;
  /** The phone on file looks like a non-US number (not checked, not searched with). */
  primaryNonUs: boolean;
  /** Last 10 digits of every number already on the contact (primary + additional). */
  existingKeys: Set<string>;
};

const PLACEHOLDER_EMAIL_LOCALS = new Set([
  "no", "none", "noemail", "nomail", "na", "test", "sin", "sincorreo", "ninguno", "nada", "x",
]);
const PLACEHOLDER_EMAIL_DOMAINS = new Set(["example.com", "test.com", "noemail.com", "none.com"]);

export function usableEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  const [local, domain] = email.split("@") as [string, string];
  if (PLACEHOLDER_EMAIL_LOCALS.has(local) || PLACEHOLDER_EMAIL_DOMAINS.has(domain)) return "";
  return email;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** GHL dateOfBirth ("1970-05-21", ISO, or "05/21/1970") -> "05/21/1970"; "" when unusable. */
export function toMmDdYyyy(value: string, now = new Date()): string {
  const v = value.trim();
  let y: number;
  let m: number;
  let d: number;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (us) {
    m = Number(us[1]);
    d = Number(us[2]);
    y = Number(us[3]);
  } else {
    return "";
  }
  if (y < 1900 || y > now.getUTCFullYear() || m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${pad2(m)}/${pad2(d)}/${y}`;
}

/** Comparison key: last 10 digits for US numbers, all digits otherwise. */
export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function looksNonUs(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && !raw.trim().startsWith("+1")) return digits.length >= 8;
  return digits.length > 11 || (digits.length === 11 && !digits.startsWith("1"));
}

export function buildLeadInputs(contact: ContactSnapshot, now = new Date()): LeadInputs {
  const zip = normalizeZip(contact.postalCode).slice(0, 5);
  const existingKeys = new Set<string>();
  for (const p of [contact.phone, ...contact.additionalPhones]) {
    const key = phoneKey(p);
    if (key.length >= 7) existingKeys.add(key);
  }
  const primaryE164 = toE164Nanp(contact.phone);
  return {
    name: splitLeadName(contact.firstName, contact.lastName, contact.fullName),
    email: usableEmail(contact.email),
    address: {
      line1: stripAccents(contact.address1).replace(/\s+/g, " ").trim(),
      city: stripAccents(contact.city).replace(/\s+/g, " ").trim(),
      state: normalizeStateCode(contact.state),
      zip,
    },
    dob: toMmDdYyyy(contact.dateOfBirth, now),
    primaryRaw: contact.phone,
    primaryE164,
    primaryNonUs: !primaryE164 && Boolean(contact.phone) && looksNonUs(contact.phone),
    existingKeys,
  };
}

export function hasAddress(inputs: LeadInputs): boolean {
  const a = inputs.address;
  return Boolean(a.line1 || a.zip || (a.city && a.state));
}

/** Hash of exactly what a search is made from — the same-input cooldown compares it. */
export function searchInputHash(inputs: LeadInputs): string {
  const n = inputs.name;
  const payload = JSON.stringify({
    first: n?.first.toLowerCase() ?? "",
    middle: n?.middle.toLowerCase() ?? "",
    last: n ? fullLastName(n).toLowerCase() : "",
    email: inputs.email,
    line1: inputs.address.line1.toLowerCase(),
    city: inputs.address.city.toLowerCase(),
    state: inputs.address.state,
    zip: inputs.address.zip,
    dob: inputs.dob,
    phone: inputs.primaryE164 ?? phoneKey(inputs.primaryRaw),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

// ── EnformionGO search plan ──────────────────────────────────────────────────

export type EnformionRequestBody = {
  FirstName: string;
  MiddleName?: string;
  LastName: string;
  Dob?: string;
  Phone?: string;
  Email?: string;
  Address?: { addressLine1?: string; addressLine2?: string };
};

export type EnformionAttempt = {
  label: "full" | "first_surname" | "without_phone" | "last_surname" | "loose";
  body: EnformionRequestBody;
};

/** +13055550142 -> 305-555-0142 (one of EnformionGO's two accepted phone formats). */
export function toDashedPhone(e164: string): string {
  const d = e164.replace(/\D/g, "").slice(-10);
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

/** EnformionGO AddressLine2 is "State or City and State Or Zip": "Miami, FL 33101", "FL", "33101". */
export function addressLine2(address: LeadInputs["address"]): string {
  const stateZip = [address.state, address.zip].filter(Boolean).join(" ");
  if (address.city && stateZip) return `${address.city}, ${stateZip}`;
  return stateZip || "";
}

function criteriaCount(body: EnformionRequestBody): number {
  let n = 1; // the name
  if (body.Phone) n++;
  if (body.Email) n++;
  if (body.Address) n++;
  return n;
}

/**
 * Up to `max` searches, best first. EnformionGO needs 2 of name / phone / email / address, and
 * bills only a match, so each extra variant costs nothing unless it is the one that finds them.
 *
 * `includePhone` is false when Trestle says the phone on file belongs to someone else — searching
 * with it would steer the match to that person. `phoneDoubtful` adds a retry without the phone
 * when ownership is unknown.
 */
export function planEnformionAttempts(
  inputs: LeadInputs,
  options: { includePhone: boolean; phoneDoubtful: boolean; max: number }
): EnformionAttempt[] {
  const name = inputs.name;
  if (!name) return [];

  const line1 = inputs.address.line1;
  const line2 = addressLine2(inputs.address);
  const address =
    line1 || line2
      ? { ...(line1 ? { addressLine1: line1 } : {}), ...(line2 ? { addressLine2: line2 } : {}) }
      : undefined;
  const phone = options.includePhone && inputs.primaryE164 ? toDashedPhone(inputs.primaryE164) : undefined;

  const build = (
    lastName: string,
    opts: { phone?: string; middle: boolean; dob: boolean; middleOverride?: string }
  ): EnformionRequestBody => ({
    FirstName: name.first,
    ...(opts.middleOverride
      ? { MiddleName: opts.middleOverride }
      : opts.middle && name.middle
        ? { MiddleName: name.middle }
        : {}),
    LastName: lastName,
    ...(opts.dob && inputs.dob ? { Dob: inputs.dob } : {}),
    ...(opts.phone ? { Phone: opts.phone } : {}),
    ...(inputs.email ? { Email: inputs.email } : {}),
    ...(address ? { Address: address } : {}),
  });

  const candidates: EnformionAttempt[] = [
    { label: "full", body: build(fullLastName(name), { phone, middle: true, dob: true }) },
  ];
  const paternal = firstSurnameOnly(name);
  if (paternal) {
    candidates.push({ label: "first_surname", body: build(paternal, { phone, middle: true, dob: true }) });
  }
  if (phone && options.phoneDoubtful) {
    candidates.push({ label: "without_phone", body: build(fullLastName(name), { middle: true, dob: true }) });
  }
  // "Juan Carlos Perez" typed in one box reads as first=Juan, surnames=[Carlos, Perez]; the real
  // surname is the LAST group, with the rest as a middle name.
  if (name.surnames.length >= 2) {
    const last = name.surnames[name.surnames.length - 1]!;
    const middleOverride = [name.middle, ...name.surnames.slice(0, -1)].filter(Boolean).join(" ");
    candidates.push({ label: "last_surname", body: build(last, { phone, middle: true, dob: true, middleOverride }) });
  }
  if (name.middle || inputs.dob) {
    candidates.push({ label: "loose", body: build(paternal ?? fullLastName(name), { phone, middle: false, dob: false }) });
  }

  const seen = new Set<string>();
  const out: EnformionAttempt[] = [];
  for (const c of candidates) {
    if (criteriaCount(c.body) < 2) continue;
    const key = JSON.stringify(c.body);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(0, Math.max(1, options.max));
}
