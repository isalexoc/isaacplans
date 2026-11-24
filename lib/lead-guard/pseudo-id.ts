import "server-only";

import { customAlphabet } from "nanoid";

import { hmac, hmacAll, safeEqual } from "./keys";

/**
 * Stand-in contact ids for submissions that did not reach the CRM normally.
 *
 * Held and blocked leads still get the normal success response, so funnels move on to step 2 and a
 * bot learns nothing. Funnels then send this id to the step-2 routes (address, IUL answers,
 * LegalShield questionnaire, guide emails), which recognize it:
 *   hold  — the step-2 data is filed with the hold and replayed on release (or forwarded to the
 *           real contact once released);
 *   block — accepted and ignored;
 *   quarantine — the hold couldn't be stored, so the lead went to the CRM as a bare `web_review`
 *           contact; step-2 data becomes a note on that contact (no fields, tags or mail).
 *
 * Hold and block ids look the same: 20 base62 characters like a GHL id ("L" + 11-char id + 8-char
 * HMAC tag), the kind is only inside the tag. A real GHL id passes a tag check with probability
 * ~62^-8. Quarantine ids are "Q" + the GHL contact id + an 8-char tag.
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const GUARD_RECORD_ID_LENGTH = 11;
export const newGuardRecordId = customAlphabet(BASE62, GUARD_RECORD_ID_LENGTH);
/** A hold row id as newGuardRecordId makes it (the admin actions validate with this). */
export const GUARD_RECORD_ID_RE = /^[0-9A-Za-z]{11}$/;

export type GuardPseudoKind = "hold" | "block";
export type ParsedGuardId = { kind: GuardPseudoKind; id: string } | { kind: "quarantine"; ghlContactId: string };

function base62(buf: Buffer, length: number): string {
  let n = BigInt(`0x${buf.toString("hex")}`);
  let out = "";
  while (out.length < length) {
    out += BASE62[Number(n % BigInt(62))];
    n /= BigInt(62);
  }
  return out;
}

const tagOf = (mac: Buffer) => base62(mac.subarray(0, 8), 8);

export function makeGuardPseudoId(kind: GuardPseudoKind, id: string = newGuardRecordId()): string | null {
  const mac = hmac("pseudo-id", `${kind}:${id}`);
  return mac ? `L${id}${tagOf(mac)}` : null;
}

export function makeQuarantineId(ghlContactId: string): string | null {
  if (!/^[0-9A-Za-z]{10,40}$/.test(ghlContactId)) return null;
  const mac = hmac("pseudo-id", `quarantine:${ghlContactId}`);
  return mac ? `Q${ghlContactId}${tagOf(mac)}` : null;
}

function tagMatches(message: string, tag: string): boolean {
  return hmacAll("pseudo-id", message).some((mac) => safeEqual(tag, tagOf(mac)));
}

export function parseGuardPseudoId(value: unknown): ParsedGuardId | null {
  if (typeof value !== "string" || !/^[0-9A-Za-z]+$/.test(value)) return null;
  if (value.length === 1 + GUARD_RECORD_ID_LENGTH + 8 && value[0] === "L") {
    const id = value.slice(1, 1 + GUARD_RECORD_ID_LENGTH);
    const tag = value.slice(1 + GUARD_RECORD_ID_LENGTH);
    if (tagMatches(`hold:${id}`, tag)) return { kind: "hold", id };
    if (tagMatches(`block:${id}`, tag)) return { kind: "block", id };
    return null;
  }
  if (value[0] === "Q" && value.length >= 19 && value.length <= 49) {
    const ghlContactId = value.slice(1, -8);
    if (tagMatches(`quarantine:${ghlContactId}`, value.slice(-8))) return { kind: "quarantine", ghlContactId };
  }
  return null;
}
