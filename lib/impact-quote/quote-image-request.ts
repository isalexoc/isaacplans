/**
 * What Isaac's "quote image for someone" box on /impact sends `POST /api/admin/impact-quote-image`,
 * checked. Only the quote's two answers travel, never a price: the route asks Impact again.
 *
 * Pure (zod only), so the offline test runs it: pnpm test:quote-prefill.
 */

import { z } from "zod";
import {
  ageOn,
  cleanQuoteImageName,
  isQuoteImageName,
  namesFitQuote,
  QUOTE_IMAGE_OTHERS_MAX,
  SENIOR_AGE,
  TIERS,
  type ImpactTierKey,
} from "./plans";

const TIER_KEYS = TIERS.map((t) => t.key) as [ImpactTierKey, ...ImpactTierKey[]];

/**
 * A name, cleaned as the box cleans it (one line, single spaces), then checked: 1–80 characters,
 * all of them ones the image's font draws, so no part of it goes out in a fallback-font request.
 */
const personName = z
  .string()
  .transform(cleanQuoteImageName)
  .refine(isQuoteImageName, "Latin letters only, at most 80 characters.");

export const quoteImageRequestSchema = z
  .object({
    /** The name the image is prepared for. */
    applicant: personName,
    /** Everyone else on the plan, in order. */
    others: z.array(personName).max(QUOTE_IMAGE_OTHERS_MAX).default([]),
    tier: z.enum(TIER_KEYS),
    lang: z.enum(["en", "es"]),
    /** How many people were quoted: 1, 2, or 3 = "3 or more". */
    asked: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** The oldest person's date of birth, a real YYYY-MM-DD. */
    oldestDob: z.string().refine((dob) => ageOn(dob) !== null, "A real YYYY-MM-DD date."),
  })
  .superRefine((body, ctx) => {
    const age = ageOn(body.oldestDob);
    if (age === null) return;
    if (!namesFitQuote(1 + body.others.length, body.asked, age >= SENIOR_AGE)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["others"], message: "More names than people quoted." });
    }
  });

export type QuoteImageRequest = z.infer<typeof quoteImageRequestSchema>;
