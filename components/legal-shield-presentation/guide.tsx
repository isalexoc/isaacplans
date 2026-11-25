"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LS_WHATSAPP_HREF } from "@/lib/legal-shield/constants";
import { asBilling, type LsBilling } from "@/lib/legal-shield/plans";
import { LS_DECK, LS_GUIDE } from "./copy";
import { NAVY_STYLE } from "./deck-parts";
import { WhatsAppGlyph } from "./icons";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600", "700", "800", "900"], display: "swap" });

/** Horizontal travel that counts as a swipe rather than a scroll or a tap. */
const SWIPE_PX = 70;
const STEP_KEY = "ls-guide-step";
const BILLING_KEY = "ls-guide-billing";

/** Where "Llenar mi solicitud" goes: the public start, carrying the billing the client picked. */
export function lsStartHref(billing: LsBilling): string {
  return `/api/intake/legal-shield/start?lsBilling=${billing}`;
}

/** The billing picked on the price screen, shared with the bar's final button. */
type BillingState = { billing: LsBilling; setBilling: (b: LsBilling) => void };
const BillingContext = createContext<BillingState | null>(null);

export function useGuideBilling(): BillingState {
  const state = useContext(BillingContext);
  if (!state) throw new Error("useGuideBilling outside LegalShieldGuide");
  return state;
}

function stepFromHash(count: number): number | null {
  const n = parseInt(window.location.hash.slice(1), 10);
  return Number.isFinite(n) && n >= 1 && n <= count ? n - 1 : null;
}

/**
 * The self-serve Legal Shield presentation: one screen at a time, read alone on whatever device the
 * WhatsApp link opened on. The `/impacto` shell in Ysmael's navy and gold: everything that moves is
 * a big button in a bar that never scrolls away; swipes and arrow keys work too; every screen is a
 * history entry (`#3`), so the phone's Back button goes to the previous screen.
 *
 * The last screen's button starts the client's own application with the billing they picked.
 */
export default function LegalShieldGuide({ steps, startError }: { steps: ReactNode[]; startError: boolean }) {
  const g = LS_GUIDE;
  const count = steps.length;
  const [step, setStep] = useState(0);
  const [billing, setBillingState] = useState<LsBilling>("mensual");
  const touch = useRef<{ x: number; y: number } | null>(null);
  const reduceMotion = useReducedMotion();
  const last = step === count - 1;

  // Arriving on #5 (or back from the form after a failed start): start where the client was.
  useEffect(() => {
    let start = stepFromHash(count);
    try {
      if (start === null) {
        const saved = Number(sessionStorage.getItem(STEP_KEY));
        if (Number.isInteger(saved) && saved > 0 && saved < count) start = saved;
      }
      setBillingState(asBilling(sessionStorage.getItem(BILLING_KEY)));
    } catch {
      /* storage blocked: start at the beginning, monthly */
    }
    // A failed start lands back here: show the last screen, where the button and the message are.
    if (startError) start = count - 1;
    if (start !== null && start > 0) {
      setStep(start);
      window.history.replaceState(null, "", `${window.location.search}#${start + 1}`);
    }
    const onPop = () => setStep(stepFromHash(count) ?? 0);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [count, startError]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STEP_KEY, String(step));
    } catch {
      /* the screen just won't survive a reload */
    }
  }, [step]);

  const billingState = useMemo<BillingState>(
    () => ({
      billing,
      setBilling: (b) => {
        setBillingState(b);
        try {
          sessionStorage.setItem(BILLING_KEY, b);
        } catch {
          /* still carried to the button in memory */
        }
      },
    }),
    [billing]
  );

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

  const whatsappHref = `${LS_WHATSAPP_HREF}?text=${encodeURIComponent(g.whatsappText)}`;
  const primary = cn(
    "flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-lg font-extrabold text-[#07233b] transition active:scale-[0.98]",
    "bg-[linear-gradient(180deg,#f3d68a_0%,#e2bf6a_55%,#c49a44_100%)] shadow-[0_10px_24px_rgba(226,191,106,.28)] hover:brightness-105"
  );

  return (
    <BillingContext.Provider value={billingState}>
      <div className={cn(montserrat.className, "min-h-screen text-white antialiased")} style={NAVY_STYLE}>
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
          {startError && last && (
            <p role="alert" className="mb-5 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-200">
              {g.startError}
            </p>
          )}
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
          <p className="mt-8 text-center text-xs leading-relaxed text-[#8ca4ba]">{LS_DECK.disclaimer}</p>
        </div>

        {/* The one thing to do next, always in reach of a thumb. */}
        <nav
          aria-label={g.stepOf(step + 1, count)}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#041a2d]/95 backdrop-blur-md"
        >
          <div className="h-1.5 w-full bg-white/10">
            <div
              className="h-full rounded-r-full bg-[#e2bf6a] transition-[width] duration-300"
              style={{ width: `${((step + 1) / count) * 100}%` }}
            />
          </div>
          <p className="pt-1.5 text-center text-xs font-medium text-[#8ca4ba]">{g.stepOf(step + 1, count)}</p>
          <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5 sm:px-6">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => go(step - 1)}
                className="flex h-14 items-center gap-1.5 rounded-2xl px-3 text-base font-semibold text-[#c8dbee] hover:bg-white/5"
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
              className="flex h-14 flex-none items-center gap-1.5 rounded-2xl border-2 border-[#25d366]/50 px-3 text-sm font-semibold text-[#25d366] hover:bg-[#25d366]/10"
            >
              <WhatsAppGlyph className="h-5 w-5" />
              <span className="hidden sm:inline">{g.questions}</span>
            </a>
            {last ? (
              // A plain link: the start is a Route Handler that sets the device cookie and redirects.
              <a href={lsStartHref(billing)} className={primary}>
                {g.apply} <ArrowRight className="h-5 w-5" />
              </a>
            ) : (
              <button type="button" onClick={() => go(step + 1)} className={primary}>
                {step === 0 ? g.start : g.next} <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </nav>
      </div>
    </BillingContext.Provider>
  );
}
