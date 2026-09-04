"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildLiveIndex,
  scoreWindow,
  LiveTranscriptWindow,
  ObjectionFireGate,
} from "@/lib/objections/live-match";
import type { Objection } from "@/lib/objections/types";

/**
 * Listens to the CLIENT's half of a live call and surfaces objection suggestions.
 *
 * WHAT IS CAPTURED, AND WHY IT IS ONE STREAM. The call TAB's audio, via getDisplayMedia. Tab audio
 * is what the tab PLAYS — the remote party — so it is the client and nothing else. That is perfect
 * speaker separation for free, with no diarisation and no second socket. Isaac's microphone is NOT
 * captured: every trigger in lib/objections/types.ts is a thing the CLIENT says, so a mic stream
 * would exactly double the bill, double the reconnect surface, create an echo-contamination
 * problem that otherwise does not exist, and — on a Bluetooth headset — flip the device to the
 * Hands-Free profile and degrade the live call in both directions.
 *
 * WHAT IS STORED: nothing. Transcript text lives in a 24-token ref and dies on stop or on tab
 * close. No Neon, no Sanity, no localStorage, and no API route ever receives it, so it cannot
 * reach a Vercel log either.
 */

/** Bump the ?v= whenever public/worklets/pcm16-forwarder.worklet.js changes — it is CDN-cached. */
const WORKLET_URL = "/worklets/pcm16-forwarder.worklet.js?v=1";
const WORKLET_NAME = "pcm16-forwarder";
const PREFERRED_SAMPLE_RATE = 16000;
const FRAME_SAMPLES = 2048;

/**
 * Rates ElevenLabs accepts as audio_format. We never resample: we ask the AudioContext for 16 kHz,
 * and if the platform refuses we declare whatever rate we actually got. Chrome hands back 16000,
 * 44100 or 48000, all of which are on this list.
 */
const SUPPORTED_RATES = [8000, 16000, 22050, 24000, 44100, 48000];

/** Peak amplitude that counts as "someone is talking". Tab capture of a silent call is digital
 *  silence, so this only has to clear codec comfort noise. Deliberately low: a false "still live"
 *  costs one more minute of socket; a false "gone silent" disarms him mid-call. */
const SILENCE_PEAK = 0.005;
const SILENCE_LIMIT_MS = 10 * 60_000;
const WATCHDOG_MS = 5_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000];

export type ListenStatus = "idle" | "starting" | "listening" | "error";

/**
 * What the listener is hearing, for the "Show what it's hearing" panel.
 *
 * Deliberately not part of the normal reading experience — a live transcript beside a script is a
 * distraction mid-call. It exists because without it the feature is a black box: when no card
 * appears there is no way to tell whether the tab is silent, the words are wrong, or the phrasing
 * simply is not in any objection's triggers. Still nothing persisted; this dies with the session.
 */
export type ListenDiagnostics = {
  /** Most recent transcript text from the vendor, partial or committed. */
  heard: string;
  /** Committed segments so far — proves audio is not just arriving but being finalised. */
  committed: number;
  /** Best-scoring objection for the current window, even when it was below the firing bar. */
  nearest: { title: string; score: number } | null;
  /** Objections currently in scope. Zero means nothing can ever match. */
  candidates: number;
  /** Last message the vendor sent that was not a transcript. */
  lastEvent: string | null;
};

export interface LiveSuggestion {
  objectionId: string;
  /** Distinct per fire, so a re-suggestion restarts the exit timer cleanly. */
  key: number;
}

interface UseLiveObjectionListenerArgs {
  objections: Objection[];
  lob: string;
  language: "en" | "es";
  enabled: boolean;
}

interface TokenResponse {
  success: boolean;
  error?: string;
  token?: string;
  wsUrl?: string;
  model?: string;
  maxSessionMinutes?: number;
}

