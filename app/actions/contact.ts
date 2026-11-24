"use server";

import { getTranslations } from "next-intl/server";
import {
  shortTermMedicalFormSchema,
  capitalizeName,
} from "@/lib/validation/shortTermMedicalSchema";
import { parseServerActionResponse } from "@/lib/utils";
import { submitGuardedActionLead } from "@/lib/lead-guard/server";

export type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type ActionResult =
  | { status: null; errors?: Record<string, string>; values?: FormValues }
  | { status: "SUCCESS"; isNewContact?: boolean; errors?: Record<string, string>; values?: FormValues }
  | { status: "ERROR"; error: string; values?: FormValues; errors?: Record<string, string> }
  | { status: "VALIDATION_ERROR"; errors: Record<string, string>; values: FormValues };

const LOCALE_LOG = {
  en: "[Contact Lead EN]",
  es: "[Contact Lead ES]",
} as const;

export async function submitContactForm(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const locale = (formData.get("locale") as string) || "en";
  const isES = locale.startsWith("es");
  const logPrefix = LOCALE_LOG[isES ? "es" : "en"];

  try {
    const leadSource = String(formData.get("source") ?? "").trim() || "contact_page";

    const raw = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    };

    const result = shortTermMedicalFormSchema.safeParse(raw);

    if (!result.success) {
      const t = await getTranslations({
        locale: isES ? "es" : "en",
        namespace: "contactPage.info.form",
      });

      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (errors[field]) continue;
        const messageKey = issue.message;
        const translated =
          messageKey === "required"
            ? t("required")
            : messageKey === "invalidEmail"
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
        errors[field] = translated;
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

    // Lead Guard (lib/lead-guard): judged here, where the visitor's request landed. A held or
    // blocked lead gets the normal success screen and never reaches the CRM.
    const outcome = await submitGuardedActionLead({
      formData,
      surface: leadSource === "get_covered_fast" ? "get_covered_fast" : "contact",
      locale: isES ? "es" : "en",
      leadType: "contactPageData",
      contact: {
        firstName: capitalizedFirstName,
        lastName: capitalizedLastName,
        email,
        phone,
        language: isES ? "es" : "en",
      },
      consents: {
        smsConsent: formData.get("smsConsent") === "on",
        marketingConsent: formData.get("marketingConsent") === "on",
      },
      body: {
        firstName: capitalizedFirstName,
        lastName: capitalizedLastName,
        email,
        phone,
        contactPageData: {
          language: isES ? "es" : "en",
          source: leadSource,
          smsConsent: formData.get("smsConsent") === "on",
          marketingConsent: formData.get("marketingConsent") === "on",
        },
      },
    });

    if (outcome.kind === "phone_recheck") {
      return parseServerActionResponse({
        status: "VALIDATION_ERROR",
        errors: outcome.errors,
        values: raw,
      });
    }

    if (outcome.kind === "error") {
      console.error(`${logPrefix} API error:`, outcome.message);
      return parseServerActionResponse({
        status: "ERROR",
        error: outcome.message,
        values: raw,
      });
    }

    // No names in logs (PII).
    console.log(`${logPrefix} Lead submitted`, isES ? "- Español" : "- English");

    return parseServerActionResponse({
      status: "SUCCESS",
      isNewContact: outcome.isNewContact,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : isES
          ? "Error inesperado. Intente de nuevo."
          : "Unexpected error. Please try again.";
    console.error(
      `${logPrefix} Error:`,
      message,
      "-",
      isES ? "Español" : "English"
    );
    const raw = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    };
    return parseServerActionResponse({
      status: "ERROR",
      error: message,
      values: raw,
    });
  }
}
