/** Internal route keys — use with next-intl Link (pathnames). */
export type RecommendationPath =
  | "aca"
  | "temporary"
  | "dentalVision"
  | "hospitalIndemnity"
  | "carriers"
  | "contact";

export type Intent =
  | "aca"
  | "temporary"
  | "dentalVision"
  | "hospitalIndemnity"
  | "unsure";

export interface GetCoveredFastAnswers {
  intent?: Intent;
  /** Two-letter state from ZIP lookup */
  state?: string;
  stateName?: string;
  /** City from ZIP lookup (when available) */
  placeName?: string;
  zip?: string;
  who?: string;
  timing?: "asap" | "thisMonth" | "exploring";
  preference?: "selfEnroll" | "helpFirst";
}

const PATH_TO_PATHNAME: Record<RecommendationPath, string> = {
  aca: "/aca",
  temporary: "/short-term-medical",
  dentalVision: "/dental-vision",
  hospitalIndemnity: "/hospital-indemnity",
  carriers: "/carriers",
  contact: "/contact",
};

export type RationaleId =
  | "aca"
  | "temporary"
  | "dentalVision"
  | "hospitalIndemnity"
  | "unsureSoon"
  | "unsureGap"
  | "unsureExplore";

/**
 * Maps quiz answers to primary/secondary enrollment paths and i18n rationale id (under funnel.result.rationale).
 * "Unsure" intent uses timing: asap → temporary first + ACA second, thisMonth → carriers, exploring → contact.
 */
export function getRecommendation(answers: GetCoveredFastAnswers): {
  primaryPath: RecommendationPath;
  secondaryPath?: RecommendationPath;
  rationaleId: RationaleId;
} {
  const { intent, timing } = answers;

  let primaryPath: RecommendationPath;
  let secondaryPath: RecommendationPath | undefined;
  let rationaleId: RationaleId;

  switch (intent) {
    case "aca":
      primaryPath = "aca";
      rationaleId = "aca";
      break;
    case "temporary":
      primaryPath = "temporary";
      rationaleId = "temporary";
      break;
    case "dentalVision":
      primaryPath = "dentalVision";
      rationaleId = "dentalVision";
      break;
    case "hospitalIndemnity":
      primaryPath = "hospitalIndemnity";
      rationaleId = "hospitalIndemnity";
      break;
    case "unsure":
      if (timing === "asap") {
        primaryPath = "temporary";
        secondaryPath = "aca";
        rationaleId = "unsureSoon";
      } else if (timing === "thisMonth") {
        primaryPath = "carriers";
        rationaleId = "unsureGap";
      } else {
        primaryPath = "contact";
        rationaleId = "unsureExplore";
      }
      break;
    default:
      primaryPath = "contact";
      rationaleId = "unsureExplore";
      break;
  }

  return { primaryPath, secondaryPath, rationaleId };
}

export function pathToPathname(path: RecommendationPath): string {
  return PATH_TO_PATHNAME[path];
}

/** Analytics-friendly query on internal links. */
export function withGcfQuery(
  pathname: string,
  primaryPath: RecommendationPath
): string {
  const params = new URLSearchParams({
    from: "gcf",
    path: primaryPath,
  });
  return `${pathname}?${params.toString()}`;
}

/** Primary CTA for Get Covered Fast when recommendation is dental & vision — carrier picker. */
export const DENTAL_VISION_SELF_ENROLL_PATHNAME = "/dental-vision/self-enrollment";

/** Primary CTA for Get Covered Fast when recommendation is hospital indemnity — carrier picker. */
export const HOSPITAL_INDEMNITY_SELF_ENROLL_PATHNAME =
  "/hospital-indemnity/self-enrollment";
