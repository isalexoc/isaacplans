import "server-only";
import {
  Document,
  Font,
  Page,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { Styles } from "@react-pdf/renderer";
import { Fragment } from "react";
import type { ReactElement } from "react";
import type { ObjectionLob } from "@/lib/objections/types";
import {
  LANGUAGE_LABEL,
  LOB_TITLE,
  type ScriptLanguage,
  type ScriptPdfVariant,
  winAnsiSafe,
} from "./format";
import { ScriptBlocks, hasBlocks, type ScriptBlock, type ScriptImages } from "./pdf-blocks";
import {
  ACCENT,
  BRAND,
  CALLOUT,
  CALLOUT_PILL,
  OBJECTION_CARD,
  PAGE,
  PDF_COLOR,
  TIPS,
  TYPE,
} from "./pdf-theme";

/** See the note in ./pdf-blocks.tsx: @react-pdf/renderer exports no `Style` type directly. */
type Style = Styles[string];

/**
 * The printable sales script.
 *
 * A real vector PDF via @react-pdf/renderer, exactly like lib/mailing-labels/pdf.tsx — never
 * html2canvas or jsPDF.html(). This document is mostly text; rasterising it would produce a
 * multi-megabyte file whose words cannot be searched, selected or read cleanly at 300 DPI, and the
 * whole point is that an agent prints it and reads it out loud.
 *
 * Fonts are the built-in Helvetica: no Font.register, so no network fetch and nothing to fail at
 * render time. Its four faces (regular / bold / oblique / bold-oblique) cover strong, em and
 * strong+em, and its WinAnsi encoding covers every Spanish accent. See winAnsiSafe() in ./format.ts
 * for the one thing it cannot draw.
 */

const FONT = "Helvetica";

/**
 * Never hyphenate. A script is read aloud; a word broken as "com-pliance" across a line end is a
 * stumble on a live call. lib/mailing-labels/pdf.tsx registers the identical callback for its own
 * reasons, and the font store is a per-process singleton — registering it here too makes the
 * behaviour deterministic regardless of which module the lambda loaded first.
 */
Font.registerHyphenationCallback((word) => [word]);

/* -- Payload ---------------------------------------------------------------- */

export type ScriptPdfSection = {
  key: string;
  title: string;
  content?: ScriptBlock[];
  tips?: ScriptBlock[];
};

export type ScriptPdfObjection = {
  id: string;
  title: string;
  typeLabel: string;
  triggers: string[];
  answer?: ScriptBlock[];
};

/** One language's worth of printable content. "both" renders two of these into one file. */
export type ScriptPdfPayload = {
  lob: ObjectionLob;
  language: ScriptLanguage;
  /** The Sanity document title, e.g. "Final Expense - Complete Script". Optional. */
  title?: string;
  updatedAt?: string;
  sections: ScriptPdfSection[];
  objections: ScriptPdfObjection[];
  complete?: ScriptBlock[];
};

/* -- Chrome ----------------------------------------------------------------- */

const UI = {
  en: {
    script: "Sales Script",
    inside: "What is inside",
    legend: "How to read this",
    objections: "Objection library",
    objectionsNote: "What they say, and what you say back.",
    complete: "Complete script (all-in-one)",
    tips: "TIPS",
    alsoHeard: "Also heard as",
    updated: "Script updated",
    printed: "Printed",
    footer: "Isaac Plans Insurance - internal sales script. Not for client distribution.",
    legendRows: [
      "Read this out loud, word for word.",
      "Ask it, then stop talking and wait.",
      "For you only. Never read this to the client.",
      "Something the client is likely to say here.",
      "Fill in the blank before you say it.",
    ],
  },
  es: {
    script: "Guión de Ventas",
    inside: "Contenido",
    legend: "Cómo leer esto",
    objections: "Biblioteca de objeciones",
    objectionsNote: "Lo que dicen, y lo que usted responde.",
    complete: "Guión completo (todo en uno)",
    tips: "CONSEJOS",
    alsoHeard: "También lo dicen así",
    updated: "Guión actualizado",
    printed: "Impreso",
    footer: "Isaac Plans Insurance - guión interno de ventas. No distribuir al cliente.",
    legendRows: [
      "Lea esto en voz alta, palabra por palabra.",
      "Pregúntelo, luego calle y espere.",
      "Solo para usted. Nunca lea esto al cliente.",
      "Algo que el cliente probablemente dirá aquí.",
      "Complete el espacio antes de decirlo.",
    ],
  },
} as const;

function formatDate(iso: string | undefined, language: ScriptLanguage): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  // UTC on purpose: Sanity stores an instant, the lambda runs in UTC, and a date stamp that
  // shifts by a day depending on where the render happened is worse than useless on a printout.
  return date.toLocaleDateString(language === "es" ? "es-US" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function RunningHeader({ label }: { label: string }) {
  return (
    <View
      fixed
      // Suppressed on the masthead page, which carries the same information at full size.
      render={({ pageNumber }) =>
        pageNumber === 1 ? null : (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderBottomWidth: 0.5,
              borderBottomColor: PDF_COLOR.hairline,
              borderBottomStyle: "solid",
              paddingBottom: 5,
            }}
          >
            <Text style={{ fontSize: TYPE.micro, color: PDF_COLOR.muted }}>{label}</Text>
            <Text style={{ fontSize: TYPE.micro, color: BRAND, fontWeight: "bold" }}>
              ISAAC PLANS
            </Text>
          </View>
        )
      }
      style={{
        position: "absolute",
        top: PAGE.headerTop,
        left: PAGE.marginX,
        right: PAGE.marginX,
        height: 18,
      }}
    />
  );
}

