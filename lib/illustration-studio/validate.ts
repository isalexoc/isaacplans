/**
 * Request validation for the Illustration Studio API routes.
 */

import { z } from "zod";
import { CARRIER_KEYS, COVER_PHOTO_KEYS, PREMIUM_MODES, type PresentationData } from "./types";

const money = z.number().finite().min(0).max(1_000_000_000);
const age = z.number().int().min(0).max(125);
const shortText = (max: number) => z.string().trim().max(max);

export const presentationSchema = z.object({
  carrierKey: z.enum(CARRIER_KEYS),
  carrierDisplayName: shortText(80),
  productName: shortText(120),
  productLine: shortText(80),
  issuerName: shortText(160),
  issuerLocation: shortText(160),
  policyForm: shortText(80),
  clientName: shortText(120),
  preparedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
  presentedBy: z.object({ name: shortText(120), lines: z.array(shortText(160)).max(6) }),
  coverPhoto: z.enum(COVER_PHOTO_KEYS),
  premium: z.object({ amount: money, mode: z.enum(PREMIUM_MODES) }),
  deathBenefit: money,
  cashValueBars: z.array(z.object({ age, value: money })).max(4),
  livingBenefitsAge: age.nullable(),
  livingBenefits: z
    .array(
      z.object({
        key: shortText(40),
        label: shortText(80),
        show: z.boolean(),
        prefix: z.enum(["", "Up to"]),
        amount: money.nullable(),
        text: shortText(60),
        suffix: shortText(30),
        source: z.enum(["illustration", "rider_max", "included", "manual"]),
      })
    )
    .max(8),
}) satisfies z.ZodType<PresentationData>;

/** ~45 pages of ledger text is ~130k characters; these caps only stop abuse. */
export const extractRequestSchema = z.object({
  fileName: shortText(200),
  pages: z.array(z.string().max(200_000)).min(1).max(150),
});

export const updateRequestSchema = z.object({ presentation: presentationSchema });

/** First issue, phrased for the inline banner. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
