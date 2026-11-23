/*
 * app/[locale]/agent/page.tsx — the agent area's dashboard (/en/agent, /es/agente), on
 * isaacplans.com inside the agent area's own frame (components/site-shell/agent-app-shell.tsx).
 *
 * A linked agent who accepted the agreements sees their own Health Coverage applications (the
 * shared dashboard in agent mode: no CRM search, no Impact welcome panel; a new application starts
 * from a name, email or phone), and their guide's public address to copy. Every link stays in the
 * agent area or points at the product domain; nothing here reaches Isaac's CRM or other lines.
 *
 * Clerk-protected by middleware, except one request: a Clerk invitation landing here with its
 * ticket before the invited person has an account, which gets Clerk's sign-up and nothing else.
 */

import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import AgentAreaNotice, { AgentStatusNotice } from "@/components/agent/agent-area-notice";
import AgentJoin from "@/components/agent/agent-join";
import GuideLinkCard from "@/components/agent/guide-link-card";
import IntakeDashboard from "@/components/intake/intake-dashboard";
import { AGENT_AREA_LOB, agentAreaPage } from "@/lib/tenancy/agent-area";
import {
  agentApplicationTemplate,
  agentAreaLocale,
  agentAreaPath,
  CLERK_TICKET_PARAM,
} from "@/lib/tenancy/agent-area-routes";
import { requestIdentity } from "@/lib/tenancy/context";
import { readTenancyGates } from "@/lib/tenancy/gates";
import { agentPagePath } from "@/lib/tenancy/product-routes";
import { agentPublicProfile } from "@/lib/tenancy/profile";
import { productPublicOrigin } from "@/lib/tenancy/site-urls";
import { publicOriginForOwner } from "@/lib/tenancy/urls";

export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = agentAreaLocale((await params).locale);
  return { title: locale === "es" ? "Solicitudes" : "Applications", robots: { index: false, follow: false } };
}

const PILOT_NOTE = {
  en: "Pilot: until launch, your guide opens only on the platform's preview site.",
  es: "Piloto: hasta el lanzamiento, su guía solo abre en el sitio de prueba de la plataforma.",
} as const;

export default async function AgentDashboardPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const locale = agentAreaLocale((await params).locale);
  const search = await searchParams;

  if (!(await requestIdentity()).userId) {
    const ticket = search[CLERK_TICKET_PARAM];
    if (typeof ticket === "string" && ticket) {
      const status = typeof search.__clerk_status === "string" ? search.__clerk_status : null;
      return <AgentJoin locale={locale} status={status} redirectUrl={agentAreaPath(locale)} />;
    }
    return (await auth()).redirectToSignIn();
  }

  const gate = await agentAreaPage(locale);
  if (gate.kind === "notice") return <AgentAreaNotice kind={gate.notice} locale={locale} />;
  // Invited, paused, or a real agent while the pilot is closed: why, and the way to the profile.
  if (!gate.operator.ok) return <AgentStatusNotice status={gate.agent.status} locale={locale} />;

  const origin = productPublicOrigin();
  const guideUrl = origin ? `${origin}${agentPagePath(locale, gate.agent.slug)}` : null;
  // The client links (copy, reset) point at the product domain, where an agent's clients work.
  // Without one configured there is no working link to give out (isaacplans.com answers 404 to an
  // agent's client): null hides Copy link and says why.
  const shareOrigin = origin ? await publicOriginForOwner(gate.userId) : null;
  // The messages the agent sends a client (WhatsApp, SMS) carry the agent's name.
  const agentName = agentPublicProfile(gate.agent).displayName;

  return (
    <IntakeDashboard
      lob={AGENT_AREA_LOB}
      mode="agent"
      shareOrigin={shareOrigin}
      hrefs={{ form: agentApplicationTemplate(locale), summary: agentApplicationTemplate(locale, "summary") }}
      agentName={agentName}
      topSlot={
        <GuideLinkCard
          locale={locale}
          url={guideUrl}
          agentName={agentName}
          note={readTenancyGates().publicPages ? null : PILOT_NOTE[locale]}
        />
      }
    />
  );
}
