/**
 * What the product domain's pages and the client's token pages need to know before they render.
 * Server-only (database, and Clerk on isaacplans.com only).
 *
 *  - `publicAgentForSlug`: the agent behind /{l}/{slug}[/apply|/privacy] on the product domain, or
 *    null (a 404): a valid slug, an active agent linked to a sign-in that isn't one of Isaac's, and
 *    open by the launch gates (`agentPublicPagesOpen`: TENANT_PUBLIC_PAGES, or a test agent on a
 *    preview deployment with PLATFORM_PREVIEW=1). Never on isaacplans.com.
 *  - `intakeTokenOwner` / `captureTokenOwner`: whose session a client's token page belongs to, which
 *    decides the surface it is served from (lib/tenancy/product-routes.ts `decideTokenPage`). One
 *    narrow query each (the owner column only, never the client's answers), plus the `agents`
 *    lookup for an owner not listed in env. A failed lookup is "unknown", never "not an agent".
 *  - `callerKeepsMainView`: on isaacplans.com, whether the caller of an agent's client page is the
 *    owner or a signed-in operator, who stay on the page (and get the API's audited answer) instead
 *    of being sent to the product domain as if they were the client.
 * Each lookup is cached per request, so a page and its metadata share one query.
 */

import "server-only";
import { cache } from "react";
import type { Metadata } from "next";
import { getIntakeConfig } from "@/lib/intake-configs";
import { getIntakeOwnerByToken } from "@/lib/intake-core/server";
import { getCaptureOwnerByToken } from "@/lib/intake-core/secure-capture";
import { getAgentBySlug, type AgentRow } from "./agents";
import { classifySignedInCaller, ownerAgentOf, requestIdentity } from "./context";
import { isListedPlatformOwner } from "./crm";
import { agentPublicPagesOpen, readPlatformPreview, readTenancyGates } from "./gates";
import { callerIsOperator } from "./operator";
import type { ProductLocale, TokenPageOwnerFact } from "./product-routes";
import { platformName, productPublicOrigin } from "./site-urls";
import { checkAgentSlug } from "./slugs";
import { isProductSurface } from "./surface";

/** Every agent page: never indexed. Its preview image is Impact's, served from the product domain. */
const NOINDEX: Metadata["robots"] = { index: false, follow: false, nocache: true };
const SHARE_IMAGE = "/images/impact/presentation/og-impact.jpg";

/**
 * The metadata of an agent's page on the product domain: noindex, and an explicit share image
 * (Impact's art from public/, never a file-based opengraph-image, whose own route the product
 * middleware would answer with a 404). Nothing of Isaac's: the site name is the platform's.
 */
export function agentPageMetadata(input: {
  title: string;
  description: string;
  locale: ProductLocale;
  /** The page's public path ("/es/maria-lopez"). */
  path: string;
}): Metadata {
  const origin = productPublicOrigin();
  const images = [{ url: `${origin ?? ""}${SHARE_IMAGE}`, width: 1200, height: 630, alt: "Impact Health Sharing" }];
  return {
    title: input.title,
    description: input.description,
    robots: NOINDEX,
    openGraph: {
      title: input.title,
      description: input.description,
      type: "website",
      siteName: platformName(),
      locale: input.locale === "es" ? "es_US" : "en_US",
      ...(origin ? { url: `${origin}${input.path}` } : {}),
      images,
    },
    twitter: { card: "summary_large_image", title: input.title, description: input.description, images },
  };
}

/** An agent page that won't render (no such agent, gated off, Isaac's site): noindex only. */
export const AGENT_PAGE_NOT_FOUND_METADATA: Metadata = { robots: NOINDEX };

export const publicAgentForSlug = cache(async (slug: string): Promise<AgentRow | null> => {
  if (!isProductSurface()) return null;
  const check = checkAgentSlug(slug);
  if (!check.ok) return null;
  // A failed query throws: a 500 the visitor can retry, never a cached "no such agent".
  const agent = await getAgentBySlug(check.slug);
  if (!agent?.clerkUserId || agent.slug !== check.slug) return null;
  // A row linked to one of Isaac's own ids is a misconfiguration (the start route refuses it too).
  if (isListedPlatformOwner(agent.clerkUserId)) return null;
  return agentPublicPagesOpen(agent, readTenancyGates(), readPlatformPreview()) ? agent : null;
});

export type TokenOwner =
  | { kind: "missing" }
  /** The session or agent lookup failed: neither "Isaac's" nor "an agent's" can be ruled out. */
  | { kind: "unknown" }
  | { kind: "platform"; lob: string; ownerUserId: string }
  | { kind: "agent"; lob: string; ownerUserId: string; agent: AgentRow };

async function ownerOf(lob: string, ownerUserId: string): Promise<TokenOwner> {
  const agent = await ownerAgentOf(ownerUserId);
  if (agent === "unknown") return { kind: "unknown" };
  return agent ? { kind: "agent", lob, ownerUserId, agent } : { kind: "platform", lob, ownerUserId };
}

export const intakeTokenOwner = cache(async (lob: string, token: string): Promise<TokenOwner> => {
  const config = getIntakeConfig(lob);
  if (!config || !/^[A-Za-z0-9_-]{8,128}$/.test(token)) return { kind: "missing" };
  try {
    const row = await getIntakeOwnerByToken(config, token);
    return row ? await ownerOf(config.lob, row.ownerUserId) : { kind: "missing" };
  } catch (error) {
    console.warn("[tenancy] token page owner lookup failed:", error instanceof Error ? error.message : error);
    return { kind: "unknown" };
  }
});

export const captureTokenOwner = cache(async (captureToken: string): Promise<TokenOwner> => {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(captureToken)) return { kind: "missing" };
  try {
    const row = await getCaptureOwnerByToken(captureToken);
    return row ? await ownerOf(row.lob, row.ownerUserId) : { kind: "missing" };
  } catch (error) {
    console.warn("[tenancy] secure link owner lookup failed:", error instanceof Error ? error.message : error);
    return { kind: "unknown" };
  }
});

/** The owner as `decideTokenPage` takes it. */
export function tokenOwnerFact(owner: TokenOwner): TokenPageOwnerFact {
  return owner.kind === "agent" ? owner.agent : owner.kind;
}

/**
 * isaacplans.com only. The owner (an agent working on their own client's form) or any signed-in
 * operator — an admin, another agent, someone whose agent lookup failed, an impersonated session —
 * keeps the page there. A visitor who isn't signed in, or a plain signed-in client, is the client.
 */
export async function callerKeepsMainView(ownerUserId: string): Promise<boolean> {
  if (isProductSurface()) return false;
  const { userId, actor } = await requestIdentity();
  if (!userId) return false;
  if (userId === ownerUserId) return true;
  const kind = await classifySignedInCaller(userId, { ownerIsAgent: true });
  return callerIsOperator(kind, Boolean(actor));
}
