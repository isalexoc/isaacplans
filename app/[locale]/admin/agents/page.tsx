import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import AgentsAdminClient from "@/components/admin/agents/agents-admin-client";
import { getIsAdmin } from "@/lib/auth/admin";
import { listAgentsForAdmin } from "@/lib/tenancy/agent-admin";
import { productHostLabel } from "@/lib/tenancy/site-urls";

/**
 * /admin/agents: the agent platform's agents (pilot). Create an agent, invite them (or link the
 * Clerk account that already has their email), activate or pause them, edit their profile. Agent
 * metadata only: never an agent's clients or their applications' contents, just a count.
 */

export const metadata: Metadata = {
  title: "Agent Platform | Isaac Plans Admin",
  description: "Agents of the Impact platform: invitations, status and profiles.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AgentsAdminPage() {
  if (!(await getIsAdmin())) redirect("/admin");

  const agents = await listAgentsForAdmin();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Platform</h1>
          <p className="text-sm text-muted-foreground">
            Pilot agents: invitations, status and profiles. Agents sign in at /agent (es /agente); never admins.
          </p>
        </div>
      </div>

      <AgentsAdminClient initialAgents={agents} productHost={productHostLabel()} />
    </div>
  );
}
