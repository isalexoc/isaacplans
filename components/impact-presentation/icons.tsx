/**
 * The deck's line icons, path for path from Isaac's HTML deck so the slides look the same. Lucide
 * has near matches for some, but not a tooth, a baby or this runner, and mixing two icon sets on
 * one slide reads as a mistake.
 */

const GLYPHS = {
  shieldCheck: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  chat: <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2-5.4A8.4 8.4 0 1 1 21 11.5z" />,
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
  ),
  stethoscope: (
    <>
      <path d="M5 3v5a5 5 0 0 0 10 0V3" />
      <path d="M10 13v2a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="11" r="2" />
    </>
  ),
  doctor: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
      <path d="M12 15v4M10 17h4" />
    </>
  ),
  phonePlus: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
      <path d="M12 7v5M9.5 9.5h5" />
    </>
  ),
  tooth: (
    <path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4 2 7 .4 2.6 1 6.5 2.5 6.5S9.5 17 12 17s3 4 4.5 4 2.1-3.9 2.5-6.5c.5-3 2-4 2-7C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z" />
  ),
  pill: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="M8.5 8.5l7 7" />
    </>
  ),
  runner: (
    <>
      <circle cx="14" cy="4.5" r="2" />
      <path d="M6 21l3.5-6 3 2.5L14 21" />
      <path d="M8 11l3-4 4 2 2 3h3" />
      <path d="M11 7l-1.5 5" />
    </>
  ),
  hospital: (
    <>
      <path d="M3 21V7l9-4 9 4v14" />
      <path d="M12 9v6M9 12h6" />
      <path d="M3 21h18" />
    </>
  ),
  baby: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M10 7.5h.01M14 7.5h.01M10.5 10a2 2 0 0 0 3 0" />
      <path d="M6 21a6 6 0 0 1 12 0" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5a3 3 0 0 0-5.8-1A3 3 0 0 0 4 9a3 3 0 0 0 0 6 3 3 0 0 0 3 5 3 3 0 0 0 5-2V5z" />
      <path d="M12 5a3 3 0 0 1 5.8-1A3 3 0 0 1 20 9a3 3 0 0 1 0 6 3 3 0 0 1-3 5 3 3 0 0 1-5-2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </>
  ),
  infinity: (
    <path d="M18.2 8.2a5 5 0 1 1 0 7.6C16 14 14 12 12 12s-4 2-6.2 3.8a5 5 0 1 1 0-7.6C8 10 10 12 12 12s4-2 6.2-3.8z" />
  ),
  bill: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  idCard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6.5 16h5M14 10h4M14 14h3" />
    </>
  ),
  payCard: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** One icon per `copy.portal.features` entry, in order (card, bills, telehealth, payments, sharing). */
export const PORTAL_ICONS: GlyphName[] = ["idCard", "bill", "phonePlus", "payCard", "heart"];

export function Glyph({
  name,
  className,
  strokeWidth = 2,
}: {
  name: GlyphName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className ?? ""}`}
    >
      {GLYPHS[name]}
    </svg>
  );
}
