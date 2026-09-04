/**
 * Portable Text -> @react-pdf primitives.
 *
 * The print-side twin of components/presentation-scripts/script-portable-text.tsx: every style,
 * every mark and the image type declared in sanity/schemaTypes/scriptPortableText.tsx has an entry
 * here. A style with no entry falls back to a plain paragraph and a mark with no entry renders its
 * text unstyled, matching the `unknownBlockStyle` / `unknownMark` fallbacks on screen.
 *
 * Two things about @react-pdf 4.5.1 shape this file (both verified against the installed
 * @react-pdf/layout@4.6.1 and @react-pdf/render@4.5.1):
 *
 * 1. A nested <Text> WITH a backgroundColor is drawn as a rectangle behind that run, spanning the
 *    full height of the line box (render/index.js renderLine). That is exactly a highlighter pen,
 *    and it is how highlight / highlightGood / highlightCareful / fill are drawn. There is no
 *    inline padding and no inline border in @react-pdf, so `fill` also gets literal brackets so it
 *    still reads as a blank on a black-and-white printer.
 *
 * 2. `backgroundColor` is in TEXT_INHERITABLE_PROPERTIES (layout/index.js), so a background set on
 *    the OUTER <Text> of a paragraph leaks down into every nested run and paints the whole
 *    paragraph. The coloured block styles therefore take their fill from a wrapping <View> and the
 *    <Text> inside stays transparent. Never put backgroundColor on a block-level <Text>.
 */

import { Image, Link, Text, View } from "@react-pdf/renderer";
import type { Styles } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import {
  BRAND,
  CALLOUT,
  CALLOUT_PILL,
  IMAGE_MAX_HEIGHT,
  IMAGE_MAX_WIDTH,
  LIST_INDENT,
  LIST_MARKER_WIDTH,
  MARK_FILL,
  MARK_HIGHLIGHT,
  PDF_COLOR,
  TYPE,
  UNDERLINE_COLOR,
  type CalloutTone,
} from "./pdf-theme";
import { winAnsiSafe, type ScriptLanguage } from "./format";

/**
 * @react-pdf/renderer re-exports no `Style` type of its own (its .d.ts imports it from
 * @react-pdf/types, which pnpm does not hoist into node_modules), so it is derived from the
 * `Styles` map the renderer does export.
 */
type Style = Styles[string];

/* -- The Portable Text shapes we actually receive -------------------------- */

export type ScriptSpan = {
  _type?: string;
  _key?: string;
  text?: string;
  marks?: string[];
};

export type ScriptMarkDef = { _key: string; _type?: string; href?: string };

export type ScriptTextBlock = {
  _type: "block";
  _key?: string;
  style?: string;
  listItem?: string;
  level?: number;
  children?: ScriptSpan[];
  markDefs?: ScriptMarkDef[];
};

export type ScriptImageBlock = {
  _type: "image";
  _key?: string;
  asset?: { _ref?: string };
  alt?: string;
  caption?: string;
};

export type ScriptBlock = ScriptTextBlock | ScriptImageBlock | { _type?: string; _key?: string };

/** Sanity image assets, pre-fetched server-side and keyed by `asset._ref`. See ./pdf-content.ts. */
export type ScriptImageAsset = {
  data: Buffer;
  format: "png" | "jpg";
  /** width / height of the source art, so the printed height follows from the width. */
  aspect: number;
};
export type ScriptImages = Map<string, ScriptImageAsset>;

const CALLOUT_TONES = new Set<string>([
  "verbatim",
  "askPause",
  "agentNote",
  "clientSays",
  "blockquote",
]);

/* -- Inline runs ----------------------------------------------------------- */

/**
 * Marks stack, so the style is accumulated across the whole `marks` array: ["strong","highlight"]
 * is bold text on an amber ground, not one or the other. A mark that is not a known decorator is
 * looked up in `markDefs` - that is how annotations (currently only `link`) arrive.
 */
function runStyle(
  marks: string[],
  markDefs: ScriptMarkDef[]
): { style: Style; href?: string; bracket: boolean } {
  const style: Style = {};
  let href: string | undefined;
  let bracket = false;

  for (const mark of marks) {
    if (mark === "strong") {
      style.fontWeight = "bold";
    } else if (mark === "em") {
      style.fontStyle = "italic";
    } else if (mark === "underline") {
      style.textDecoration = "underline";
      style.textDecorationColor = UNDERLINE_COLOR;
    } else if (MARK_HIGHLIGHT[mark]) {
      style.backgroundColor = MARK_HIGHLIGHT[mark].bg;
      style.color = MARK_HIGHLIGHT[mark].color;
    } else if (mark === "fill") {
      style.backgroundColor = MARK_FILL.bg;
      style.color = MARK_FILL.color;
      style.fontWeight = "bold";
      // Colour alone disappears on a mono printer, and a blank you cannot see is a blank you
      // forget to fill in.
      bracket = true;
    } else {
      const def = markDefs.find((d) => d._key === mark);
      if (def?._type === "link" && def.href) href = def.href;
    }
  }

  return { style, href, bracket };
}

