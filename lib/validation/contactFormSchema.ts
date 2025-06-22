import { z } from "zod";

export const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(7, "Invalid phone number"),
  insuranceType: z.string().min(1, "Select an insurance type"),
  message: z.string().min(5, "Message is too short"),
});
