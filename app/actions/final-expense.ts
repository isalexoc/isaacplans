"use server";

import { getTranslations } from "next-intl/server";
import {
  shortTermMedicalFormSchema,
  capitalizeName,
} from "@/lib/validation/shortTermMedicalSchema";
import { parseServerActionResponse } from "@/lib/utils";

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
  en: "[Final Expense Lead EN]",
  es: "[Final Expense Lead ES]",
} as const;

export async function submitFinalExpenseLeadForm(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const locale = (formData.get("locale") as string) || "en";
  const isES = locale.startsWith("es");
  const logPrefix = LOCALE_LOG[isES ? "es" : "en"];

  try {
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
        namespace: "FEpage.leadForm",
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
        finalExpenseData: {
          language: isES ? "es" : "en",
          source: "final_expense_page_cta",
          smsConsent: formData.get("smsConsent") === "on",
          marketingConsent: formData.get("marketingConsent") === "on",
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
      const message =
        errorData?.error || (isES ? "Error al procesar." : "Error processing.");
      console.error(`${logPrefix} API error:`, message);
      return parseServerActionResponse({
        status: "ERROR",
        error: message,
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
        `${logPrefix} Lead submitted successfully:`,
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