function renderSpans(block: ScriptTextBlock): ReactNode[] {
  const markDefs = block.markDefs ?? [];
  const out: ReactNode[] = [];

  (block.children ?? []).forEach((span, index) => {
    const raw = winAnsiSafe(span.text ?? "");
    if (!raw) return;

    const { style, href, bracket } = runStyle(span.marks ?? [], markDefs);
    const text = bracket ? "[" + raw.trim() + "]" : raw;
    const key = span._key ?? "s" + index;

    if (href) {
      out.push(
        <Link
          key={key}
          src={href}
          style={{ ...style, color: PDF_COLOR.link, textDecoration: "underline" }}
        >
          {text}
        </Link>
      );
      return;
    }

    if (Object.keys(style).length === 0) {
      out.push(text);
      return;
    }

    out.push(
      <Text key={key} style={style}>
        {text}
      </Text>
    );
  });

  return out;
}

function plainText(block: ScriptTextBlock): string {
  return (block.children ?? []).map((c) => c.text ?? "").join("");
}

/* -- Rows: lists flattened, markers precomputed ---------------------------- */

type Row =
  | { kind: "block"; block: ScriptTextBlock; key: string }
  | { kind: "listItem"; block: ScriptTextBlock; key: string; marker: string; level: number }
  | { kind: "image"; block: ScriptImageBlock; key: string };

/**
 * Portable Text stores list items as flat sibling blocks carrying `listItem` and `level`, so the
 * numbering has to be reconstructed. One counter per level: a deeper level starts fresh, returning
 * to a shallower level continues where it left off, and any non-list block ends the list.
 */
function toRows(blocks: ScriptBlock[]): Row[] {
  const rows: Row[] = [];
  const counters: number[] = [];
  let prevLevel = 0;

  blocks.forEach((raw, index) => {
    const key = (raw as { _key?: string })._key ?? "b" + index;

    if ((raw as ScriptImageBlock)._type === "image") {
      counters.length = 0;
      prevLevel = 0;
      rows.push({ kind: "image", block: raw as ScriptImageBlock, key });
      return;
    }
    if ((raw as ScriptTextBlock)._type !== "block") return;

    const block = raw as ScriptTextBlock;
    if (!block.listItem) {
      counters.length = 0;
      prevLevel = 0;
      rows.push({ kind: "block", block, key });
      return;
    }

    const level = Math.min(4, Math.max(1, block.level ?? 1));
    if (level > prevLevel) counters[level] = 0;
    for (let deeper = level + 1; deeper < counters.length; deeper += 1) counters[deeper] = 0;
    counters[level] = (counters[level] ?? 0) + 1;
    prevLevel = level;

    const marker =
      block.listItem === "number"
        ? counters[level] + "."
        : level >= 2
          ? "–" // en dash for a sub-bullet, so nesting reads even in mono
          : "•";

    rows.push({ kind: "listItem", block, key, marker, level });
  });

  return rows;
}

/* -- Block renderers ------------------------------------------------------- */

/**
 * A short callout is kept whole with wrap={false} - a coloured box split across a page break, its
 * left rule on one sheet and its text on the next, is unreadable. A long one has to be allowed to
 * break, because an unwrappable box taller than the page would overflow off the sheet.
 */
const NO_WRAP_MAX_CHARS = 480;

function Callout({
  tone,
  block,
  language,
}: {
  tone: CalloutTone;
  block: ScriptTextBlock;
  language: ScriptLanguage;
}) {
  const t = CALLOUT[tone];
  const pill = tone === "blockquote" ? null : CALLOUT_PILL[tone][language];

  const border: Style = t.boxed
    ? {
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderColor: t.border,
        borderStyle: t.dashed ? "dashed" : "solid",
        borderRadius: 5,
      }
    : {
        borderLeftWidth: 3,
        borderLeftColor: t.border,
        borderLeftStyle: "solid",
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
      };

  return (
    <View
      wrap={plainText(block).length > NO_WRAP_MAX_CHARS}
      minPresenceAhead={34}
      style={{
        marginTop: 7,
        marginBottom: 7,
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: t.boxed ? 10 : 9,
        paddingRight: 10,
        ...(t.bg ? { backgroundColor: t.bg } : {}),
        ...border,
      }}
    >
      {pill ? (
        <Text
          style={{
            fontSize: TYPE.pill,
            fontWeight: "bold",
            letterSpacing: 0.9,
            color: t.pill,
            marginBottom: 3,
          }}
        >
          {pill}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: t.fontSize,
          lineHeight: 1.45,
          color: t.text,
          ...(t.bold ? { fontWeight: "bold" as const } : {}),
          ...(t.italic ? { fontStyle: "italic" } : {}),
        }}
      >
        {renderSpans(block)}
      </Text>
    </View>
  );
}

