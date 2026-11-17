"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Poppins } from "next/font/google";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import IntakeForm from "@/components/intake/intake-form";
import { UI, tr } from "@/lib/intake-core/ui-strings";
import { cn } from "@/lib/utils";
import { DeckContext } from "./deck-context";
import type { DeckLocale } from "./copy";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

/** The canvas every slide is drawn on (9:16, phone-shaped). */
const STAGE_W = 900;
const STAGE_H = 1600;
/** Horizontal travel that counts as a swipe rather than a tap. */
const SWIPE_PX = 60;

type View = "slides" | "form";

/**
 * Where the agent is in the deck, kept per tab in sessionStorage.
 *
 * Switching language (the header's switch, or L) loads the page again under the other locale, and
 * the deck remounts with it. Without this the client would be thrown back to the welcome slide
 * every time.
 */
function useDeckPosition(token: string, count: number) {
  const key = `impact-presentation:${token}`;
  const [slide, setSlide] = useState(0);
  const [view, setView] = useState<View>("slides");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null") as { slide?: unknown; view?: unknown } | null;
      if (typeof saved?.slide === "number") setSlide(Math.max(0, Math.min(count - 1, saved.slide)));
      if (saved?.view === "form") setView("form");
    } catch {
      /* private window or blocked storage: start at the beginning */
    }
    setRestored(true);
  }, [key, count]);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ slide, view }));
    } catch {
      /* the position just won't survive a language switch */
    }
  }, [key, restored, slide, view]);

  return { slide, setSlide, view, setView, restored };
}

/** The canvas scale that fits the frame, 0 until measured (the stage stays hidden until then). */
function useStageScale(frameRef: RefObject<HTMLDivElement | null>, active: boolean): number {
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = frameRef.current;
    if (!active || !el) return;
    const fit = () => setScale(Math.min(el.clientWidth / STAGE_W, el.clientHeight / STAGE_H));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [frameRef, active]);
  return scale;
}

/** No page scroll behind the deck: the frame is exactly the window under the header. */
function useLockedPageScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    window.scrollTo(0, 0);
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [active]);
}

const NEXT_KEYS = ["arrowright", "pagedown", " ", "enter"];
const PREV_KEYS = ["arrowleft", "pageup", "backspace"];

/**
 * The Impact sales deck: Isaac's 9:16 slides, scaled to whatever window he shares through
 * CrankWheel, plus the intake form behind "Confirm my details".
 *
 * Keys, as in the HTML deck: → / ← (and Space, Enter, Page Up/Down) move, 1–9 jump, Home / End,
 * L switches language, F toggles full screen. A swipe moves on touch screens.
 */
export default function ImpactPresentation({
  token,
  locale,
  slides,
}: {
  token: string;
  locale: DeckLocale;
  slides: ReactNode[];
}) {
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const touchX = useRef<number | null>(null);
  const { slide, setSlide, view, setView, restored } = useDeckPosition(token, slides.length);
  const showingSlides = view === "slides";
  const scale = useStageScale(frameRef, showingSlides && restored);
  useLockedPageScroll(showingSlides);

  const go = useCallback(
    (i: number) => setSlide(Math.max(0, Math.min(slides.length - 1, i))),
    [setSlide, slides.length]
  );

  const switchLanguage = useCallback(() => {
    router.replace(
      { pathname: "/health-alternative/intake/[token]/presentation", params: { token } },
      { locale: locale === "es" ? "en" : "es" }
    );
  }, [router, token, locale]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    if (!showingSlides) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      // Enter or Space on a focused button already clicks it; don't also turn the page.
      if ((key === "enter" || key === " ") && (tag === "BUTTON" || tag === "A")) return;
      if (NEXT_KEYS.includes(key)) {
        e.preventDefault();
        go(slide + 1);
      } else if (PREV_KEYS.includes(key)) {
        e.preventDefault();
        go(slide - 1);
      } else if (key === "home") go(0);
      else if (key === "end") go(slides.length - 1);
      else if (/^[1-9]$/.test(key)) go(Number(key) - 1);
      else if (key === "l") switchLanguage();
      else if (key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showingSlides, slide, slides.length, go, switchLanguage, toggleFullscreen]);

  const controls = useMemo(
    () => ({
      openForm: () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        setView("form");
        window.scrollTo(0, 0);
      },
    }),
    [setView]
  );

  if (!showingSlides) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <button
            type="button"
            onClick={() => setView("slides")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> {tr(UI.backToPresentation, locale)}
          </button>
        </div>
        <IntakeForm lob="health-alternative" token={token} presenting />
      </div>
    );
  }

  return (
    <DeckContext.Provider value={controls}>
      <div
        ref={frameRef}
        className={cn(
          poppins.className,
          "relative h-[calc(100dvh-4rem-1px)] w-full touch-pan-y overflow-hidden bg-[#071c33] antialiased md:h-[calc(100dvh-5rem-1px)]"
        )}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start === null || end === undefined || Math.abs(end - start) < SWIPE_PX) return;
          go(slide + (end < start ? 1 : -1));
        }}
      >
        <div
          className={cn(
            "absolute left-1/2 top-1/2 h-[1600px] w-[900px] overflow-hidden bg-[#fbf6f2]",
            scale > 0 ? "visible" : "invisible"
          )}
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          {slides.map((content, i) => (
            <div
              key={i}
              aria-hidden={i !== slide}
              className={cn(
                "absolute inset-0 transition-opacity duration-300 ease-out",
                i === slide ? "visible opacity-100" : "invisible opacity-0"
              )}
            >
              {content}
            </div>
          ))}
        </div>

        {/* Faded until hovered, so it stays out of the client's picture. */}
        <nav
          aria-label={locale === "es" ? "Láminas" : "Slides"}
          className="absolute bottom-2.5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#071c33]/60 px-3 py-2 opacity-0 backdrop-blur-md transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100"
        >
          <button
            type="button"
            onClick={() => go(slide - 1)}
            aria-label={locale === "es" ? "Anterior" : "Previous"}
            className="rounded-full border border-white/30 p-1 text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`${i + 1}`}
              aria-current={i === slide ? "step" : undefined}
              className={cn(
                "h-2.5 rounded-full transition-all",
                i === slide ? "w-6 bg-[#f2735a]" : "w-2.5 bg-white/35"
              )}
            />
          ))}
          <button
            type="button"
            onClick={() => go(slide + 1)}
            aria-label={locale === "es" ? "Siguiente" : "Next"}
            className="rounded-full border border-white/30 p-1 text-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      </div>
    </DeckContext.Provider>
  );
}
