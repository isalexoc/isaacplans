"use client";

import { useState } from "react";
import { Headphones, Loader2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScriptLang } from "@/components/presentation-scripts/script-portable-text";
import type { ListenStatus } from "@/hooks/use-live-objection-listener";

/**
 * Arming live listening.
 *
 * The dialog exists because all-party consent law in roughly a dozen states regulates the act of
 * INTERCEPTING a conversation, not the storing of it — so "we don't save anything" is not a legal
 * defence, and disclosure is. Rather than a checkbox nobody reads, this is a teleprompter: it puts
 * the exact sentence, in the language of the call, one second before he needs it. One click per
 * call, and it makes the disclosure far more likely to actually happen.
 *
 * The second half is the Chrome picker, in the picker's own words. Getting this wrong is the
 * single most likely reason the feature appears dead: a Window share never carries audio at all.
 */

const DISCLOSURE = {
  en: "Before we go on — I use a tool on my screen that follows our conversation so I can pull up the right answers for you. It is not recording anything. Is that okay?",
  es: "Antes de continuar: uso una herramienta en mi pantalla que sigue nuestra conversación para encontrar las respuestas correctas. No se graba nada. ¿Está bien?",
};

const RULES = {
  en: [
    "Say the line above out loud and wait for a yes. If they say no, do not start.",
    "Stop before you take payment or Social Security information.",
  ],
  es: [
    "Di la línea de arriba en voz alta y espera un sí. Si dice que no, no empieces.",
    "Para antes de tomar información de pago o del seguro social.",
  ],
};

const SHARING_STEPS = {
  en: [
    'Stay on the "Chrome Tab" pane — a window share has no audio at all.',
    "Pick the tab your call audio is playing in.",
    'Leave "Also share tab audio" ticked.',
  ],
  es: [
    'Quédate en la pestaña "Pestaña de Chrome" — compartir una ventana no lleva audio.',
    "Elige la pestaña donde suena la llamada.",
    'Deja marcado "Compartir también el audio de la pestaña".',
  ],
};

interface LiveListenControlProps {
  language: ScriptLang;
  status: ListenStatus;
  error: string | null;
  onArm: () => void;
  onStop: () => void;
}

export default function LiveListenControl({
  language,
  status,
  error,
  onArm,
  onStop,
}: LiveListenControlProps) {
  const [confirming, setConfirming] = useState(false);
  const listening = status === "listening";
  const starting = status === "starting";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={listening ? "destructive" : "outline"}
        size="sm"
        disabled={starting}
        onClick={() => (listening ? onStop() : setConfirming(true))}
        className={cn(
          "h-8 gap-1.5 text-xs font-semibold",
          !listening &&
            "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        )}
      >
        {starting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Headphones className="h-3.5 w-3.5" />
        )}
        {listening
          ? language === "en"
            ? "Stop listening"
            : "Dejar de escuchar"
          : language === "en"
            ? "Listen for objections"
            : "Escuchar objeciones"}
      </Button>

      {error && (
        <p className="flex max-w-xs items-start gap-1 text-right text-[11px] text-rose-700 dark:text-rose-300">
          <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
          {error}
        </p>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-slate-50">
              {language === "en" ? "Tell the client first" : "Avísale al cliente primero"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="rounded-lg border-l-4 border-[#0077B6] bg-slate-50 px-3 py-2 text-base font-medium leading-snug text-slate-900 dark:border-[#00B4D8] dark:bg-slate-800/60 dark:text-slate-100">
                  &ldquo;{DISCLOSURE[language]}&rdquo;
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  {RULES[language].map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
                <div className="rounded-md bg-slate-100 px-3 py-2 dark:bg-slate-800">
                  <p className="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {language === "en"
                      ? "Chrome will ask what to share:"
                      : "Chrome te preguntará qué compartir:"}
                  </p>
                  <ol className="list-decimal space-y-0.5 pl-5 text-xs text-slate-600 dark:text-slate-400">
                    {SHARING_STEPS[language].map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === "en"
                    ? "Only the call tab's audio is used, and only while this is on. Your microphone is never opened. Nothing is recorded and no transcript is saved — the text lives in this tab and disappears when you stop."
                    : "Solo se usa el audio de la pestaña de la llamada, y solo mientras esto esté activo. Tu micrófono nunca se abre. No se graba nada ni se guarda ninguna transcripción: el texto vive en esta pestaña y desaparece al parar."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "en" ? "Not now" : "Ahora no"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                onArm();
              }}
              className="bg-[#0077B6] text-white hover:bg-[#0077B6]/90 dark:bg-[#00B4D8] dark:text-slate-950 dark:hover:bg-[#00B4D8]/90"
            >
              {language === "en" ? "I said it — start listening" : "Ya lo dije — empezar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
