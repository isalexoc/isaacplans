/**
 * Colour for the transcript reader: who is speaking, and what part of the script it is.
 *
 * **This file must stay under `lib/`.** `tailwind.config.ts` includes `./lib/**` in `content`
 * specifically so class maps like these survive purging — the objection badges were once invisible
 * in dark mode for exactly this reason. Every class below is a complete literal string for the same
 * reason: Tailwind cannot see a class assembled at runtime.
 *
 * The speaker palette is not invented here. `components/presentation-scripts/script-portable-text.tsx`
 * already established client = rose and agent-spoken = brand blue across the written scripts and
 * their PDFs, so a recorded call now reads in the same colours as the script it came from.
 */

import type { CallPhaseName, SpeakerRole } from "./types";

/* ─── Speakers ──────────────────────────────────────────────────────────────── */

export type SpeakerStyle = {
  /** The name chip beside the line. */
  chip: string;
  /** The vertical rule down the left of the turn. */
  rail: string;
  /** Background behind the whole turn. Empty for the agent on purpose — see below. */
  body: string;
  /** Solid dot, for legends and dense rows. */
  dot: string;
};

/**
 * Only the client gets a tinted background.
 *
 * The agent does most of the talking on a sales call, so tinting both sides would tint the page and
 * distinguish nothing. Leaving the agent on the page colour makes every client line — which is what
 * Isaac is actually studying — pop without any of them shouting.
 */
export const SPEAKER_STYLE: Record<SpeakerRole, SpeakerStyle> = {
  agent: {
    chip: "bg-[#0077B6]/10 text-[#0077B6] ring-1 ring-inset ring-[#0077B6]/25 dark:bg-[#0077B6]/25 dark:text-[#7FDCF0] dark:ring-[#4FC3E8]/40",
    rail: "bg-[#0077B6]/60 dark:bg-[#4FC3E8]/60",
    body: "",
    dot: "bg-[#0077B6] dark:bg-[#4FC3E8]",
  },
  client: {
    chip: "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-500/25 dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-400/50",
    rail: "bg-rose-400 dark:bg-rose-500",
    body: "bg-rose-50/60 dark:bg-rose-950/20",
    dot: "bg-rose-500 dark:bg-rose-400",
  },
  other: {
    chip: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/25 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/40",
    rail: "bg-slate-300 dark:bg-slate-600",
    body: "",
    dot: "bg-slate-500 dark:bg-slate-400",
  },
};

/* ─── Stages ────────────────────────────────────────────────────────────────── */

export type StageStyle = {
  /** What Isaac calls this part of the call, not what the model calls it. */
  label: string;
  /** Fits inside a rail segment. */
  short: string;
  /** Solid fill for the call-shape rail. */
  bar: string;
  /** Tinted band behind the sticky section header. */
  header: string;
  /** Small badge, e.g. on the rail legend. */
  chip: string;
  text: string;
};

/**
 * Hues are chosen for separation between ADJACENT stages, since those are the two a reader has to
 * tell apart at a glance while scrolling: sky -> violet -> teal -> indigo -> amber -> fuchsia ->
 * green -> slate. `objection` is amber to match the objection treatment used everywhere else in
 * this feature.
 */