function RunningFooter({ note }: { note: string }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: PAGE.footerBottom,
        left: PAGE.marginX,
        right: PAGE.marginX,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopWidth: 0.5,
        borderTopColor: PDF_COLOR.hairline,
        borderTopStyle: "solid",
        paddingTop: 5,
      }}
    >
      <Text style={{ fontSize: TYPE.micro, color: PDF_COLOR.muted }}>{note}</Text>
      <Text
        style={{ fontSize: TYPE.micro, color: PDF_COLOR.muted }}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

/**
 * Section titles get a PDF outline entry, so the sidebar of any viewer becomes a table of contents.
 * ViewProps in @react-pdf/renderer's .d.ts declares `bookmark` on Page only, but the renderer reads
 * `node.props.bookmark` on every node (render/index.js), so the prop is passed through this helper
 * rather than sprinkling casts through the tree.
 */
function bookmarkProps(title: string): Record<string, unknown> {
  return { bookmark: { title: winAnsiSafe(title), fit: false, expanded: false } };
}

/**
 * Every section starts on a fresh sheet. The masthead owns page 1, so there is no "first section"
 * exception - and a section that begins three lines from the bottom of the previous page is worse
 * than a half-empty sheet when the thing is sitting in a binder.
 */
function SectionHeading({ title }: { title: string }) {
  return (
    <View break {...bookmarkProps(title)} style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: TYPE.h1, fontWeight: "bold", color: PDF_COLOR.ink }}>{title}</Text>
      <View style={{ height: 2.5, width: 54, backgroundColor: ACCENT, marginTop: 6 }} />
    </View>
  );
}

/* -- The masthead / legend page --------------------------------------------- */

const LEGEND_TONES = ["verbatim", "askPause", "agentNote", "clientSays"] as const;

