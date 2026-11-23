"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

/** The agent area's sign-out: back to the agent dashboard, which asks for a sign-in again. */
export default function AgentSignOutButton({ label, redirectUrl }: { label: string; redirectUrl: string }) {
  return (
    <SignOutButton redirectUrl={redirectUrl}>
      <button
        type="button"
        className="flex h-10 flex-none items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-[#0b2a4a] hover:bg-[#fbf6f2] dark:text-gray-200 dark:hover:bg-gray-900"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </SignOutButton>
  );
}
