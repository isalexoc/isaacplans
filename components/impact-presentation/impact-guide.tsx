"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Poppins } from "next/font/google";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { AGENT, DECK_COPY, type DeckLocale } from "./copy";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

/** Horizontal travel that counts as a swipe rather than a scroll or a tap. */
const SWIPE_PX = 70;
const STORAGE_KEY = "impact-guide-step";

/** The screen number in the URL (`#3`), 1-based, or null. */
function stepFromHash(count: number): number | null {
  const n = parseInt(window.location.hash.slice(1), 10);
  return Number.isFinite(n) && n >= 1 && n <= count ? n - 1 : null;
}

/**
 * The self-serve Impact guide: one screen at a time, for someone who isn't comfortable with
 * technology, on whatever device they opened the link on.
 *
 * Everything that moves is a big obvious button in a bar that never scrolls away. Swipes and arrow
 * keys work too, and the phone's own Back button goes to the previous screen rather than off the
 * page: every screen is a history entry (`#3`). The screen also survives the header's language
 * switch, which reloads the page under the other locale.
 */
export default function ImpactGuide({ locale, steps }: { locale: DeckLocale; steps: ReactNode[] }) {
  const t = DECK_COPY[locale];
  const g = t.guide;
  const count = steps.length;
  const [step, setStep] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const reduceMotion = useReducedMotion();
  const last = step === count - 1;

  // Arriving on #5, or back from the language switch: start where the visitor was.
  useEffect(() => {
    let start = stepFromHash(count);
    if (start === null) {
      try {
        const saved = Number(sessionStorage.getItem(STORAGE_KEY));
        if (Number.isInteger(saved) && saved > 0 && saved < count) start = saved;
      } catch {
        /* storage blocked: start at the beginning */
      }
    }
    if (start !== null && start > 0) {
      setStep(start);
      window.history.replaceState(null, "", `#${start + 1}`);
    }
    const onPop = () => setStep(stepFromHash(count) ?? 0);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [count]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(step));
    } catch {
      /* the screen just won't survive a language switch */
    }
  }, [step]);

  const go = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(count - 1, next));
      if (target === step) return;
      setStep(target);
      window.history.pushState(null, "", `#${target + 1}`);
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [count, step, reduceMotion]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step]);

  const whatsappHref = `https://wa.me/${AGENT.whatsappDigits}?text=${encodeURIComponent(g.whatsappText)}`;
  const primary = cn(
    "flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-extrabold text-white transition active:scale-[0.98]",
    "bg-[#f2735a] shadow-[0_10px_24px_rgba(242,115,90,.35)] hover:bg-[#e8644b]"
  );

  return (
    <div className={cn(poppins.className, "min-h-screen bg-[#fbf6f2] text-[#14243a] antialiased")}>
      <div
        className="mx-auto w-full max-w-xl touch-pan-y px-4 pb-44 pt-5 sm:px-6 sm:pt-8"
        onTouchStart={(e) => {
          const p = e.touches[0];
          touch.current = p ? { x: p.clientX, y: p.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          const p = e.changedTouches[0];
          touch.current = null;
          if (!start || !p) return;
          const dx = p.clientX - start.x;
          // Mostly sideways only: a diagonal scroll must never turn the page.
          if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(p.clientY - start.y) * 1.5) return;
          go(step + (dx < 0 ? 1 : -1));
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            aria-label={g.stepOf(step + 1, count)}
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {steps[step]}
          </motion.section>
        </AnimatePresence>
        <p className="mt-8 text-center text-xs text-[#56657a]">{t.notInsurance}</p>
      </div>

      {/* The one thing to do next, always in reach of a thumb. */}
      <nav
        aria-label={g.stepOf(step + 1, count)}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e6e9ef] bg-white/95 backdrop-blur-md"
      >
        <div className="h-1.5 w-full bg-[#e6e9ef]">
          <div
            className="h-full rounded-r-full bg-[#f2735a] transition-[width] duration-300"
            style={{ width: `${((step + 1) / count) * 100}%` }}
          />
        </div>
        <p className="pt-1.5 text-center text-xs font-medium text-[#56657a]">{g.stepOf(step + 1, count)}</p>
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5 sm:px-6">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="flex h-14 items-center gap-1.5 rounded-2xl px-3 text-base font-semibold text-[#56657a] hover:bg-[#fbf6f2]"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden min-[400px]:inline">{g.back}</span>
            </button>
          ) : null}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${g.questions} WhatsApp`}
            className="flex h-14 flex-none items-center gap-1.5 rounded-2xl border-2 border-[#25d366]/40 px-3 text-sm font-semibold text-[#128c4a] hover:bg-[#25d366]/10"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="hidden sm:inline">{g.questions}</span>
          </a>
          {last ? (
            <Link href="/health-alternative/apply/start" className={primary}>
              {g.apply} <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <button type="button" onClick={() => go(step + 1)} className={primary}>
              {step === 0 ? g.start : g.next} <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
