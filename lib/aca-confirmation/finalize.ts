/**
 * After a client signs: archive the PDF, put a copy in the contact's Documents, leave a note,
 * tag the contact. Runs as a QStash job (/api/queue/aca-confirmation-finalize), with the daily
 * queue-reconcile as the backstop, and inline after the response when QStash is off.
 *
 * Every step stamps its own column and is skipped once stamped, so a retry resumes exactly where
 * the last attempt stopped and never posts a second note or uploads a second file. Order matters:
 *  1. pdf      — rendered ONCE from the signed snapshot and archived in Cloudinary (10 years).
 *  2. crmFile  — the SAME archived bytes uploaded to the File Upload field, which GHL lists under
 *                the contact's Documents → Internal → Custom Fields. Never re-rendered: two copies
 *                of a legal record must be the same file.
 *  3. note     — says whether the Documents copy made it.
 *  4. tag      — last, so a "tag added" automation fires after everything else exists.
 *
 * Server-only (database, CRM, Cloudinary).
 */

import "server-only";
import { and, asc, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { acaConfirmationEvents, acaConfirmations } from "@/lib/db/schema";
import {
  agentCrmAddContactTags,
  agentCrmGetBaseCredentials,
  agentCrmRemoveContactTags,
  agentCrmUploadCustomFieldFile,
} from "@/lib/agent-crm-contacts";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import {
  ACA_CONFIRMATION_NOTE_TITLE,
  ACA_CONFIRMATION_SIGNED_TAG,
  acaConfirmationFileFieldId,
} from "./config";
import { describeDevice, describeLocation } from "./format";
import { acaConfirmationPdfFilename, renderAcaConfirmationPdf } from "./pdf";
import { fetchStoredConfirmationPdf, storeConfirmationPdf } from "./storage";
import { addEvent, getConfirmationRow, type ConfirmationEventRow, type ConfirmationRow } from "./store";
import type { AcaConfirmationTrailEntry } from "./types";

const LOG = "[ACA_CONFIRMATION]";
const MAX_TRAIL_ROWS = 14;
/** Long enough to outlast a fix of a missing scope or env var; newest first, so a stuck old one never starves new ones. */
const RECONCILE_WINDOW_DAYS = 60;
const LEASE_MS = 2 * 60 * 1000;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com").replace(/\/+$/, "");

type Step = "pdf" | "crmFile" | "note" | "tag";
/** blocked = waiting on an earlier step that hasn't succeeded yet (retried later, not an error). */
type StepStatus = "done" | "skipped" | "failed" | "blocked";
export type FinalizeResult = { done: boolean; steps: Record<Step, StepStatus> };

const TRAIL_TYPES = new Set(["created", "email_sent", "resent", "viewed", "signed"]);

function trailEntry(row: ConfirmationRow, event: ConfirmationEventRow): AcaConfirmationTrailEntry {
  const type = event.type as AcaConfirmationTrailEntry["type"];
  const byAgent = type === "created" || type === "email_sent" || type === "resent";
  const to = event.detail && typeof event.detail.to === "string" ? event.detail.to : null;
  return {
    at: event.at.toISOString(),
    type,
    who: byAgent ? row.agentName : row.consumerName,
    email: byAgent && type !== "created" ? to : null,
    ip: event.ip,
    location: describeLocation({ city: event.city, region: event.region, country: event.country }),
    device: describeDevice(event.userAgent),
  };
}

/**
 * The PDF's trail page, from the events: everything up to the signature, keeping the first three
 * views and the last one (a client can reload many times). "Requested" and "Signed" are rebuilt
 * from the row's own columns if their event rows are missing, because those two must always print.
 */
export async function buildTrail(row: ConfirmationRow): Promise<AcaConfirmationTrailEntry[]> {
  const events = await db
    .select()
    .from(acaConfirmationEvents)
    .where(eq(acaConfirmationEvents.confirmationId, row.id))
    .orderBy(asc(acaConfirmationEvents.at));
  const signedAt = row.signedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const relevant = events.filter((e) => TRAIL_TYPES.has(e.type) && e.at.getTime() <= signedAt + 5_000);

  const views = relevant.filter((e) => e.type === "viewed");
  const keptViews = new Set(views.length > 4 ? [...views.slice(0, 3), views[views.length - 1]] : views);
  const kept = relevant.filter((e) => e.type !== "viewed" || keptViews.has(e));

  const entries = kept.map((e) => trailEntry(row, e));
  if (!kept.some((e) => e.type === "created")) {
    entries.unshift({
      at: row.createdAt.toISOString(),
      type: "created",
      who: row.agentName,
      email: null,
      ip: row.requestIp,
      location: describeLocation({ city: row.requestCity, region: row.requestRegion, country: row.requestCountry }),
      device: describeDevice(row.requestUserAgent),
    });
  }
  if (row.signedAt && !kept.some((e) => e.type === "signed")) {
    entries.push({
      at: row.signedAt.toISOString(),
      type: "signed",
      who: row.consumerName,
      email: null,
      ip: row.signerIp,
      location: describeLocation({ city: row.signerCity, region: row.signerRegion, country: row.signerCountry }),
      device: describeDevice(row.signerUserAgent),
    });
  }
  // Over the cap (many resends): keep the start and the signature.
  return entries.length > MAX_TRAIL_ROWS
    ? [...entries.slice(0, MAX_TRAIL_ROWS - 1), entries[entries.length - 1]]
    : entries;
}

/** Render the signed PDF from the row. Used by finalize and by the admin download fallback. */
export async function renderSignedConfirmationPdf(row: ConfirmationRow): Promise<Buffer> {
  if (row.status !== "signed" || !row.signedSnapshot || !row.signaturePng || !row.evidenceSha256) {
    throw new Error(`Confirmation ${row.id} is not signed`);
  }
  return renderAcaConfirmationPdf({
    id: row.id,
    snapshot: row.signedSnapshot,
    signerName: row.consumerName,
    signaturePng: row.signaturePng,
    signatureMethod: row.signatureMethod === "typed" ? "typed" : "drawn",
    trail: await buildTrail(row),
    evidenceSha256: row.evidenceSha256,
    signerIpMatchesAgent: row.signerIpMatchesAgent,
  });
}

export function signedPdfFilename(row: ConfirmationRow): string {
  return acaConfirmationPdfFilename({
    id: row.id,
    consumerName: row.consumerName,
    signedAtIso: (row.signedAt ?? row.createdAt).toISOString(),
    language: row.signedLanguage === "en" ? "en" : "es",
  });
}

/** Plain text (GHL notes don't render Markdown), in the language the client signed in. */
function formatNote(row: ConfirmationRow, crmFileSaved: boolean): string {
  const es = row.signedLanguage !== "en";
  const location = describeLocation({ city: row.signerCity, region: row.signerRegion, country: row.signerCountry });
  const device = describeDevice(row.signerUserAgent);
  const method =
    row.signatureMethod === "typed" ? (es ? "nombre escrito" : "typed name") : es ? "dibujada a mano" : "drawn by hand";
  return [
    es
      ? "✍️ Confirmación de revisión de la solicitud del Mercado firmada (CMS)"
      : "✍️ Marketplace application review confirmation signed (CMS)",
    "",
    `${es ? "Firmado por" : "Signed by"}: ${row.consumerName}`,
    `${es ? "Fecha" : "Date"}: ${row.signedSnapshot?.signedAtLocal ?? row.signedAt?.toISOString() ?? ""}`,
    `${es ? "Correo" : "Email"}: ${row.contactEmail}`,
    `IP: ${row.signerIp ?? "—"}${location ? ` · ${location}` : ""}`,
    `${es ? "Dispositivo" : "Device"}: ${device ?? "—"}`,
    `${es ? "Firma" : "Signature"}: ${method}`,
    row.signerIpMatchesAgent
      ? es
        ? "⚠️ La firma se hizo desde la misma IP que usó el agente para esta solicitud."
        : "⚠️ Signed from the same IP address the agent used for this request."
      : null,
    `${es ? "Agente" : "Agent"}: ${row.agentName} (NPN ${row.agentNpn})`,
    `${es ? "Documento" : "Document"}: ${row.id}`,
    "",
    crmFileSaved
      ? es
        ? "PDF: en Documentos → Interno → Campos personalizados del contacto."
        : "PDF: in the contact's Documents → Internal → Custom Fields."
      : null,
    `${es ? "Descargar (admin)" : "Download (admin)"}: ${SITE_URL}/api/admin/aca-confirmation/requests/${row.id}/pdf`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

async function stamp(id: string, values: Partial<typeof acaConfirmations.$inferInsert>): Promise<void> {
  await db
    .update(acaConfirmations)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(acaConfirmations.id, id));
}

async function failed(id: string, step: Step, error: unknown): Promise<StepStatus> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${LOG} Finalize step "${step}" failed for ${id}:`, error);
  await addEvent(id, "finalize_failed", null, null, { step, error: message.slice(0, 500) });
  return "failed";
}

/**
 * One run at a time per confirmation. QStash delivers at least once, the inline fallback can race a
 * QStash message whose publish "failed" after it was accepted, and the daily reconcile can overlap
 * a retry: without this, two runs could each upload the file and post the note. The lease is one
 * conditional UPDATE (no transactions on the Neon HTTP driver), and it expires on its own if a run
 * dies, so nothing stays locked.
 */
async function takeLease(id: string): Promise<boolean> {
  const now = new Date();
  const [taken] = await db
    .update(acaConfirmations)
    .set({ finalizeLeaseUntil: new Date(now.getTime() + LEASE_MS) })
    .where(
      and(
        eq(acaConfirmations.id, id),
        or(isNull(acaConfirmations.finalizeLeaseUntil), lt(acaConfirmations.finalizeLeaseUntil, now))
      )
    )
    .returning({ id: acaConfirmations.id });
  return Boolean(taken);
}

async function releaseLease(id: string): Promise<void> {
  await db.update(acaConfirmations).set({ finalizeLeaseUntil: null }).where(eq(acaConfirmations.id, id));
}

export async function finalizeAcaConfirmation(id: string): Promise<FinalizeResult> {
  const steps: Record<Step, StepStatus> = { pdf: "skipped", crmFile: "skipped", note: "skipped", tag: "skipped" };
  const first = await getConfirmationRow(id);
  if (!first || first.status !== "signed") {
    console.warn(`${LOG} Finalize skipped: ${id} is not a signed confirmation`);
    return { done: true, steps };
  }
  if (!(await takeLease(id))) {
    // Another run is on it. Not done from this run's point of view, so QStash retries later and
    // finds everything stamped.
    console.info(`${LOG} Finalize already running for ${id}`);
    return { done: false, steps: { pdf: "blocked", crmFile: "blocked", note: "blocked", tag: "blocked" } };
  }
  try {
    return await runSteps(id, steps);
  } finally {
    await releaseLease(id).catch((error) => console.warn(`${LOG} Lease not released for ${id}:`, error));
  }
}

async function runSteps(id: string, steps: Record<Step, StepStatus>): Promise<FinalizeResult> {
  let row = (await getConfirmationRow(id))!;
  const creds = agentCrmGetBaseCredentials();
  const fieldId = acaConfirmationFileFieldId();
  /** The ARCHIVED bytes, once known. Every copy is made from these, never from a fresh render. */
  let archived: Buffer | null = null;

  // 1. Archive
  if (!row.pdfStoredAt) {
    try {
      const stored = await storeConfirmationPdf({ id: row.id, pdf: await renderSignedConfirmationPdf(row) });
      archived = stored.pdf;
      await stamp(row.id, {
        pdfPublicId: stored.publicId,
        pdfSha256: stored.sha256,
        pdfBytes: stored.bytes,
        pdfStoredAt: new Date(),
      });
      await addEvent(row.id, "pdf_stored", null, null, { publicId: stored.publicId, sha256: stored.sha256 });
      steps.pdf = "done";
    } catch (error) {
      steps.pdf = await failed(row.id, "pdf", error);
    }
    row = (await getConfirmationRow(id)) ?? row;
  }
  const pdfStored = Boolean(row.pdfStoredAt);

  // 2. The contact's Documents (File Upload field): the archived file, or nothing.
  if (fieldId && !row.crmFileSavedAt) {
    if (!pdfStored) {
      steps.crmFile = "blocked";
    } else {
      try {
        if (!creds) throw new Error("CRM is not configured");
        if (!archived && row.pdfPublicId) archived = await fetchStoredConfirmationPdf(row.pdfPublicId);
        if (!archived) throw new Error("The archived PDF could not be read back");
        const filename = signedPdfFilename(row);
        const files = await agentCrmUploadCustomFieldFile(
          new Blob([new Uint8Array(archived)], { type: "application/pdf" }),
          filename,
          row.crmContactId,
          creds.locationId,
          fieldId,
          creds.token,
          LOG
        );
        if (!files) throw new Error("The CRM refused the upload");
        const url = files.find((f) => f.name === filename)?.url ?? null;
        await stamp(row.id, { crmFileUrl: url, crmFileSavedAt: new Date() });
        await addEvent(row.id, "crm_file_saved", null, null, { filename, url });
        steps.crmFile = "done";
      } catch (error) {
        steps.crmFile = await failed(row.id, "crmFile", error);
      }
      row = (await getConfirmationRow(id)) ?? row;
    }
  }
  const copiesDone = pdfStored && (!fieldId || Boolean(row.crmFileSavedAt));

  // 3. Note: once the archive exists, so its "PDF" lines are true. It doesn't wait for the
  //    Documents copy (a missing CRM scope must not hide the signature from the agent); it says
  //    whether that copy made it.
  if (!row.notePostedAt) {
    if (!pdfStored) {
      steps.note = "blocked";
    } else {
      try {
        if (!creds) throw new Error("CRM is not configured");
        await createContactNote({
          contactId: row.crmContactId,
          token: creds.token,
          title: ACA_CONFIRMATION_NOTE_TITLE,
          body: formatNote(row, Boolean(row.crmFileSavedAt)),
        });
        await stamp(row.id, { notePostedAt: new Date() });
        await addEvent(row.id, "note_posted", null, null);
        steps.note = "done";
      } catch (error) {
        steps.note = await failed(row.id, "note", error);
      }
    }
  }

  // 4. Tag, last and only once every copy exists, so a "tag added" automation never fires ahead
  //    of the PDF. Removed first so it fires on every signature.
  if (!row.taggedAt) {
    if (!copiesDone) {
      steps.tag = "blocked";
    } else {
      try {
        if (!creds) throw new Error("CRM is not configured");
        await agentCrmRemoveContactTags(row.crmContactId, [ACA_CONFIRMATION_SIGNED_TAG], creds.token, LOG);
        const tagged = await agentCrmAddContactTags(row.crmContactId, [ACA_CONFIRMATION_SIGNED_TAG], creds.token, LOG);
        if (!tagged) throw new Error("The CRM refused the tag");
        await stamp(row.id, { taggedAt: new Date() });
        await addEvent(row.id, "tagged", null, null, { tag: ACA_CONFIRMATION_SIGNED_TAG });
        steps.tag = "done";
      } catch (error) {
        steps.tag = await failed(row.id, "tag", error);
      }
    }
  }

  const done = !Object.values(steps).some((s) => s === "failed" || s === "blocked");
  return { done, steps };
}

/**
 * Daily backstop (app/api/cron/queue-reconcile): finish signed confirmations whose steps never
 * completed, e.g. QStash gave up or was off and the inline run died. Bounded by age and count.
 */
export async function reconcileAcaConfirmations(limit = 10): Promise<{ checked: number; completed: number; failed: number }> {
  const since = new Date(Date.now() - RECONCILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const missing = [
    isNull(acaConfirmations.pdfStoredAt),
    isNull(acaConfirmations.notePostedAt),
    isNull(acaConfirmations.taggedAt),
    ...(acaConfirmationFileFieldId() ? [isNull(acaConfirmations.crmFileSavedAt)] : []),
  ];
  const rows = await db
    .select({ id: acaConfirmations.id })
    .from(acaConfirmations)
    .where(and(eq(acaConfirmations.status, "signed"), gt(acaConfirmations.signedAt, since), or(...missing)))
    .orderBy(desc(acaConfirmations.signedAt))
    .limit(limit);

  let completed = 0;
  let failedCount = 0;
  for (const { id } of rows) {
    try {
      const result = await finalizeAcaConfirmation(id);
      if (result.done) completed++;
      else failedCount++;
    } catch (error) {
      failedCount++;
      console.error(`${LOG} Reconcile failed for ${id}:`, error);
    }
  }
  return { checked: rows.length, completed, failed: failedCount };
}
