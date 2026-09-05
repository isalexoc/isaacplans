/**
 * One analysis pass over one recording, shared by the button and the queue.
 *
 * Extracted from the analyse route so the QStash worker runs exactly the same code. The owner comes
 * from the RECORDING ROW rather than a Clerk session: the queue has no session, and snippets are
 * filed under an owner. The route still does its own auth and ownership check before calling this.
 *
 * Server-only.
 */

import "server-only";
import { client } from "@/sanity/lib/client";
import { OBJECTIONS_QUERY } from "@/lib/sanity/queries/objections";
import type { Objection } from "@/lib/objections/types";
import { analyzeCall } from "./analysis";
import {
  buildScanIndex,
  mergeScanIntoObjections,
  scanLanguageFor,
  scanTurns,
} from "./objection-scan";
import { getRecording, replaceSnippets, saveAnalysis, setStatus } from "./store";

export type RunAnalysisResult =
  | { ok: true; snippetCount: number; objectionCount: number; libraryMatches: number }
  | { ok: false; error: string };

export async function runAnalysis(recordingId: string): Promise<RunAnalysisResult> {
  const row = await getRecording(recordingId);
  if (!row) return { ok: false, error: "Not found" };
  if (!row.turns || row.turns.length === 0) {
    return { ok: false, error: "This call has not been transcribed yet." };
  }

  await setStatus(recordingId, "analyzing");

  const result = await analyzeCall(row.turns, row.speakerMap ?? null);
  if (!result.ok) {
    // Back to "transcribed", not "failed": the transcript is intact and still the main artifact, so
    // the agent should see a working call with a retryable analysis, not a broken one.
    await setStatus(recordingId, "transcribed", result.error);
    return { ok: false, error: result.error };
  }

  /**
   * The second detector.
   *
   * Deliberately best-effort and after the model: if Sanity is unreachable the call is still fully
   * analysed, just without the library cross-links. Losing the whole analysis to a CMS blip would
   * be a bad trade for an enrichment.
   */
  let objections = result.analysis.objections;
  let libraryMatches = 0;
  try {
    const library = await client.fetch<Objection[]>(OBJECTIONS_QUERY);
    const index = buildScanIndex(library, { language: scanLanguageFor(row.languageCode) });
    const matches = scanTurns(row.turns, row.speakerMap ?? null, index);
    libraryMatches = matches.length;
    objections = mergeScanIntoObjections(objections, matches, row.turns);
  } catch (error) {
    console.warn("[CALL_STUDY] Objection library scan failed, keeping the model's findings:", error);
  }

  await saveAnalysis(recordingId, { ...result.analysis, objections });
  // Replace rather than append: re-analysing a call must not double its entries in the library.
  const snippetCount = await replaceSnippets(
    recordingId,
    row.ownerUserId,
    result.snippets,
    row.speakerMap ?? null
  );

  return { ok: true, snippetCount, objectionCount: objections.length, libraryMatches };
}