function Masthead({
  payload,
  sectionTitles,
  objectionCount,
  showComplete,
}: {
  payload: ScriptPdfPayload;
  /** Only the sections this variant actually prints. */
  sectionTitles: string[];
  objectionCount: number;
  showComplete: boolean;
}) {
  const ui = UI[payload.language];
  const product = LOB_TITLE[payload.lob][payload.language];
  const updated = formatDate(payload.updatedAt, payload.language);
  const printed = formatDate(new Date().toISOString(), payload.language);

  const inside: string[] = [
    ...sectionTitles,
    ...(objectionCount > 0 ? [`${ui.objections} (${objectionCount})`] : []),
    ...(showComplete ? [ui.complete] : []),
  ];

  return (
    <View>
      <View style={{ height: 4, backgroundColor: BRAND, marginBottom: 18 }} />
      <Text style={{ fontSize: TYPE.small, letterSpacing: 1.6, color: BRAND, fontWeight: "bold" }}>
        {ui.script.toUpperCase()} - {LANGUAGE_LABEL[payload.language].toUpperCase()}
      </Text>
      <Text
        style={{
          fontSize: TYPE.masthead,
          fontWeight: "bold",
          color: PDF_COLOR.ink,
          marginTop: 8,
          lineHeight: 1.15,
        }}
      >
        {product}
      </Text>
      {payload.title ? (
        <Text style={{ fontSize: TYPE.body, color: PDF_COLOR.muted, marginTop: 6 }}>
          {winAnsiSafe(payload.title)}
        </Text>
      ) : null}
      <Text style={{ fontSize: TYPE.small, color: PDF_COLOR.muted, marginTop: 10 }}>
        {[updated ? `${ui.updated}: ${updated}` : "", `${ui.printed}: ${printed}`]
          .filter(Boolean)
          .join("   -   ")}
      </Text>

      {inside.length > 0 ? (
        <View style={{ marginTop: 26 }}>
          <Text
            style={{
              fontSize: TYPE.pill,
              letterSpacing: 1.2,
              fontWeight: "bold",
              color: PDF_COLOR.muted,
              marginBottom: 7,
            }}
          >
            {ui.inside.toUpperCase()}
          </Text>
          {inside.map((line, index) => (
            <View
              key={line}
              style={{ flexDirection: "row", marginBottom: 3, alignItems: "flex-start" }}
            >
              <Text style={{ width: 20, fontSize: TYPE.body, color: BRAND, fontWeight: "bold" }}>
                {index + 1}.
              </Text>
              <Text style={{ fontSize: TYPE.body, color: PDF_COLOR.body }}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/*
        The key. On screen the callouts are told apart by colour; on paper - and especially on the
        office laser that prints everything grey - the label and the rule are what carry the
        meaning, so they are spelled out once here.
      */}
      <View style={{ marginTop: 26 }}>
        <Text
          style={{
            fontSize: TYPE.pill,
            letterSpacing: 1.2,
            fontWeight: "bold",
            color: PDF_COLOR.muted,
            marginBottom: 7,
          }}
        >
          {ui.legend.toUpperCase()}
        </Text>
        {LEGEND_TONES.map((tone, index) => {
          const t = CALLOUT[tone];
          return (
            <View
              key={tone}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 5,
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 8,
                paddingRight: 8,
                backgroundColor: t.bg,
                borderLeftWidth: 3,
                borderLeftColor: t.border,
                borderLeftStyle: "solid",
              }}
            >
              <Text
                style={{
                  width: 130,
                  fontSize: TYPE.pill,
                  fontWeight: "bold",
                  letterSpacing: 0.9,
                  color: t.pill,
                }}
              >
                {CALLOUT_PILL[tone][payload.language]}
              </Text>
              <Text style={{ flexGrow: 1, fontSize: TYPE.small, color: PDF_COLOR.body }}>
                {ui.legendRows[index]}
              </Text>
            </View>
          );
        })}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3, paddingLeft: 8 }}>
          <Text
            style={{
              width: 130,
              fontSize: TYPE.small,
              fontWeight: "bold",
              color: BRAND,
            }}
          >
            [ ... ]
          </Text>
          <Text style={{ flexGrow: 1, fontSize: TYPE.small, color: PDF_COLOR.body }}>
            {ui.legendRows[4]}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* -- Body ------------------------------------------------------------------- */

function TipsPanel({
  tips,
  language,
  images,
}: {
  tips: ScriptBlock[];
  language: ScriptLanguage;
  images: ScriptImages;
}) {
  return (
    <View
      minPresenceAhead={50}
      style={{
        marginTop: 12,
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 11,
        paddingRight: 11,
        backgroundColor: TIPS.bg,
        borderWidth: 0.75,
        borderColor: TIPS.border,
        borderStyle: "solid",
        borderRadius: 5,
      }}
    >
      <Text
        style={{
          fontSize: TYPE.pill,
          fontWeight: "bold",
          letterSpacing: 1,
          color: TIPS.pill,
          marginBottom: 4,
        }}
      >
        {UI[language].tips}
      </Text>
      <ScriptBlocks blocks={tips} language={language} images={images} />
    </View>
  );
}

function ObjectionCard({
  objection,
  language,
  images,
}: {
  objection: ScriptPdfObjection;
  language: ScriptLanguage;
  images: ScriptImages;
}) {
  const ui = UI[language];
  return (
    <View
      // Deliberately wrappable: an answer can be long, and a card that refuses to break would be
      // pushed whole onto the next page, leaving half a sheet empty in a binder.
      minPresenceAhead={72}
      style={{
        marginBottom: 14,
        paddingTop: 9,
        paddingBottom: 9,
        paddingLeft: 11,
        paddingRight: 11,
        borderWidth: 0.75,
        borderColor: OBJECTION_CARD.border,
        borderStyle: "solid",
        borderRadius: 5,
        backgroundColor: OBJECTION_CARD.bg,
      }}
    >
      <Text
        style={{
          fontSize: TYPE.h3,
          fontWeight: "bold",
          color: OBJECTION_CARD.quote,
          marginBottom: 3,
        }}
      >
        {`“${winAnsiSafe(objection.title)}”`}
      </Text>
      <Text
        style={{
          fontSize: TYPE.micro,
          letterSpacing: 0.7,
          fontWeight: "bold",
          color: PDF_COLOR.muted,
          marginBottom: objection.triggers.length > 0 ? 3 : 6,
        }}
      >
        {winAnsiSafe(objection.typeLabel).toUpperCase()}
      </Text>
      {objection.triggers.length > 0 ? (
        <Text
          style={{
            fontSize: TYPE.small,
            fontStyle: "italic",
            color: PDF_COLOR.muted,
            marginBottom: 6,
          }}
        >
          {`${ui.alsoHeard}: ${winAnsiSafe(objection.triggers.join(" - "))}`}
        </Text>
      ) : null}
      <ScriptBlocks blocks={objection.answer} language={language} images={images} />
    </View>
  );
}

const PAGE_STYLE: Style = {
  backgroundColor: PDF_COLOR.page,
  fontFamily: FONT,
  color: PDF_COLOR.body,
  paddingTop: PAGE.marginTop,
  paddingBottom: PAGE.marginBottom,
  paddingLeft: PAGE.marginX,
  paddingRight: PAGE.marginX,
};

function ScriptPage({
  payload,
  variant,
  images,
}: {
  payload: ScriptPdfPayload;
  variant: ScriptPdfVariant;
  images: ScriptImages;
}) {
  const ui = UI[payload.language];
  const product = LOB_TITLE[payload.lob][payload.language];
  const headerLabel = `${product} - ${ui.script} - ${LANGUAGE_LABEL[payload.language]}`;

  const showSections = variant === "full" || variant === "script";
  const showObjections = variant === "full" || variant === "objections";
  const showComplete = variant === "complete";

  const sections = showSections
    ? payload.sections.filter((s) => hasBlocks(s.content) || hasBlocks(s.tips))
    : [];
  const objections = showObjections ? payload.objections : [];

  return (
    <Page size={[PAGE.width, PAGE.height]} style={PAGE_STYLE} wrap>
      <RunningHeader label={winAnsiSafe(headerLabel)} />
      <RunningFooter note={ui.footer} />

      <Masthead
        payload={payload}
        sectionTitles={sections.map((s) => s.title)}
        objectionCount={objections.length}
        showComplete={showComplete && hasBlocks(payload.complete)}
      />

      {/*
        Fragments, not wrapper <View>s. In @react-pdf 4.5.1 a node carrying `break` has to be a
        direct child of the <Page>: nested one level deeper inside a View that itself overflows the
        page, the paginator drops the overflowing content, and with a `fixed` header or footer also
        on the page it never terminates at all. Verified against this exact tree.
      */}
      {sections.map((section) => (
        <Fragment key={section.key}>
          <SectionHeading title={section.title} />
          <ScriptBlocks blocks={section.content} language={payload.language} images={images} />
          {hasBlocks(section.tips) ? (
            <TipsPanel tips={section.tips} language={payload.language} images={images} />
          ) : null}
        </Fragment>
      ))}

      {objections.length > 0 ? (
        <>
          <SectionHeading title={ui.objections} />
          <Text style={{ fontSize: TYPE.small, color: PDF_COLOR.muted, marginBottom: 12 }}>
            {ui.objectionsNote}
          </Text>
          {objections.map((objection) => (
            <ObjectionCard
              key={objection.id}
              objection={objection}
              language={payload.language}
              images={images}
            />
          ))}
        </>
      ) : null}

      {showComplete && hasBlocks(payload.complete) ? (
        <>
          <SectionHeading title={ui.complete} />
          <ScriptBlocks blocks={payload.complete} language={payload.language} images={images} />
        </>
      ) : null}
    </Page>
  );
}

/* -- Render ----------------------------------------------------------------- */

export type RenderScriptPdfParams = {
  /** One entry per language. Two entries produce the EN document followed by the ES document. */
  payloads: ScriptPdfPayload[];
  variant: ScriptPdfVariant;
  images: ScriptImages;
};

export async function renderScriptPdf(params: RenderScriptPdfParams): Promise<Buffer> {
  const { payloads, variant, images } = params;
  const lead = payloads[0];
  const title = lead
    ? `${LOB_TITLE[lead.lob].en} - Sales Script`
    : "Sales Script";

  const doc: ReactElement<DocumentProps> = (
    <Document title={title} author="Isaac Plans Insurance" creator="Isaac Plans Insurance">
      {payloads.map((payload) => (
        <ScriptPage
          key={`${payload.lob}-${payload.language}`}
          payload={payload}
          variant={variant}
          images={images}
        />
      ))}
    </Document>
  );

  return renderToBuffer(doc);
}
