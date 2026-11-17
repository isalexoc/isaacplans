"use client";

import type { ReactNode } from "react";
import { useDeck } from "./deck-context";

/** "Confirm my details" on the last slide: the shared tab turns into the client's intake form. */
export default function ConfirmDetailsButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const deck = useDeck();
  return (
    <button type="button" onClick={() => deck?.openForm()} className={className}>
      {children}
    </button>
  );
}
