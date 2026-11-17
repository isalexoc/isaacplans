"use client";

import { createContext, useContext } from "react";

/**
 * The self-serve guide's quote gate: a visitor must see their prices on "Choose your plan" before
 * moving on to "Apply now". The quote screen opens it; the guide shell enforces it.
 *
 * Kept per tab in sessionStorage, so the header's language switch (which reloads the page) doesn't
 * close it again.
 */

const KEY = "impact-guide-quoted";

export function readQuoteGate(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeQuoteGate(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* the gate just closes again after a reload */
  }
}

export type GuideGate = {
  /** The visitor has their prices (or Impact's service failed and the screen sent them to WhatsApp). */
  markQuoted: () => void;
};

export const GuideGateContext = createContext<GuideGate | null>(null);

export function useGuideGate(): GuideGate | null {
  return useContext(GuideGateContext);
}
