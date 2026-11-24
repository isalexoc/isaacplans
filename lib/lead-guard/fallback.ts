import "server-only";

import { createContactNote } from "@/lib/agent-crm-call-summary";
import {
  AGENT_CRM_API_BASE,
  agentCrmAddContactTags,
  agentCrmGetBaseCredentials,
  agentCrmJsonHeaders,
} from "@/lib/agent-crm-contacts";

import type { LeadGuardSurface } from "./constants";

/**
 * Last resort when a hold cannot be stored (Neon down, migration 0047 not applied): the lead still
 * must not be lost, so it goes to the CRM as a bare contact tagged `web_review` — none of the lead
 * tags, no workflow, no CAPI, no AI Setter tag — plus a note. Runs before the response (not in
 * after()), with a time budget; returns the CRM contact id, or null. Never throws.
 */

export const WEB_REVIEW_TAG = "web_review";
const BUDGET_MS = 4_000;

function withBudget<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export async function quarantineLeadInCrm(input: {
  surface: LeadGuardSurface;
  reasons: string[];
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  language?: string | null;
  smsConsent?: unknown;
  marketingConsent?: unknown;
}): Promise<string | null> {
  const creds = agentCrmGetBaseCredentials();
  if (!creds) {
    console.error("[lead-guard] quarantine impossible: AGENT_CRM_PI / AGENT_CRM_LOCATION_ID missing");
    return null;
  }
  const tags = [WEB_REVIEW_TAG, `web_review_${input.surface}`];

  const run = async (): Promise<string | null> => {
    const payload: Record<string, unknown> = {
      locationId: creds.locationId,
      firstName: input.firstName,
      lastName: input.lastName,
      source: "website_review",
      tags,
    };
    if (input.email) payload.email = input.email;
    if (input.phone) payload.phone = input.phone;
    const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/`, {
      method: "POST",
      headers: agentCrmJsonHeaders(creds.token),
      body: JSON.stringify(payload),
    });
    let data: { contact?: { id?: string }; id?: string; meta?: { contactId?: string } } = {};
    try {
      data = JSON.parse(await res.text());
    } catch {
      /* ignore */
    }
    let contactId = data.contact?.id ?? data.id ?? null;
    if (!res.ok) {
      // Duplicate: tag the existing contact instead (no field is overwritten).
      contactId = data.meta?.contactId ?? null;
      if (contactId) await agentCrmAddContactTags(contactId, tags, creds.token, "[lead-guard]");
      else console.error("[lead-guard] quarantine create failed:", res.status);
    }
    if (contactId) {
      await createContactNote({
        contactId,
        token: creds.token,
        title: "Lead del sitio retenido (revisar)",
        body: [
          "Formulario web retenido para revisión: no recibió email ni SMS automático.",
          `Formulario: ${input.surface}`,
          `Motivo: ${input.reasons.join(", ") || "revisión"}`,
          `Idioma: ${input.language ?? "?"}`,
          `Consentimiento SMS: ${input.smsConsent === true ? "Sí" : "No"} · Marketing: ${input.marketingConsent === true ? "Sí" : "No"}`,
          "Si es real: agregue las etiquetas del lead y web_verified, y póngalo en el workflow que corresponda.",
        ].join("\n"),
      });
    }
    return contactId;
  };

  try {
    return await withBudget(run(), BUDGET_MS);
  } catch (err) {
    console.error("[lead-guard] quarantine failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
