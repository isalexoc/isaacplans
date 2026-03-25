"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ShortTermMedicalQuoteModal } from "@/components/form-modal-short-term-medical";

type ShortTermMedicalCtaContextValue = {
  openQuoteModal: () => void;
  modalOpen: boolean;
};

const ShortTermMedicalCtaContext =
  createContext<ShortTermMedicalCtaContextValue | null>(null);

export function ShortTermMedicalCtaProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openQuoteModal = useCallback(() => setOpen(true), []);

  const value = useMemo(
    () => ({ openQuoteModal, modalOpen: open }),
    [open, openQuoteModal]
  );

  return (
    <ShortTermMedicalCtaContext.Provider value={value}>
      {children}
      <ShortTermMedicalQuoteModal open={open} setOpen={setOpen} />
    </ShortTermMedicalCtaContext.Provider>
  );
}

export function useShortTermMedicalCta() {
  return useContext(ShortTermMedicalCtaContext);
}
