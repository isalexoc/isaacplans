"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LeaveBehindAgentProfile } from "@/lib/leave-behind-agent-profile";
import { isLeaveBehindAgentProfileComplete } from "@/lib/leave-behind-agent-profile";
import { fetchLeaveBehindAgentProfile } from "@/lib/leave-behind-agent-profile-api";

type LeaveBehindAgentProfileContextValue = {
  profile: LeaveBehindAgentProfile | null;
  loading: boolean;
  isComplete: boolean;
  refresh: () => Promise<void>;
  setProfile: (profile: LeaveBehindAgentProfile | null) => void;
};

const LeaveBehindAgentProfileContext =
  createContext<LeaveBehindAgentProfileContextValue | null>(null);

export function LeaveBehindAgentProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LeaveBehindAgentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchLeaveBehindAgentProfile();
      setProfile(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isComplete = useMemo(() => isLeaveBehindAgentProfileComplete(profile), [profile]);

  const value = useMemo(
    () => ({ profile, loading, isComplete, refresh, setProfile }),
    [profile, loading, isComplete, refresh]
  );

  return (
    <LeaveBehindAgentProfileContext.Provider value={value}>
      {children}
    </LeaveBehindAgentProfileContext.Provider>
  );
}

export function useLeaveBehindAgentProfile() {
  const ctx = useContext(LeaveBehindAgentProfileContext);
  if (!ctx) {
    throw new Error("useLeaveBehindAgentProfile must be used within LeaveBehindAgentProfileProvider");
  }
  return ctx;
}
