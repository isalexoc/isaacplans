import "server-only";
import { client } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import { OBJECTIONS_QUERY } from "@/lib/sanity/queries/objections";
import { PRESENTATION_SCRIPT_QUERY } from "@/lib/sanity/queries/presentationScripts";
import {
  OBJECTION_TYPE_LABELS,
  appliesToLob,
  isObjectionType,
  visibleIn,
  type Objection,
  type ObjectionLob,
} from "@/lib/objections/types";
import {
  SCRIPT_SECTIONS,
  type ScriptLanguage,
  type ScriptPdfVariant,
} from "./format";
import type { ScriptBlock, ScriptImageAsset, ScriptImages } from "./pdf-blocks";
import type { ScriptPdfObjection, ScriptPdfPayload } from "./pdf";
import { IMAGE_PIXEL_WIDTH } from "./pdf-theme";

/**
 * Gathers everything the printable script needs, server-side.
 *
 * The content is read from Sanity here rather than posted up from the browser. It keeps the request
 * body to three short strings, it means the PDF can never be poisoned by a crafted payload, and it
 * guarantees the file matches what is actually published — not whatever the tab happened to load
 * an hour ago.
 */

type SanitySection = {
  contentEn?: unknown;
  contentEs?: unknown;
  tipsEn?: unknown;
  tipsEs?: unknown;
};

type SanityScript = {
  _id?: string;
  title?: string;
  description?: string;
  lineOfBusiness?: string;
  updatedAt?: string;
  completeScript?: { contentEn?: unknown; contentEs?: unknown };
} & Record<string, SanitySection | unknown>;

function blocksOf(value: unknown): ScriptBlock[] | undefined {
  return Array.isArray(value) && value.length > 0 ? (value as ScriptBlock[]) : undefined;
}

/* -- Images ----------------------------------------------------------------- */

/**
 * `image-<hash>-<width>x<height>-<ext>` is the Sanity asset reference format, so the source
 * dimensions are available without a second round trip to the asset document.
 */
function aspectFromRef(ref: string): number {
  const match = /-(\d+)x(\d+)-[a-z0-9]+$/i.exec(ref);
  if (!match) return 4 / 3;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : 4 / 3;
}

function collectImageBlocks(sets: Array<ScriptBlock[] | undefined>): Map<string, unknown> {
  const found = new Map<string, unknown>();
  for (const blocks of sets) {
    for (const block of blocks ?? []) {
      const image = block as { _type?: string; asset?: { _ref?: string } };
      if (image._type === "image" && image.asset?._ref && !found.has(image.asset._ref)) {
        found.set(image.asset._ref, block);
      }
    }
  }
  return found;
}

/**
 * Downloads every inline image once, as a buffer.
 *
 * A remote URL string would also work — @react-pdf fetches it itself — but the buffer is the right
 * call for three reasons, and they are the same reasons lib/mailing-labels/pdf.tsx pre-fetches its
 * logo: a failed fetch can be caught and the image simply skipped instead of failing the whole
 * render; an asset used in several sections is fetched once; and, decisively, @react-pdf only
 * decodes JPEG and PNG (it sniffs the magic bytes and throws "Not valid image extension" on
 * anything else), so the format has to be FORCED in the Sanity URL. A Sanity asset uploaded as
 * WebP, AVIF or GIF would otherwise blow up the render.
 *
 * PNG rather than JPEG: script art is screenshots and diagrams, where JPEG ringing is visible and
 * Sanity's flattening of transparency is not something to gamble a print on.
 *
 * This needs the Node runtime — @react-pdf/renderer is not edge-compatible anyway.
 */
export async function loadScriptImages(
  sets: Array<ScriptBlock[] | undefined>
): Promise<ScriptImages> {
  const wanted = collectImageBlocks(sets);
  if (wanted.size === 0) return new Map();

  const loaded = await Promise.all(
    [...wanted].map(async ([ref, block]): Promise<[string, ScriptImageAsset] | null> => {
      try {
        const url = urlFor(block as never)
          .width(IMAGE_PIXEL_WIDTH)
          .fit("max")
          .format("png")
          .url();
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = Buffer.from(await res.arrayBuffer());
        return [ref, { data, format: "png", aspect: aspectFromRef(ref) }];
      } catch (error) {
        console.warn(`[presentation-scripts] image unavailable (${ref}):`, error);
        return null;
      }
    })
  );

  return new Map(loaded.filter((entry): entry is [string, ScriptImageAsset] => entry !== null));
}

