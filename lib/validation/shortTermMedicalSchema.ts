import { z } from "zod";

function extractDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export const shortTermMedicalFormSchema = z.object({
  firstName: z
    .string()
    .min(1, "required")
    .min(2, "firstNameMinLength")
    .max(100, "firstNameMaxLength"),
  lastName: z
    .string()
    .min(1, "required")
    .min(2, "lastNameMinLength")
    .max(100, "lastNameMaxLength"),
  email: z
    .string()
    .min(1, "required")
    .email("invalidEmail"),
  phone: z
    .string()
    .min(1, "required")
    .refine(
      (val) => {
        const digits = extractDigits(val);
        return digits.length >= 10 && digits.length <= 11;
      },
      { message: "invalidPhone" }
    ),
});

export type ShortTermMedicalFormData = z.infer<typeof shortTermMedicalFormSchema>;

/**
 * Capitalize each word in a name (e.g. "roberto josé marcano mota" -> "Roberto José Marcano Mota")
 */
export function capitalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
