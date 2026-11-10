/**
 * Validation and formatting for the ACA application review confirmation.
 *
 * Isomorphic and pure: imported by the API routes, the server module, the admin dialog and the
 * public signing page. No env, no Node-only APIs (the hashing and IP reading live in evidence.ts).
 */

import { z } from "zod";
import type {
  AcaConfirmationLanguage,
  AcaConfirmationState,
  AcaConfirmationStatus,
} from "./types";

/** GHL contact ids and intake session ids. */
export const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** The emailed signing token: nanoid(32). */
export const CONFIRMATION_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

/** A drawn signature needs at least this many points in total, so a stray tap can't sign. */
export const MIN_DRAWN_POINTS = 12;
const MAX_TOTAL_POINTS = 8000;
/** ≈300 KB of PNG once base64-encoded. The server re-checks the decoded bytes. */
const MAX_PNG_DATA_URL_CHARS = 420_000;

const languageSchema = z.enum(["en", "es"]);

/**
 * Strip control characters and collapse whitespace. Casing is kept as typed: legal names
 * ("María de los Ángeles McDonald") don't survive automatic title-casing.
 */
export function cleanPersonName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function firstNameOf(name: string): string {
  return cleanPersonName(name).split(" ")[0] ?? "";
}

const personNameSchema = z
  .string()
  .transform(cleanPersonName)
  .pipe(z.string().min(3, "name").max(120, "name"));

/** POST /api/admin/aca-confirmation/[contactId] */
export const acaConfirmationCreateSchema = z.object({
  consumerName: personNameSchema,
  language: languageSchema,
  intakeSessionId: z.string().regex(SAFE_ID_RE).optional(),
});

/** POST /api/admin/aca-confirmation/requests/[id] */
export const acaConfirmationActionSchema = z.object({
  action: z.enum(["resend", "cancel"]),
});

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  time: z.number().finite(),
  pressure: z.number().finite().optional(),
});

/** POST /api/aca-confirmation/[token] — the client's signature. */
export const acaConfirmationSignSchema = z
  .object({
    language: languageSchema,
    agreed: z.literal(true),
    method: z.enum(["drawn", "typed"]),
    png: z
      .string()
      .max(MAX_PNG_DATA_URL_CHARS)
      .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/),
    strokes: z.array(z.object({ points: z.array(pointSchema).max(MAX_TOTAL_POINTS) })).max(200).optional(),
    typedName: z
      .string()
      .transform(cleanPersonName)
      .pipe(z.string().min(2).max(120))
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method === "drawn") {
      const points = (value.strokes ?? []).reduce((sum, stroke) => sum + stroke.points.length, 0);
      if (points < MIN_DRAWN_POINTS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["strokes"], message: "signature_too_short" });
      }
      if (points > MAX_TOTAL_POINTS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["strokes"], message: "signature_too_long" });
      }
    } else if (!value.typedName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["typedName"], message: "typed_name_required" });
    }
  });

/** Stored status + expiry → what the agent and the client see. */
export function confirmationState(
  status: AcaConfirmationStatus,
  expiresAt: Date | string,
  now: Date = new Date()
): AcaConfirmationState {
  if (status !== "pending") return status;
  return new Date(expiresAt).getTime() <= now.getTime() ? "expired" : "pending";
}

/**
 * "Nov 9, 2026, 9:28 PM EST" / "9 nov 2026, 9:28 p.m. EST", always with the zone name, because a
 * signing time on a legal record must be unambiguous. ICU's narrow no-break spaces are replaced:
 * Helvetica's WinAnsi encoding in the PDF has no glyph for U+202F.
 */
export function formatLocalDateTime(
  date: Date | string,
  language: AcaConfirmationLanguage,
  timeZone: string
): string {
  return new Date(date)
    .toLocaleString(language === "es" ? "es-US" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    })
    .replace(/[\u202f\u00a0]/g, " ");
}

/** "2026-11-10 02:28:13 UTC" — the trail page prints UTC next to local time. */
export function formatUtc(date: Date | string): string {
  return `${new Date(date).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

/** "Miami, FL, US", or null when nothing is known (always the case off Vercel). */
export function describeLocation(parts: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string | null {
  const text = [parts.city, parts.region, parts.country].map((p) => p?.trim()).filter(Boolean).join(", ");
  return text || null;
}

/**
 * "Safari · iPhone", "Chrome · Windows". Deliberately coarse: it labels the trail, it doesn't
 * fingerprint. The raw user-agent is stored next to it. Order matters: Edge, Opera and Samsung
 * all claim to be Chrome, and Chrome claims to be Safari.
 */
export function describeDevice(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /SamsungBrowser\//.test(ua)
      ? "Samsung Internet"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /CriOS\/|Chrome\//.test(ua)
          ? "Chrome"
          : /FxiOS\/|Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? "Android phone"
          : "Android tablet"
        : /CrOS/.test(ua)
          ? "Chromebook"
          : /Windows/.test(ua)
            ? "Windows"
            : /Macintosh|Mac OS X/.test(ua)
              ? "Mac"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  return [browser, device].filter(Boolean).join(" · ") || "Unknown browser";
}
