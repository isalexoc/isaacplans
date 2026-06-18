// ─── Background music selection by insurance category ────────────────────────────
// A subtle, low-volume music bed that matches the emotional tone of the topic.
// Host ~3 royalty-free tracks on Cloudinary and set the env vars below. Categories are
// grouped into three moods; an unmapped category falls back to "uplift".

export type MusicMood = "reflective" | "hopeful" | "uplift";

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
  return moodUrl(moodForCategory(category));
}

/** Maps an insurance category to its emotional music mood (unmapped → "uplift"). */
export function moodForCategory(category?: string): MusicMood {
  return (category && CATEGORY_MOOD[category]) || "uplift";
}

// Text prompts handed to ElevenLabs Music when AI-generating a category-matched track.
export const MUSIC_MOOD_PROMPT: Record<MusicMood, string> = {
  reflective: "Gentle emotional solo piano with soft strings, slow and tender, cinematic and calm, no drums, no vocals.",
  hopeful:    "Warm hopeful acoustic with light piano and soft strings, uplifting and reassuring, gentle rhythm, no vocals.",
  uplift:     "Light optimistic corporate bed, clean soft synth and piano with a subtle beat, modern and informational, no vocals.",
};