const HEADING_STYLE: Record<string, Style> = {
  h1: {
    fontSize: TYPE.h1,
    fontWeight: "bold",
    color: PDF_COLOR.ink,
    marginTop: 14,
    marginBottom: 6,
  },
  h2: {
    fontSize: TYPE.h2,
    fontWeight: "bold",
    color: BRAND,
    marginTop: 13,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: "#BFDCEC",
    borderBottomStyle: "solid",
  },
  h3: {
    fontSize: TYPE.h3,
    fontWeight: "bold",
    color: PDF_COLOR.ink,
    marginTop: 10,
    marginBottom: 3,
  },
  h4: {
    fontSize: TYPE.h4,
    fontWeight: "bold",
    color: PDF_COLOR.body,
    marginTop: 8,
    marginBottom: 2,
  },
};

function ScriptImage({ block, images }: { block: ScriptImageBlock; images: ScriptImages }) {
  const ref = block.asset?._ref;
  const asset = ref ? images.get(ref) : undefined;
  // A missing asset prints nothing rather than an error box - the same silent skip the screen does.
  if (!asset) return null;

  let width = IMAGE_MAX_WIDTH;
  let height = width / asset.aspect;
  if (height > IMAGE_MAX_HEIGHT) {
    height = IMAGE_MAX_HEIGHT;
    width = height * asset.aspect;
  }

  return (
    <View wrap={false} style={{ marginTop: 9, marginBottom: 9, alignItems: "center" }}>
      <Image src={{ data: asset.data, format: asset.format }} style={{ width, height }} />
      {block.caption ? (
        <Text
          style={{
            fontSize: TYPE.small,
            fontStyle: "italic",
            color: PDF_COLOR.muted,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          {winAnsiSafe(block.caption)}
        </Text>
      ) : null}
    </View>
  );
}

/* -- Entry point ----------------------------------------------------------- */

export type ScriptBlocksProps = {
  blocks: ScriptBlock[] | undefined | null;
  language: ScriptLanguage;
  images: ScriptImages;
};

export function ScriptBlocks({ blocks, language, images }: ScriptBlocksProps) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <>
      {toRows(blocks).map((row) => {
        if (row.kind === "image") {
          return <ScriptImage key={row.key} block={row.block} images={images} />;
        }

        if (row.kind === "listItem") {
          return (
            <View
              key={row.key}
              wrap={false}
              style={{
                flexDirection: "row",
                marginTop: 2,
                marginBottom: 2,
                marginLeft: (row.level - 1) * LIST_INDENT,
              }}
            >
              <Text
                style={{
                  width: LIST_MARKER_WIDTH,
                  fontSize: TYPE.body,
                  lineHeight: TYPE.bodyLeading,
                  color: BRAND,
                  ...(row.block.listItem === "number" ? { fontWeight: "bold" as const } : {}),
                }}
              >
                {row.marker}
              </Text>
              <Text
                style={{
                  flexGrow: 1,
                  flexShrink: 1,
                  fontSize: TYPE.body,
                  lineHeight: TYPE.bodyLeading,
                  color: PDF_COLOR.body,
                }}
              >
                {renderSpans(row.block)}
              </Text>
            </View>
          );
        }

        const style = row.block.style ?? "normal";

        if (CALLOUT_TONES.has(style)) {
          return (
            <Callout
              key={row.key}
              tone={style as CalloutTone}
              block={row.block}
              language={language}
            />
          );
        }

        if (HEADING_STYLE[style]) {
          return (
            <Text key={row.key} style={HEADING_STYLE[style]} minPresenceAhead={48}>
              {renderSpans(row.block)}
            </Text>
          );
        }

        // `normal`, and anything authored with a style this file has no entry for.
        return (
          <Text
            key={row.key}
            style={{
              fontSize: TYPE.body,
              lineHeight: TYPE.bodyLeading,
              color: PDF_COLOR.body,
              marginBottom: 5,
            }}
          >
            {renderSpans(row.block)}
          </Text>
        );
      })}
    </>
  );
}

/** True when a field actually has printable content, so empty sections can be skipped. */
export function hasBlocks(blocks: unknown): blocks is ScriptBlock[] {
  return Array.isArray(blocks) && blocks.length > 0;
}
