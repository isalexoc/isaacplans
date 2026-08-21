"use server";

import { getTranslations } from "next-intl/server";
import {
  AGENT_CRM_API_BASE,
  agentCrmAddContactTags,
  agentCrmEnsureContact,
  agentCrmGetBaseCredentials,
  agentCrmJsonHeaders,
} from "@/lib/agent-crm-contacts";
import {
  AGENT_CRM_AFFILIATE_LEAD_SOURCE,
  AGENT_CRM_AFFILIATE_LEAD_TAG,
} from "@/lib/agent-crm-affiliate";
import { capitalizeName, shortTermMedicalFormSchema } from "@/lib/validation/shortTermMedicalSchema";
import { parseServerActionResponse } from "@/lib/utils";

/**
 * The "questions first" capture on /agent-crm.
 *
 * This form is NOT the page's main call to action — the affiliate button is, and it goes straight
 * out so the referral cookie is set with zero friction. This exists for the agent who reads the
 * whole page, isn't ready to buy software today, and would otherwise leave no trace.
 *
 * Deliberately kept off `/api/create-contact`: that route is the *client* lead path and fires the
 * consumer workflows behind it. An agent asking about a CRM must never land in a
 * "thanks for your health insurance inquiry" sequence, so this writes its own contact with its own
 * source and tag.
 */

const LOG_PREFIX = "[AGENT_CRM_AFFILIATE]";

export type AgentCrmLeadValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
};

export type AgentCrmLeadResult =
  | { status: null }
  | { status: "SUCCESS" }
  | { status: "ERROR"; error: string; values: AgentCrmLeadValues }
  | { status: "VALIDATION_ERROR"; errors: Record<string, string>; values: AgentCrmLeadValues };

/** Free text the agent typed, capped so a paste bomb can't become a 40 KB CRM note. */
const MESSAGE_MAX = 1000;

export async function submitAgentCrmLead(
  _prevState: AgentCrmLeadResult,
  formData: FormData
): Promise<AgentCrmLeadResult> {
  const locale = String(formData.get("locale") ?? "en");
  const isES = locale.startsWith("es");

  const raw: AgentCrmLeadValues = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    message: String(formData.get("message") ?? "").slice(0, MESSAGE_MAX),
  };

  try {
    const parsed = shortTermMedicalFormSchema.safeParse(raw);

    if (!parsed.success) {
      // Reuses the contact form's already-translated field errors rather than adding a
      // second, drifting copy of "invalid email" in eleven languages of one.
      const t = await getTranslations({
        locale: isES ? "es" : "en",
        namespace: "contactPage.info.form",
      });
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (errors[field]) continue;
        const key = issue.message;
        errors[field] =
          key === "invalidEmail"
            ? t("invalidEmail")
            : key === "invalidPhone"
              ? t("invalidPhone")
              : key === "firstNameMinLength"
                ? t("firstNameMinLength")
                : key === "lastNameMinLength"
                  ? t("lastNameMinLength")
                  : key === "firstNameMaxLength"
                    ? t("firstNameMaxLength")
                    : key === "lastNameMaxLength"
                      ? t("lastNameMaxLength")
                      : t("required");
      }
      return parseServerActionResponse({ status: "VALIDATION_ERROR", errors, values: raw });
    }

    const credentials = agentCrmGetBaseCredentials();
    if (!credentials) {
      console.error(`${LOG_PREFIX} Missing AGENT_CRM_PI / AGENT_CRM_LOCATION_ID.`);
      return parseServerActionResponse({
        status: "ERROR",
        error: isES
          ? "No pudimos enviar tu mensaje. Escríbeme directamente a isaac@isaacplans.com."
          : "We couldn't send your message. Email me directly at isaac@isaacplans.com.",
        values: raw,
      });
    }

    const firstName = capitalizeName(parsed.data.firstName);
    const lastName = capitalizeName(parsed.data.lastName);
    const email = parsed.data.email.trim().toLowerCase();
    const digits = parsed.data.phone.replace(/\D/g, "");
    const phone = digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

    const { token, locationId } = credentials;

    const contactId = await agentCrmEnsureContact(
      { firstName, lastName, email, phone, source: AGENT_CRM_AFFILIATE_LEAD_SOURCE },
      locationId,
      token,
      LOG_PREFIX
    );

    if (!contactId) {
      return parseServerActionResponse({
        status: "ERROR",
        error: isES
          ? "No pudimos enviar tu mensaje. Intenta de nuevo o escríbeme a isaac@isaacplans.com."
          : "We couldn't send your message. Try again or email me at isaac@isaacplans.com.",
        values: raw,
      });
    }

    // Tagging and the note are both best-effort: the contact already exists at this point, and
    // making the agent retype everything because a tag call 500'd would lose the lead entirely.
    await agentCrmAddContactTags(
      contactId,
      [AGENT_CRM_AFFILIATE_LEAD_TAG, isES ? "spanish" : "english"],
      token,
      LOG_PREFIX
    );

    const message = raw.message.trim();
    if (message) {
      await createAffiliateNote(contactId, token, message, isES);
    }

    console.log(`${LOG_PREFIX} Agent captured:`, firstName, lastName, isES ? "(ES)" : "(EN)");
    return parseServerActionResponse({ status: "SUCCESS" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} Unexpected error:`, detail);
    return parseServerActionResponse({
      status: "ERROR",
      error: isES
        ? "Error inesperado. Intenta de nuevo."
        : "Unexpected error. Please try again.",
      values: raw,
    });
  }
}

/**
 * Post the agent's question as a contact note.
 *
 * A local fetch rather than `createContactNote` from `lib/agent-crm-call-summary.ts`: that module
 * pulls in OpenAI, the Neon-backed processed-call store, and the transcript formatter — a chain
 * this marketing form has no business loading to write four lines of text.
 */
async function createAffiliateNote(
  contactId: string,
  token: string,
  message: string,
  isES: boolean
): Promise<void> {
  const title = isES ? "Pregunta sobre Agent CRM" : "Agent CRM question";
  const body = `📋 ${title}\n\n${message}\n\n${isES ? "Origen" : "Source"}: /agent-crm`;

  try {
    const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${contactId}/notes`, {
      method: "POST",
      headers: agentCrmJsonHeaders(token),
      body: JSON.stringify({ title, body }),
    });
    if (!res.ok) {
      console.warn(`${LOG_PREFIX} Note failed:`, res.status, await res.text());
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Note error:`, error instanceof Error ? error.message : error);
  }
}