/** 4 KB per frame, so a single pass. ElevenLabs takes base64 inside JSON, never binary frames. */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function useLiveObjectionListener({
  objections,
  lob,
  language,
  enabled,
}: UseLiveObjectionListenerArgs) {
  const [status, setStatus] = useState<ListenStatus>("idle");
  const [diagnostics, setDiagnostics] = useState<ListenDiagnostics>({
    heard: "",
    committed: 0,
    nearest: null,
    candidates: 0,
    lastEvent: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<LiveSuggestion | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const sampleRateRef = useRef<number>(PREFERRED_SAMPLE_RATE);
  const armedRef = useRef(false);
  const attemptRef = useRef(0);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLoudRef = useRef(0);

  const windowRef = useRef(new LiveTranscriptWindow());
  const gateRef = useRef(new ObjectionFireGate());
  const fireKeyRef = useRef(0);

  // The audio callbacks outlive any single render, so what they match against has to come from a
  // ref — otherwise switching product tabs mid-call would keep scoring the previous product.
  const matchCtxRef = useRef({ objections, lob, language });
  useEffect(() => {
    matchCtxRef.current = { objections, lob, language };
  }, [objections, lob, language]);

  const stopRef = useRef<(message?: string) => void>(() => {});

  const stop = useCallback((message?: string) => {
    armedRef.current = false;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    watchdogRef.current = null;

    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      if (socket.readyState === WebSocket.OPEN) {
        // Flush: an empty chunk with commit:true settles whatever is buffered, so the last sentence
        // before hang-up is not lost.
        try {
          socket.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: "",
              commit: true,
              sample_rate: sampleRateRef.current,
            })
          );
        } catch {
          /* already closing */
        }
      }
      socket.close();
    }

    const node = nodeRef.current;
    nodeRef.current = null;
    if (node) {
      try {
        node.port.postMessage({ type: "stop" });
      } catch {
        /* port already closed */
      }
      node.port.onmessage = null;
      node.disconnect();
    }

    // Stopping every track is what removes Chrome's blue "Stop sharing" bar.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;

    windowRef.current.reset();
    gateRef.current.reset();
    setSuggestion(null);
    setStartedAt(null);
    setStatus(message ? "error" : "idle");
    setError(message ?? null);
  }, []);
  stopRef.current = stop;

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    const win = windowRef.current;
    if (isFinal) win.commit(text);
    else win.setPartial(text);

    const { objections: objs, lob: activeLob, language: lang } = matchCtxRef.current;
    const snapshot = win.snapshot();
    const index = buildLiveIndex(objs, activeLob, lang);
    const candidate = scoreWindow(index, snapshot.tokens);

    // Reported whether or not anything fires: a near-miss with a real score is the difference
    // between "it never heard you" and "your triggers do not cover that phrasing".
    setDiagnostics((d) => ({
      ...d,
      heard: text,
      committed: snapshot.committedCount,
      candidates: index.triggers.length,
      nearest: candidate
        ? {
            title:
              objs.find((o) => o._id === candidate.objectionId)?.[
                lang === "en" ? "titleEn" : "titleEs"
              ] ?? candidate.objectionId,
            score: candidate.score,
          }
        : null,
    }));

    const fired = gateRef.current.accept(candidate, snapshot.committedCount, Date.now());
    if (!fired) return;

    fireKeyRef.current += 1;
    setSuggestion({ objectionId: fired.objectionId, key: fireKeyRef.current });
  }, []);

  /**
   * Opens (or reopens) the vendor socket. The AudioContext, the worklet and the shared stream all
   * survive a reconnect — only the socket is replaced, so a dropped Wi-Fi connection or the
   * undocumented `session_time_limit_exceeded` does not make him do the Chrome picker again.
   */
  const openSocket = useCallback(async () => {
    const res = await fetch("/api/admin/live-objections/token", { method: "POST" });
    const body = (await res.json()) as TokenResponse;
    if (!body.success || !body.token || !body.wsUrl || !body.model) {
      throw new Error(body.error ?? "Could not start listening.");
    }

    const rate = sampleRateRef.current;
    const params = new URLSearchParams({
      model_id: body.model,
      token: body.token,
      // No resampling anywhere: we declare the rate the AudioContext actually gave us.
      audio_format: `pcm_${rate}`,
      // Server-side VAD, so an objection lands as one committed transcript the moment the client
      // stops talking. No timers or endpointing heuristics of our own.
      commit_strategy: "vad",
      vad_silence_threshold_secs: "0.8",
      language_code: matchCtxRef.current.language,
    });

    const socket = new WebSocket(`${body.wsUrl}?${params.toString()}`);
    socketRef.current = socket;

    socket.onopen = () => {
      attemptRef.current = 0;
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      let data: { message_type?: string; text?: string; error?: string; warning?: string };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (data.message_type) {
        case "session_started":
          setDiagnostics((d) => ({ ...d, lastEvent: "connected" }));
          return;
        case "partial_transcript":
          if (data.text) handleTranscript(data.text, false);
          return;
        case "committed_transcript":
          if (data.text) handleTranscript(data.text, true);
          return;
        case "scribe_warning":
          console.warn("[live-objections]", data.warning);
          return;
        default:
          // Every failure mode — auth_error, quota_exceeded, unaccepted_terms, rate_limited,
          // session_time_limit_exceeded, insufficient_audio_activity — arrives as a message
          // carrying `error`, and the server closes the socket immediately afterwards. Logged
          // rather than surfaced: onclose decides whether to reconnect or give up.
          if (data.error) {
            console.error("[live-objections]", data.message_type, data.error);
            setDiagnostics((d) => ({
              ...d,
              lastEvent: `${data.message_type ?? "error"}: ${data.error}`,
            }));
          }
      }
    };

    socket.onclose = () => {
      if (!armedRef.current || socketRef.current !== socket) return;
      socketRef.current = null;

      const delay = RECONNECT_DELAYS_MS[attemptRef.current];
      // Backoff and a hard give-up, because a flapping network against a single-use token endpoint
      // would otherwise turn into a request storm: every reconnect needs a fresh POST.
      if (delay === undefined) {
        stopRef.current("Lost the transcription connection. Start listening again when ready.");
        return;
      }
      attemptRef.current += 1;
      timersRef.current.push(
        setTimeout(() => {
          if (!armedRef.current) return;
          void openSocket().catch(() =>
            stopRef.current("Could not reconnect to transcription.")
          );
        }, delay)
      );
    };
  }, [handleTranscript]);

  const arm = useCallback(async () => {
    if (!enabled || armedRef.current || status === "starting") return;
    setError(null);

    // http://localhost and http://127.0.0.1 ARE secure contexts, so `pnpm dev` works. Reaching the
    // dev server over the LAN (http://192.168.x.x:3000) is NOT, and there navigator.mediaDevices is
    // undefined rather than throwing anything readable.
    if (!window.isSecureContext || typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
      setStatus("error");
      setError("Live listening needs Chrome or Edge on desktop over HTTPS.");
      return;
    }

    setStatus("starting");

    let stream: MediaStream;
    try {
      // FIRST, and before any other await. getDisplayMedia needs transient user activation and
      // Chrome's window is about five seconds; minting the token first would sometimes spend that
      // window on a network round trip and the picker would quietly refuse to open.
      stream = await navigator.mediaDevices.getDisplayMedia({
        // Chrome does NOT support audio-only display capture — getDisplayMedia({audio:true}) alone
        // throws, which is the single most common reason this API looks broken. So we ask for video
        // and never attach the track to anything: with no sink nothing is encoded, and 1 fps keeps
        // even the capture pipeline idle. Keeping the track ALIVE is deliberate — it is what holds
        // Chrome's blue "Stop sharing" bar on screen, a kill switch he can find without being told.
        video: { frameRate: { max: 1 }, displaySurface: "browser" },
        // The tab mix is already a clean digital signal. Chrome's voice processing exists to clean
        // up a room through a microphone; run it here and AGC pumps the client's volume between
        // sentences while noise suppression chews the quiet consonants. All three off, explicitly.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        // Without this the presentations tab appears in the picker, and picking it is a perfectly
        // valid share containing no client audio at all.
        selfBrowserSurface: "exclude",
        // Lets him press "Share this tab instead" if the call moves, without stopping.
        surfaceSwitching: "include",
        // Keeps "Also share system audio" available on the Entire Screen pane, the fallback when the
        // call audio comes from a desktop softphone rather than a Chrome tab.
        systemAudio: "include",
      } as DisplayMediaStreamOptions);
    } catch (err) {
      setStatus("idle");
      // Dismissing the picker is a decision, not a fault: no error, no toast.
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      setStatus("error");
      setError("Chrome would not start the screen share.");
      return;
    }

    // THE failure everyone hits. A Window share never has audio — there is no checkbox at all — and
    // unticking "Also share tab audio" on a Tab share is just as easy. Either way the share
    // succeeds, video flows, and there is simply no client audio, silently, forever. Catch it here
    // while he is still looking at the UI.
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((track) => track.stop());
      setStatus("error");
      setError(
        'No audio was shared. Choose the "Chrome Tab" pane, pick the tab your call is in, and leave "Also share tab audio" ticked.'
      );
      return;
    }

    streamRef.current = stream;
    armedRef.current = true;
    attemptRef.current = 0;

    try {
      // Ask for 16 kHz: Chrome honours it on desktop and resamples from the device's 48 kHz with
      // its own polyphase resampler, which is better than anything hand-rolled and free. If the
      // platform refuses (exclusive-mode WASAPI), we simply declare the rate we got.
      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: PREFERRED_SAMPLE_RATE, latencyHint: "interactive" });
      } catch {
        ctx = new AudioContext({ latencyHint: "interactive" });
      }
      ctxRef.current = ctx;

      const rate = Math.round(ctx.sampleRate);
      if (!SUPPORTED_RATES.includes(rate)) {
        throw new Error(`This machine's audio runs at ${rate} Hz, which is not supported.`);
      }
      sampleRateRef.current = rate;

      await ctx.audioWorklet.addModule(WORKLET_URL);
      // A context created outside a gesture starts suspended. The click WAS the gesture, but the
      // awaits above may have outlived it, so resume explicitly rather than assume.
      if (ctx.state === "suspended") await ctx.resume();

      await openSocket();

      const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
      const node = new AudioWorkletNode(ctx, WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        // Web Audio downmixes the tab's stereo capture to mono BEFORE process() is called, so the
        // worklet needs no downmix loop of its own. ElevenLabs accepts mono only.
        channelCount: 1,
        channelCountMode: "explicit",
        channelInterpretation: "speakers",
        processorOptions: { frameSamples: FRAME_SAMPLES },
      });
      nodeRef.current = node;

      lastLoudRef.current = Date.now();
      node.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; peak: number }>) => {
        if (event.data.peak >= SILENCE_PEAK) lastLoudRef.current = Date.now();
        const socket = socketRef.current;
        // Dropped, never queued. A backlog replayed after a blip arrives as a burst of stale
        // transcript and fires a card for something said thirty seconds ago — strictly worse than
        // a gap, because he would act on it.
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(
          JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: toBase64(event.data.pcm),
            commit: false,
            sample_rate: sampleRateRef.current,
          })
        );
      };

      source.connect(node);
      // NOT connected to ctx.destination. An AudioWorkletNode with no downstream sink still runs
      // when it has a live upstream MediaStreamSource, and routing to the speakers would echo the
      // client's voice back into the room at a delay.

      // He hit Chrome's "Stop sharing", closed the call tab, or navigated it away. Same outcome as
      // pressing our own Stop.
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => stopRef.current());
      });

      const maxMinutes = 60;
      // A forgotten session is the only way this runs up a bill: billing follows audio, and we
      // stream silence to hold the socket open, so an open socket bills wall-clock. Background tabs
      // throttle setTimeout, so this can fire late — fine, it is a ceiling, not a schedule.
      timersRef.current.push(setTimeout(() => stopRef.current(), maxMinutes * 60_000));

      watchdogRef.current = setInterval(() => {
        if (Date.now() - lastLoudRef.current > SILENCE_LIMIT_MS) stopRef.current();
      }, WATCHDOG_MS);

      setStartedAt(Date.now());
      setStatus("listening");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start listening.";
      stopRef.current(message);
    }
  }, [enabled, status, openSocket]);

  useEffect(() => {
    // pagehide covers a reload and a tab close, where the cleanup below is not guaranteed to run.
    // There is deliberately NO visibilitychange handler: Isaac WILL switch to the call tab — that
    // is the normal state of a live call — and stopping on hidden would disarm every single time
    // he touches the phone. Chrome does not throttle AudioContext rendering in a hidden tab.
    const onPageHide = () => stopRef.current();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      // Covers client-side navigation off /presentations, where the MediaStream and the sharing bar
      // would otherwise outlive the page. Safe under React 19 StrictMode's dev double-mount:
      // nothing is armed, and stop() on a torn-down session is a no-op.
      stopRef.current();
    };
  }, []);

  const dismissSuggestion = useCallback(() => setSuggestion(null), []);

  return useMemo(
    () => ({
      status,
      error,
      startedAt,
      suggestion,
      diagnostics,
      isListening: status === "listening",
      arm,
      stop,
      dismissSuggestion,
    }),
    [status, error, startedAt, suggestion, diagnostics, arm, stop, dismissSuggestion]
  );
}
