/**
 * The annotated transcript, on paper.
 *
 * Everything the reader shows — speaker colours, stages, time marks, highlighted objections — laid
 * out for print. `@react-pdf/renderer`, following the precedent in `lib/mailing-labels/` and
 * `lib/presentation-scripts/`: html2canvas and jsPDF.html() rasterise, which turns a 50-page
 * transcript into 50 pictures of text that cannot be searched, selected or read at any zoom.
 *
 * Colours are borrowed from `lib/presentation-scripts/pdf-theme.ts`, so a recorded call prints in
 * the same language as the scripts it is being used to write — client in rose, agent in brand blue.
 * They are opaque hex rather than rgba for the reason stated there: a translucent fill over white
 * prints unpredictably on office lasers.
 *
 * > **Do not wrap the turn list in a `<View>`.** In lib/presentation-scripts/pdf.tsx that
 * > reintroduces a SYNCHRONOUS runaway loop in @react-pdf's pagination — not a slow render but an
 * > event-loop block that a timeout cannot catch, reproduced at 1.5 GB RSS and climbing. On Vercel
 * > that is an OOM'd lambda rather than a 504. The Fragment below is load-bearing.
 *
 * Server-only.
 */

import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { Fragment } from "react";
import { BRAND, PAGE, PDF_COLOR } from "@/lib/presentation-scripts/pdf-theme";
import { speakerLabel } from "./dialogue";
import {
  buildStageTimeline,
  buildTimeMarkers,
  formatClock,
  splitByHighlights,
  type Highlight,
} from "./reading";
import type {
  CallAnalysis,
  CallMetrics,
  CallObjection,
  CallOutcome,
  SpeakerMap,
  SpeakerRole,
  Turn,
} from "./types";

/** Print equivalents of the on-screen speaker palette. */
const SPEAKER_INK: Record<SpeakerRole, { name: string; rule: string; fill?: string }> = {
  agent: { name: BRAND, rule: BRAND },
  client: { name: "#E11D48", rule: "#FB7185", fill: "#FFF1F2" },
  other: { name: "#64748B", rule: "#CBD5E1" },
};

const STAGE_INK: Record<string, string> = {
  opening: "#0EA5E9",
  rapport: "#8B5CF6",
  discovery: "#14B8A6",
  presentation: "#6366F1",
  objection: "#F59E0B",
  trial_close: "#D946EF",
  close: "#22C55E",
  wrap: "#94A3B8",
};

const STAGE_LABEL: Record<string, string> = {
  opening: "Opening",
  rapport: "Breaking the ice",
  discovery: "Qualifying questions",
  presentation: "Presenting the benefits",
  objection: "Objections",
  trial_close: "Trial close",
  close: "Closing",
  wrap: "Wrap-up",
};

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  sold: "Sold",
  not_sold: "Did not sell",
  follow_up: "Follow-up",
  unknown: "Not tagged",
};

const s = StyleSheet.create({
  page: {
    paddingTop: PAGE.marginTop,
    paddingBottom: PAGE.marginBottom,
    paddingHorizontal: PAGE.marginX,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: PDF_COLOR.body,
    backgroundColor: PDF_COLOR.page,
  },
  header: {
    position: "absolute",
    top: PAGE.headerTop,
    left: PAGE.marginX,
    right: PAGE.marginX,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: PDF_COLOR.muted,
  },
  footer: {
    position: "absolute",
    bottom: PAGE.footerBottom,
    left: PAGE.marginX,
    right: PAGE.marginX,
    textAlign: "center",
    fontSize: 7.5,
    color: PDF_COLOR.muted,
  },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: PDF_COLOR.ink, marginBottom: 4 },
  subtitle: { fontSize: 9.5, color: PDF_COLOR.muted, marginBottom: 14 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: PDF_COLOR.ink, marginBottom: 6 },
  factRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  fact: { width: "50%", marginBottom: 3, fontSize: 9.5 },
  factLabel: { color: PDF_COLOR.muted },
  summary: { fontSize: 10, lineHeight: 1.5, marginBottom: 14, color: PDF_COLOR.ink },

  stageHeader: {
    marginTop: 12,
    marginBottom: 5,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderLeftWidth: 3,
    backgroundColor: "#F8FAFC",
  },
  stageName: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  stageMeta: { fontSize: 7.5, color: PDF_COLOR.muted, marginTop: 1 },

  marker: {
    marginTop: 6,
    marginBottom: 4,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLOR.hairline,
    paddingTop: 2,
    fontSize: 7,
    color: PDF_COLOR.muted,
  },

  turn: { flexDirection: "row", marginBottom: 5 },
  turnRule: { width: 1.5, marginRight: 6, borderRadius: 1 },
  turnBody: { flex: 1, paddingRight: 2 },
  speaker: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  line: { fontSize: 9.5, lineHeight: 1.45, color: PDF_COLOR.ink },
  lineMuted: { fontSize: 8.5, lineHeight: 1.4, color: PDF_COLOR.muted, fontFamily: "Helvetica-Oblique" },
  mark: { backgroundColor: "#FDE68A", color: "#422006" },

  objectionTag: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#B45309",
    marginBottom: 1,
  },

  card: {
    borderLeftWidth: 2,
    borderLeftColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  cardTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: PDF_COLOR.ink },
  quote: { fontSize: 9, fontFamily: "Helvetica-Oblique", color: "#4C0519", marginTop: 2 },
  answer: { fontSize: 9, color: PDF_COLOR.ink, marginTop: 2 },
  bullet: { fontSize: 9.5, marginBottom: 2, lineHeight: 1.4 },
});

