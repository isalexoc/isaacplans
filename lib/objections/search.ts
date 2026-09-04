import type { Objection } from "./types";

/**
 * Search for a person who is mid-call and typing fast with one hand.
 *
 * Two rules drive everything here:
 *
 * 1. Diacritics are stripped. The live Spanish content contains "cotización", "información" and
 *    "opción"; nobody reaches for the accent key while a client is waiting, so `cotizacion` has to
 *    hit. This is also why the command palette runs `shouldFilter={false}` — cmdk's own scorer is
 *    not diacritic-insensitive, and a palette that disagrees with the grid is worse than no palette.
 *
 * 2. Both languages are searched, but only the active one is displayed. Isaac is bilingual; typing
 *    "pensarlo" while reading the English script should still land on "I want to think about it".
 */

/** Lowercase, strip accents, straighten curly quotes, collapse whitespace. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const haystackCache = new Map<string, string>();

/** Every searchable string on an objection, normalized and cached by document id. */
export function objectionHaystack(objection: Objection): string {
  const cached = haystackCache.get(objection._id);
  if (cached !== undefined) return cached;

  const parts = [
    objection.titleEn,
    objection.titleEs,
    ...(objection.triggersEn ?? []),
    ...(objection.triggersEs ?? []),
  ].filter((part): part is string => Boolean(part));

  const haystack = normalizeForSearch(parts.join("  "));
  haystackCache.set(objection._id, haystack);
  return haystack;
}

/**
 * Every whitespace-separated token must appear somewhere. "afford kids" finds nothing, which is
 * correct — narrowing as you type is what makes three keystrokes enough.
 */
export function matchesObjection(objection: Objection, query: string): boolean {
  const normalized = normalizeForSearch(query);
  if (!normalized) return true;

  const haystack = objectionHaystack(objection);
  return normalized.split(" ").every((token) => haystack.includes(token));
}

/** True when a keystroke should be treated as typing, not as a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