/* -- Payloads --------------------------------------------------------------- */

export type ScriptPdfSource = {
  script: SanityScript | null;
  objections: Objection[];
};

export async function fetchScriptPdfSource(lob: ObjectionLob): Promise<ScriptPdfSource> {
  const [script, objections] = await Promise.all([
    client.fetch<SanityScript | null>(PRESENTATION_SCRIPT_QUERY, { lineOfBusiness: lob }),
    client.fetch<Objection[]>(OBJECTIONS_QUERY),
  ]);
  return { script: script ?? null, objections: objections ?? [] };
}

function objectionsFor(
  objections: Objection[],
  lob: ObjectionLob,
  language: ScriptLanguage
): ScriptPdfObjection[] {
  return objections
    .filter((o) => appliesToLob(o, lob) && visibleIn(o, language))
    .map((o) => ({
      id: o._id,
      title: (language === "en" ? o.titleEn : o.titleEs) ?? "",
      typeLabel: isObjectionType(o.objectionType)
        ? OBJECTION_TYPE_LABELS[o.objectionType][language]
        : "",
      triggers: ((language === "en" ? o.triggersEn : o.triggersEs) ?? []).filter(Boolean),
      answer: blocksOf(language === "en" ? o.answerEn : o.answerEs),
    }));
}

export function buildScriptPdfPayload(
  source: ScriptPdfSource,
  lob: ObjectionLob,
  language: ScriptLanguage
): ScriptPdfPayload {
  const script = source.script;
  const objections = objectionsFor(source.objections, lob, language);

  const sections = SCRIPT_SECTIONS
    // Mirrors `hideObjectionHandling` in components/presentations-dashboard.tsx: once the shared
    // objection library covers a product, the old free-text section is a stale duplicate and is
    // hidden on screen. Printing it would hand the agent a retired script.
    .filter((config) => !(config.key === "objectionHandling" && objections.length > 0))
    .map((config) => {
      const section = (script?.[config.key] ?? undefined) as SanitySection | undefined;
      return {
        key: config.key,
        title: config[language],
        content: blocksOf(language === "en" ? section?.contentEn : section?.contentEs),
        tips: blocksOf(language === "en" ? section?.tipsEn : section?.tipsEs),
      };
    });

  return {
    lob,
    language,
    title: script?.title,
    updatedAt: script?.updatedAt,
    sections,
    objections,
    complete: blocksOf(
      language === "en" ? script?.completeScript?.contentEn : script?.completeScript?.contentEs
    ),
  };
}

/** Every block array the chosen variant will actually render, for the image pre-fetch. */
export function blocksToPrint(
  payloads: ScriptPdfPayload[],
  variant: ScriptPdfVariant
): Array<ScriptBlock[] | undefined> {
  const out: Array<ScriptBlock[] | undefined> = [];
  for (const payload of payloads) {
    if (variant === "full" || variant === "script") {
      for (const section of payload.sections) {
        out.push(section.content, section.tips);
      }
    }
    if (variant === "full" || variant === "objections") {
      for (const objection of payload.objections) out.push(objection.answer);
    }
    if (variant === "complete") out.push(payload.complete);
  }
  return out;
}

/** Nothing to print: the button should have been disabled, but the route checks anyway. */
export function isEmptyPayload(payload: ScriptPdfPayload, variant: ScriptPdfVariant): boolean {
  if (variant === "objections") return payload.objections.length === 0;
  if (variant === "complete") return !payload.complete;
  const hasSection = payload.sections.some((s) => s.content || s.tips);
  if (variant === "script") return !hasSection;
  return !hasSection && payload.objections.length === 0;
}
