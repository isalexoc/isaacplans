"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle, Camera, Paperclip } from "lucide-react";
import { GRADIENT_BTN, OUTLINE_BTN } from "@/components/intake-ui";
import { UI, tr, pickLocale, type IntakeLocale } from "@/lib/iul-intake/ui-strings";

/**
 * The page a client opens on their phone to send documents.
 *
 * Designed around one observation: the person using this is standing up, holding a phone, with an
 * agent waiting on the line. So there is no form, no file-type picker and nothing to read — two
 * big buttons, and a list of what they have sent.
 *
 * **Two buttons rather than one input.** "Take a photo" carries `capture="environment"`, which
 * opens the camera directly instead of the file browser; "Choose a file" is the plain picker for a
 * PDF already saved or a photo taken earlier. One combined input makes the phone ask "Camera or
 * Files?" first, which is one more decision than a client on a call should have to make.
 *
 * **Uploads start immediately and run one at a time.** A client who picks four photos should not
 * watch a progress bar and then discover the fourth failed; each is sent, confirmed and listed
 * before the next begins, so a failure is attributable to one file and everything before it is
 * already safe.
 *
 * **The list is what they sent this visit, held in this browser only.** The server never returns
 * what is on file — see the API route — because a forwarded link that lists somebody's identity
 * documents back is a worse leak than the upload it was protecting.
 */

type Boot = { firstName: string };
type Phase = "loading" | "ready" | "dead";
type Sent = { name: string };

export default function DocumentCaptureForm({ captureToken }: { captureToken: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [boot, setBoot] = useState<Boot | null>(null);
  const [deadMessage, setDeadMessage] = useState("");
  const [sent, setSent] = useState<Sent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * The URL decides the language, not the stored session.
   *
   * This page is reached at /en/iul/documents/… or /es/iul/documentos/…, and that path IS the
   * promise made to whoever was sent the link. Reading the language off the session row instead
   * meant a Spanish link rendered in English whenever the session was created before the client's
   * language was known — which is most of the time, since the session is started first.
   */
  const locale: IntakeLocale = pickLocale(useLocale());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/iul-intake/document-capture/${captureToken}`, {
          credentials: "same-origin",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !json?.success) {
          setDeadMessage(json?.error ?? "This link is not available.");
          setPhase("dead");
          return;
        }
        setBoot({ firstName: json.firstName ?? "" });
        setPhase("ready");
      } catch {
        if (active) {
          setDeadMessage("Could not open this link. Please check your connection.");
          setPhase("dead");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [captureToken]);

  /** Send one file and wait for it, so a failure names the file it belongs to. */
  async function sendOne(file: File): Promise<boolean> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/iul-intake/document-capture/${captureToken}`, {
      method: "POST",
      credentials: "same-origin",
      body,
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 410) {
      setDeadMessage(json?.error ?? "This link is no longer active.");
      setPhase("dead");
      return false;
    }
    if (!res.ok || !json?.success) {
      setError(
        json?.code === "too_large" ? tr(UI.docTooLarge, locale) : tr(UI.docUploadError, locale)
      );
      return false;
    }
    setSent((prev) => [...prev, { name: json.name ?? file.name }]);
    return true;
  }

  async function onPicked(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    // Sequential on purpose — see the header note on attributable failures.
    for (const file of Array.from(list)) {
      const ok = await sendOne(file);
      if (!ok) break;
    }
    setBusy(false);
    // Clear both inputs so picking the same file twice still fires a change event.
    if (cameraRef.current) cameraRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {tr(UI.loading, locale)}
      </div>
    );
  }

  if (phase === "dead") {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertCircle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </span>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{deadMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-24 pt-8">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
          <Paperclip className="h-6 w-6 text-brand" />
        </span>
        <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">
          {boot?.firstName
            ? tr(UI.docClientTitleNamed, locale).replace("{name}", boot.firstName)
            : tr(UI.docClientTitle, locale)}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {tr(UI.docClientIntro, locale)}
        </p>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-500">
          <ShieldCheck className="h-4 w-4" /> {tr(UI.captureSecureNote, locale)}
        </p>
      </div>

      <p className="mb-4 rounded-2xl bg-gray-50 p-4 text-sm leading-relaxed text-muted-foreground dark:bg-gray-900">
        {tr(UI.docClientHelp, locale)}
      </p>

      {/* Hidden inputs. `capture="environment"` opens the rear camera straight away rather than a
          chooser. The second input carries NO `accept` on purpose: the agent may need a PDF, a
          scan, a photo or something none of us predicted, and any allow-list here shows a client a
          file they cannot select. The server enforces the only real limits — size, and a short
          list of executable extensions. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPicked(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onPicked(e.target.files)}
      />

      <div className="space-y-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className={`${GRADIENT_BTN} disabled:cursor-not-allowed`}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {tr(UI.docUploading, locale)}
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" /> {tr(UI.docTakePhoto, locale)}
            </>
          )}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={`${OUTLINE_BTN} py-3`}
        >
          <Paperclip className="h-4 w-4" /> {tr(UI.docChooseFile, locale)}
        </button>
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {sent.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {tr(UI.docSentHeading, locale)}
          </p>
          <ul className="space-y-2">
            {sent.map((s, i) => (
              <li
                key={`${s.name}-${i}`}
                className="flex items-center gap-2 rounded-xl border-2 border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                <span className="truncate">{s.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {tr(UI.docSendAnother, locale)}
          </p>
        </div>
      )}

      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
        {tr(UI.docClientFooter, locale)}
      </p>
    </div>
  );
}
