import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getIsAdmin } from "@/lib/auth/admin";
import { getAgentLicensesForAdmin } from "@/lib/agent-licenses";
import { getLicensedStates } from "@/lib/licensed-states";
import AgentLicensesClient from "@/components/admin/agent-licenses-client";

export const metadata: Metadata = {
  title: "Agent Licenses | Isaac Plans",
  description: "Upload and manage agent license images.",
  robots: { index: false, follow: false },
};

export default async function AgentLicensesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getIsAdmin())) redirect("/admin");

  const [licenses, states] = await Promise.all([getAgentLicensesForAdmin(), getLicensedStates()]);

  return (
    <AgentLicensesClient
      licenses={licenses}
      // A state saved in Studio without a code can't be a Select option
      // (Radix rejects an empty value), so skip it rather than break the picker.
      states={states.filter(({ code }) => code).map(({ code, name }) => ({ code, name }))}
    />
  );
}
