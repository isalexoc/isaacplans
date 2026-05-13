export type PresentationTier = "bronze" | "silver" | "gold" | "platinum";

export type TierTheme = {
  cardGradient: string;
  accent: string;
  accentMuted: string;
  accentHero: string;
  lineGradient: string;
  borderAccent: string;
  captureBg: string;
};

export const TIER_ORDER: PresentationTier[] = ["bronze", "silver", "gold", "platinum"];

/** Bronze / Silver / Gold only — used for landscape compare image (Platinum is single-quote only). */
export type ComparisonTier = Extract<PresentationTier, "bronze" | "silver" | "gold">;
export const COMPARISON_TIER_ORDER: ComparisonTier[] = ["bronze", "silver", "gold"];

export const TIER_THEMES: Record<PresentationTier, TierTheme> = {
  bronze: {
    cardGradient:
      "linear-gradient(165deg, #120a06 0%, #1f120c 26%, #4a2c18 58%, #2a1810 82%, #100806 100%)",
    accent: "#c67d3e",
    accentMuted: "#e4a86a",
    accentHero: "#f2cfa0",
    lineGradient: "linear-gradient(90deg, transparent, #c67d3e 45%, transparent)",
    borderAccent: "rgba(198, 125, 62, 0.42)",
    captureBg: "#120a06",
  },
  silver: {
    cardGradient:
      "linear-gradient(165deg, #070b10 0%, #111820 28%, #2a3848 55%, #1a2430 78%, #070b10 100%)",
    accent: "#b4c2d4",
    accentMuted: "#8a9db0",
    accentHero: "#e8eef5",
    lineGradient: "linear-gradient(90deg, transparent, #8fa3b8 50%, transparent)",
    borderAccent: "rgba(180, 194, 212, 0.4)",
    captureBg: "#070b10",
  },
  gold: {
    cardGradient:
      "linear-gradient(165deg, #0a1628 0%, #0d1f3c 30%, #003366 70%, #0a1628 100%)",
    accent: "#d4a84b",
    accentMuted: "#e8d5a3",
    accentHero: "#f0d78c",
    lineGradient: "linear-gradient(90deg, transparent, #d4a84b, transparent)",
    borderAccent: "rgba(212, 168, 75, 0.35)",
    captureBg: "#0a1628",
  },
  platinum: {
    cardGradient:
      "linear-gradient(165deg, #05070c 0%, #0c1220 24%, #152a45 52%, #1a2030 76%, #05070c 100%)",
    accent: "#c8d6ea",
    accentMuted: "#94a8c4",
    accentHero: "#f2f5fa",
    lineGradient: "linear-gradient(90deg, transparent, #a8bdd9 48%, transparent)",
    borderAccent: "rgba(200, 214, 234, 0.38)",
    captureBg: "#05070c",
  },
};

export const TIER_LABEL_KEYS: Record<
  PresentationTier,
  "tierBronze" | "tierSilver" | "tierGold" | "tierPlatinum"
> = {
  bronze: "tierBronze",
  silver: "tierSilver",
  gold: "tierGold",
  platinum: "tierPlatinum",
};

export const TIER_MEDAL_URLS: Record<PresentationTier, string> = {
  bronze: "https://res.cloudinary.com/isaacdev/image/upload/v1778641117/bronze_j8yksr.png",
  silver: "https://res.cloudinary.com/isaacdev/image/upload/v1778641118/silver_pfcr1g.png",
  gold: "https://res.cloudinary.com/isaacdev/image/upload/v1778641117/gold_nhkm9k.png",
  platinum: "https://res.cloudinary.com/isaacdev/image/upload/v1778641117/platinum_vezqfc.png",
};

/** Outer canvas for multi-tier comparison captures */
export const COMPARISON_CAPTURE_BG = "#060a12";
