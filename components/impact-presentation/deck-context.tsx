"use client";

import { createContext, useContext } from "react";

/** What a slide can ask of the deck around it. The slides are server-rendered; this is the bridge. */
export type DeckControls = {
  /** Swap the deck for the intake form, in the same (shared) tab. */
  openForm: () => void;
};

export const DeckContext = createContext<DeckControls | null>(null);

export function useDeck(): DeckControls | null {
  return useContext(DeckContext);
}

/**
 * Whether the slide around a component is the one on screen. Every slide stays mounted (hidden),
 * so anything a slide does on its own, like sending its plan to the form, waits for this. False
 * outside a deck, and until the deck knows which slide it is on.
 */
export const SlideActiveContext = createContext(false);

export function useSlideActive(): boolean {
  return useContext(SlideActiveContext);
}
