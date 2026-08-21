"use server";

import { getTranslations } from "next-intl/server";
import {
  shortTermMedicalFormSchema,
  capitalizeName,
} from "@/lib/validation/shortTermMedicalSchema";
import { parseServerActionResponse } from "@/lib/utils";

/**
 * The "ask me anything first" capture on /agent-crm.
 *
 * This is NOT the page's main call to action — the affiliate button is, and it goes straight out
 * so the referral cookie is set with zero friction. This exists for the agent who reads the whole
 * page, isn't ready to buy software today, and would otherwise leave no trace.
 *
 * Goes through `/api/create-contact` exactly like every other lead form on the site, so an agent
 * recruit gets the same treatment a client does: duplicate-safe contact creation, the
 * `lead_source_details` custom field, consent captured for TCPA, locale tags, and one workflow
 * enrolment. The route knows this lead type by its `agentCrmData` blob and routes it to
 * AGENT_CRM_WORKFLOW_AGENT_CRM_AFFILIATE with an `agent_crm_affiliate` tag — that is what keeps a
 * fellow agent out of a "thanks for your health insurance inquiry" sequence.
 */

export type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
};

export type ActionResult =
  | { status: null; errors?: Record<string, string>; values?: FormValues }
  | { status: "SUCCESS"; isNewContact?: boolean; errors?: Record<string, string>; values?: FormValues }
  | { status: "ERROR"; error: string; values?: FormValues; errors?: Record<string, string> }
  | { status: "VALIDATION_ERROR"; errors: Record<string, string>; values: FormValues };

const LOCALE_LOG = {
  en: "[Agent CRM Affiliate Lead EN]",
  es: "[Agent CRM Affiliate Lead ES]",
} as const;

/** Free text the agent typed, capped so a paste bomb can't become a 40 KB CRM field. */
const MESSAGE_MAX = 1000;

export async function submitAgentCrmLead(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const locale = (formData.get("locale") as string) || "en";
  const isES = locale.startsWith("es");
  const logPrefix = LOCALE_LOG[isES ? "es" : "en"];

  const message = String(formData.get("message") ?? "").slice(0, MESSAGE_MAX);

  try {
    const raw: FormValues = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      message,
    };

    const result = shortTermMedicalFormSchema.safeParse(raw);

    if (!result.success) {
      const t = await getTranslations({
        locale: isES ? "es" : "en",
        namespace: "agentCrm.form",
      });

      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (errors[field]) continue;
        const messageKey = issue.message;
        errors[field] =
          messageKey === "invalidEmail"
            ? t("invalidEmail")
            : messageKey === "invalidPhone"
              ? t("invalidPhone")
              : messageKey === "firstNameMinLength"
                ? t("firstNameMinLength")
                : messageKey === "lastNameMinLength"
                  ? t("lastNameMinLength")
                  : messageKey === "firstNameMaxLength"
                    ? t("firstNameMaxLength")
                    : messageKey === "lastNameMaxLength"
                      ? t("lastNameMaxLength")
                      : t("required");
      }

      console.log(
        `${logPrefix} Validation failed:`,
        Object.keys(errors).join(", "),
        "-",
        isES ? "Español" : "English"
      );

      return parseServerActionResponse({
        status: "VALIDATION_ERROR",
        errors,
        values: raw,
      });
    }

    const capitalizedFirstName = capitalizeName(result.data.firstName.trim());
    const capitalizedLastName = capitalizeName(result.data.lastName.trim());
    const email = result.data.email.trim().toLowerCase();
    const phoneDigits = result.data.phone.replace(/\D/g, "");
    const phone =
      phoneDigits.length === 11 && phoneDigits.startsWith("1")
        ? `+${phoneDigits}`
        : `+1${phoneDigits}`;

    const baseUrl =
      process.env.NODE_ENV === "development"
        ? `http://localhost:${process.env.PORT || 3000}`
        : process.env.NEXT_PUBLIC_SITE_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
          "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/create-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: capitalizedFirstName,
        lastName: capitalizedLastName,
        email,
        phone,
        agentCrmData: {
          language: isES ? "es" : "en",
          source: "agent_crm_affiliate_page",
          smsConsent: formData.get("smsConsent") === "on",
          marketingConsent: formData.get("marketingConsent") === "on",
          message: message.trim(),
        },
      }),
    });

    if (!response.ok) {
      let errorData: { error?: string } = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }
      const errorMessage =
        errorData?.error || (isES ? "Error al procesar." : "Error processing.");
      console.error(`${logPrefix} API error:`, errorMessage);
      return parseServerActionResponse({
        status: "ERROR",
        error: errorMessage,
        values: raw,
      });
    }

    let data: { success?: boolean; isExisting?: boolean } = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (data.success) {
      console.log(
        `${logPrefix} Agent captured:`,
        capitalizedFirstName,
        capitalizedLastName,
        data.isExisting ? "(existing contact)" : "(new contact)",
        isES ? "- Español" : "- English"
      );
    }

    return parseServerActionResponse({
      status: "SUCCESS",
      isNewContact: !data.isExisting,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : isES
          ? "Error inesperado. Intente de nuevo."
          : "Unexpected error. Please try again.";
    console.error(
      `${logPrefix} Error:`,
      errorMessage,
      "-",
      isES ? "Español" : "English"
    );
    const raw: FormValues = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      message,
    };
    return parseServerActionResponse({
      status: "ERROR",
      error: errorMessage,
      values: raw,
    });
  }
}