export type CallPdfInput = {
  title: string;
  createdAt: string;
  durationSeconds: number | null;
  outcome: CallOutcome;
  lineOfBusiness: string | null;
  languageCode: string | null;
  turns: Turn[];
  speakerMap: SpeakerMap | null;
  metrics: CallMetrics | null;
  analysis: CallAnalysis | null;
};

function roleOf(speaker: string, speakerMap: SpeakerMap | null): SpeakerRole {
  return speakerMap?.[speaker]?.role ?? "other";
}

/** The objections that could be anchored to a line, grouped by that line. */
function objectionsByTurn(analysis: CallAnalysis | null): Map<number, CallObjection[]> {
  const map = new Map<number, CallObjection[]>();
  for (const objection of analysis?.objections ?? []) {
    if (typeof objection.turnIndex !== "number") continue;
    const list = map.get(objection.turnIndex) ?? [];
    list.push(objection);
    map.set(objection.turnIndex, list);
  }
  return map;
}

function CallDocument({ input }: { input: CallPdfInput }) {
  const { turns, speakerMap, analysis } = input;
  const stages = buildStageTimeline(analysis?.phases, turns);
  const markers = buildTimeMarkers(turns);
  const markerAt = new Map(markers.map((m) => [m.atTurn, m]));
  const byTurn = objectionsByTurn(analysis);
  const stageStartAt = new Map(stages.map((stage, i) => [stage.startTurn, { stage, i }]));

  const talk = input.metrics
    ? [...new Set(turns.map((t) => t.speaker))]
        .map((id) => `${speakerLabel(id, speakerMap)} ${Math.round((input.metrics!.talkRatio[id] ?? 0) * 100)}%`)
        .join("  ·  ")
    : "—";

  return (
    <Document title={input.title} author="Isaac Plans">
      <Page size="LETTER" style={s.page} wrap>
        <View style={s.header} fixed>
          <Text>{input.title}</Text>
          <Text render={({ pageNumber }) => (pageNumber === 1 ? "" : "Call transcript")} />
        </View>
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`}
        />

        <Text style={s.title}>{input.title}</Text>
        <Text style={s.subtitle}>
          {new Date(input.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </Text>

        <View style={s.factRow}>
          <Text style={s.fact}>
            <Text style={s.factLabel}>Length: </Text>
            {input.durationSeconds ? formatClock(input.durationSeconds) : "—"}
          </Text>
          <Text style={s.fact}>
            <Text style={s.factLabel}>Outcome: </Text>
            {OUTCOME_LABEL[input.outcome] ?? input.outcome}
          </Text>
          <Text style={s.fact}>
            <Text style={s.factLabel}>Product: </Text>
            {input.lineOfBusiness ?? "—"}
          </Text>
          <Text style={s.fact}>
            <Text style={s.factLabel}>Lines: </Text>
            {turns.length}
          </Text>
          <Text style={s.fact}>
            <Text style={s.factLabel}>Talk time: </Text>
            {talk}
          </Text>
          <Text style={s.fact}>
            <Text style={s.factLabel}>Objections: </Text>
            {analysis?.objections.length ?? 0}
          </Text>
        </View>

        {analysis?.summary ? <Text style={s.summary}>{analysis.summary}</Text> : null}

        {stages.length > 0 && (
          <View>
            <Text style={s.h2}>How the call ran</Text>
            {stages.map((stage, i) => (
              <Text key={i} style={s.bullet}>
                {"• "}
                {STAGE_LABEL[stage.phase] ?? stage.phase} — {formatClock(stage.startSec)} to{" "}
                {formatClock(stage.endSec)} ({stage.endTurn - stage.startTurn + 1} lines)
              </Text>
            ))}
          </View>
        )}
      </Page>

      <Page size="LETTER" style={s.page} wrap>
        <View style={s.header} fixed>
          <Text>{input.title}</Text>
          <Text>Transcript</Text>
        </View>
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`}
        />

        {/* NOT wrapped in a View. See the pagination warning at the top of this file. */}
        {turns.map((turn, index) => {
          const role = roleOf(turn.speaker, speakerMap);
          const ink = SPEAKER_INK[role];
          const objections = byTurn.get(index) ?? [];
          const marker = markerAt.get(index);
          const stageStart = stageStartAt.get(index);

          const highlights: Highlight<"mark">[] = objections
            .filter((o) => o.quoteRange)
            .map((o) => ({ ...o.quoteRange!, kind: "mark" as const }));
          const segments = splitByHighlights(turn.text, highlights);

          return (
            <Fragment key={index}>
              {stageStart && (
                <View
                  style={[
                    s.stageHeader,
                    { borderLeftColor: STAGE_INK[stageStart.stage.phase] ?? "#94A3B8" },
                  ]}
                  wrap={false}
                >
                  <Text
                    style={[s.stageName, { color: STAGE_INK[stageStart.stage.phase] ?? "#475569" }]}
                  >
                    {STAGE_LABEL[stageStart.stage.phase] ?? stageStart.stage.phase}
                  </Text>
                  <Text style={s.stageMeta}>
                    {formatClock(stageStart.stage.startSec)} to {formatClock(stageStart.stage.endSec)}
                    {stageStart.stage.note ? ` — ${stageStart.stage.note}` : ""}
                  </Text>
                </View>
              )}

              {marker && <Text style={s.marker}>{marker.label.toUpperCase()}</Text>}

              <View style={s.turn} wrap={false}>
                <View style={[s.turnRule, { backgroundColor: ink.rule }]} />
                <View style={[s.turnBody, ink.fill ? { backgroundColor: ink.fill } : {}]}>
                  <Text style={[s.speaker, { color: ink.name }]}>
                    {speakerLabel(turn.speaker, speakerMap)}
                  </Text>
                  {objections.length > 0 && (
                    <Text style={s.objectionTag}>
                      {objections
                        .map(
                          (o) =>
                            `! ${o.objection}${o.strength === "soft" ? " (possible)" : ""}`
                        )
                        .join("   ")}
                    </Text>
                  )}
                  <Text style={s.line}>
                    {segments.map((segment, i) =>
                      segment.kind === null ? (
                        <Text key={i}>{segment.text}</Text>
                      ) : (
                        <Text key={i} style={s.mark}>
                          {segment.text}
                        </Text>
                      )
                    )}
                  </Text>
                </View>
              </View>
            </Fragment>
          );
        })}
      </Page>

      {analysis && (analysis.objections.length > 0 || analysis.discoveryQuestions.length > 0) && (
        <Page size="LETTER" style={s.page} wrap>
          <View style={s.header} fixed>
            <Text>{input.title}</Text>
            <Text>What to take from this call</Text>
          </View>
          <Text
            style={s.footer}
            fixed
            render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`}
          />

          {analysis.objections.length > 0 && (
            <Fragment>
              <Text style={s.h2}>Objections ({analysis.objections.length})</Text>
              {analysis.objections.map((objection, i) => (
                <View key={i} style={s.card} wrap={false}>
                  <Text style={s.cardTitle}>
                    {objection.objection}
                    {objection.strength === "soft" ? "  (possible)" : ""}
                    {objection.resolved === true ? "  — resolved" : ""}
                    {objection.resolved === false ? "  — not resolved" : ""}
                  </Text>
                  {objection.clientQuote ? (
                    <Text style={s.quote}>&ldquo;{objection.clientQuote}&rdquo;</Text>
                  ) : null}
                  {objection.agentResponse ? (
                    <Text style={s.answer}>&rarr; &ldquo;{objection.agentResponse}&rdquo;</Text>
                  ) : null}
                </View>
              ))}
            </Fragment>
          )}

          {analysis.discoveryQuestions.length > 0 && (
            <Fragment>
              <Text style={[s.h2, { marginTop: 10 }]}>Questions that opened him up</Text>
              {analysis.discoveryQuestions.map((question, i) => (
                <Text key={i} style={s.bullet}>
                  {"• "}
                  {question}
                </Text>
              ))}
            </Fragment>
          )}

          {analysis.closeLanguage.length > 0 && (
            <Fragment>
              <Text style={[s.h2, { marginTop: 10 }]}>How the agent asked for the business</Text>
              {analysis.closeLanguage.map((line, i) => (
                <Text key={i} style={s.bullet}>
                  {"• "}
                  {line}
                </Text>
              ))}
            </Fragment>
          )}

          {analysis.strengths.length > 0 && (
            <Fragment>
              <Text style={[s.h2, { marginTop: 10 }]}>Worked well</Text>
              {analysis.strengths.map((line, i) => (
                <Text key={i} style={s.bullet}>
                  {"• "}
                  {line}
                </Text>
              ))}
            </Fragment>
          )}

          {analysis.improvements.length > 0 && (
            <Fragment>
              <Text style={[s.h2, { marginTop: 10 }]}>Would have worked better</Text>
              {analysis.improvements.map((line, i) => (
                <Text key={i} style={s.bullet}>
                  {"• "}
                  {line}
                </Text>
              ))}
            </Fragment>
          )}
        </Page>
      )}
    </Document>
  );
}

export async function renderCallPdf(input: CallPdfInput): Promise<Buffer> {
  return renderToBuffer(<CallDocument input={input} />);
}

/** A filename that sorts and reads sensibly in a downloads folder. */
export function callPdfFilename(title: string): string {
  const safe = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `${safe || "call"}-transcript.pdf`;
}