export const STAGE_STYLE: Record<CallPhaseName, StageStyle> = {
  opening: {
    label: "Opening",
    short: "Opening",
    bar: "bg-sky-400 dark:bg-sky-500",
    header: "bg-sky-50 dark:bg-sky-950/40",
    chip: "bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-500/25 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-400/50",
    text: "text-sky-700 dark:text-sky-300",
  },
  rapport: {
    label: "Breaking the ice",
    short: "Rapport",
    bar: "bg-violet-400 dark:bg-violet-500",
    header: "bg-violet-50 dark:bg-violet-950/40",
    chip: "bg-violet-100 text-violet-900 ring-1 ring-inset ring-violet-500/25 dark:bg-violet-500/20 dark:text-violet-200 dark:ring-violet-400/50",
    text: "text-violet-700 dark:text-violet-300",
  },
  discovery: {
    label: "Qualifying questions",
    short: "Discovery",
    bar: "bg-teal-400 dark:bg-teal-500",
    header: "bg-teal-50 dark:bg-teal-950/40",
    chip: "bg-teal-100 text-teal-900 ring-1 ring-inset ring-teal-500/25 dark:bg-teal-500/20 dark:text-teal-200 dark:ring-teal-400/50",
    text: "text-teal-700 dark:text-teal-300",
  },
  presentation: {
    label: "Presenting the benefits",
    short: "Presentation",
    bar: "bg-indigo-400 dark:bg-indigo-500",
    header: "bg-indigo-50 dark:bg-indigo-950/40",
    chip: "bg-indigo-100 text-indigo-900 ring-1 ring-inset ring-indigo-500/25 dark:bg-indigo-500/20 dark:text-indigo-200 dark:ring-indigo-400/50",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  objection: {
    label: "Objections",
    short: "Objections",
    bar: "bg-amber-400 dark:bg-amber-500",
    header: "bg-amber-50 dark:bg-amber-950/40",
    chip: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-500/25 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/50",
    text: "text-amber-700 dark:text-amber-300",
  },
  trial_close: {
    label: "Trial close",
    short: "Trial close",
    bar: "bg-fuchsia-400 dark:bg-fuchsia-500",
    header: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    chip: "bg-fuchsia-100 text-fuchsia-900 ring-1 ring-inset ring-fuchsia-500/25 dark:bg-fuchsia-500/20 dark:text-fuchsia-200 dark:ring-fuchsia-400/50",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
  },
  close: {
    label: "Closing",
    short: "Close",
    bar: "bg-green-500 dark:bg-green-500",
    header: "bg-green-50 dark:bg-green-950/40",
    chip: "bg-green-100 text-green-900 ring-1 ring-inset ring-green-500/25 dark:bg-green-500/20 dark:text-green-200 dark:ring-green-400/50",
    text: "text-green-700 dark:text-green-300",
  },
  wrap: {
    label: "Wrap-up",
    short: "Wrap-up",
    bar: "bg-slate-300 dark:bg-slate-600",
    header: "bg-slate-50 dark:bg-slate-900/60",
    chip: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/25 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/40",
    text: "text-slate-600 dark:text-slate-400",
  },
};

/** Anything unrecognised still renders — a stored phase name from a future version included. */
export const FALLBACK_STAGE_STYLE: StageStyle = STAGE_STYLE.wrap;

export function stageStyle(phase: string): StageStyle {
  return STAGE_STYLE[phase as CallPhaseName] ?? FALLBACK_STAGE_STYLE;
}

/* ─── Objections ────────────────────────────────────────────────────────────── */

/**
 * Amber, not rose.
 *
 * Client turns are already rose-tinted, so repeating rose for an objection would make the most
 * important line on the call the same colour as every other thing the client said. Amber reads as
 * an alert against that tint, and matches the objection treatment already used in the analysis
 * panel and the PDF.
 */
export const OBJECTION_STYLE = {
  hard: {
    ring: "ring-2 ring-amber-500/70 dark:ring-amber-400/60",
    badge:
      "bg-amber-500 text-white ring-1 ring-inset ring-amber-600/30 dark:bg-amber-500 dark:text-amber-950",
    mark: "bg-amber-200/90 text-amber-950 dark:bg-amber-400/40 dark:text-amber-50",
    tick: "bg-amber-500 dark:bg-amber-400",
  },
  soft: {
    // A thinner, paler ring. Not dashed: Tailwind rings are box-shadows and have no dash style, so
    // a `ring-dashed` class compiles to nothing at all. The badge carries the real distinction —
    // outlined and labelled "possible" rather than filled.
    ring: "ring-1 ring-amber-400/60 dark:ring-amber-400/40",
    badge:
      "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/50",
    mark: "bg-amber-100 text-amber-950 dark:bg-amber-400/25 dark:text-amber-50",
    tick: "bg-amber-300 dark:bg-amber-500/70",
  },
} as const;

/** Search hits. Deliberately a different hue from objections so the two never read as the same. */
export const SEARCH_MARK = "bg-sky-200/90 text-sky-950 dark:bg-sky-400/40 dark:text-sky-50";
export const SEARCH_MARK_ACTIVE =
  "bg-sky-400 text-sky-950 ring-1 ring-sky-600 dark:bg-sky-300 dark:text-sky-950";
