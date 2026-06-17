// ─── Background music selection by insurance category ────────────────────────────
// A subtle, low-volume music bed that matches the emotional tone of the topic.
// Host ~3 royalty-free tracks on Cloudinary and set the env vars below. Categories are
// grouped into three moods; an unmapped category falls back to "uplift".

type MusicMood = "reflective" | "hopeful" | "uplift";

const CATEGORY_MOOD: Record<string, MusicMood> = {
  // Reflective / emotional — gentle piano
  "final-expense": "reflective",
  "iul":           "reflective",
  "cancer-plans":  "reflective",
  "heart-stroke":  "reflective",
  // Warm / hopeful — health & family
  "aca":                        "hopeful",
  "dental-vision":              "hopeful",
  "hospital-indemnity":         "hopeful",
  "temporary-health-insurance": "hopeful",
  // Light corporate / informational
  "general":    "uplift",
  "tips-guides": "uplift",
  "news":        "uplift",
};

function moodUrl(mood: MusicMood): string | undefined {
  const byMood: Record<MusicMood, string | undefined> = {
    reflective: process.env.MUSIC_REFLECTIVE_URL,
    hopeful:    process.env.MUSIC_HOPEFUL_URL,
    uplift:     process.env.MUSIC_UPLIFT_URL,
  };
  // Fall back to the single global track, then to nothing.
  return byMood[mood] || process.env.JSON2VIDEO_BG_MUSIC_URL || undefined;
}

/** Returns a public music-track URL for the category, or undefined if none configured. */
export function musicUrlForCategory(category?: string): string | undefined {
  const mood = (category && CATEGORY_MOOD[category]) || "uplift";
  return moodUrl(mood);
}
