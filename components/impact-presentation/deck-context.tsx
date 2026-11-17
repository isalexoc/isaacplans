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
