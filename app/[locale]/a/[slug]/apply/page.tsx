/*
 * app/[locale]/a/[slug]/apply/page.tsx — "Apply now" on an agent's guide, at
 * product.com/{locale}/{slug}/apply (es: /aplicar). Product domain only; 404 on isaacplans.com.
 *
 * Mirrors /health-alternative/apply/start: the real handoff is the Route Handler, which sets the
 * device cookie that claims the new application, something a Server Component cannot do. It starts
 * (or resumes, on this device) an application owned by this agent, on the product domain, and
 * refuses again on its own if the agent is not taking applications.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AGENT_PAGE_NOT_FOUND_METADATA, publicAgentForSlug } from "@/lib/tenancy/pages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = AGENT_PAGE_NOT_FOUND_METADATA;

export default async function AgentApplyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const agent = await publicAgentForSlug(slug);
  if (!agent) notFound();
  const lang = locale === "es" ? "es" : "en";
  redirect(`/api/intake/health-alternative/start?locale=${lang}&agent=${encodeURIComponent(agent.slug)}`);
}
