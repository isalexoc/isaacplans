/**
 * Geometry for NLG's "Die Too Soon / Live Too Long / Become Ill" jigsaw circle, as SVG paths.
 *
 * Each piece is a 120° sector. Every edge between two pieces carries one semicircular knob; both
 * neighbours trace the SAME knob arc (walked in opposite directions), so one piece's tab is
 * exactly the other's socket and the white outline reads as a real jigsaw cut.
 *
 * Coordinates are SVG's: y grows downward, angles are degrees clockwise from +x.
 */

export type PillarKey = "dieTooSoon" | "liveTooLong" | "becomeIll";

export interface PuzzleEdge {
  angle: number;
  /** +1: the knob bulges toward increasing angle (into the clockwise neighbour); −1: the other way. */
  bulge: 1 | -1;
}

/** Where along the radius the knob sits, and how big it is, as fractions of the radius. */
const KNOB_AT = 0.52;
const KNOB_RADIUS = 0.14;

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function at(cx: number, cy: number, r: number, angle: number): string {
  const [x, y] = polar(cx, cy, r, angle);
  return `${fmt(x)} ${fmt(y)}`;
}

/**
 * One straight edge of a piece, from the center out to the rim (or back), with its knob.
 * Walking outward, a knob bulging toward +angle is a counter-clockwise half-turn (sweep 0);
 * walking the same edge inward it is clockwise (sweep 1).
 */
function edgeSegment(cx: number, cy: number, radius: number, edge: PuzzleEdge, outward: boolean): string {
  const knobCenter = KNOB_AT * radius;
  const knob = KNOB_RADIUS * radius;
  const [first, second] = outward ? [knobCenter - knob, knobCenter + knob] : [knobCenter + knob, knobCenter - knob];
  const end = outward ? radius : 0;
  const sweep = (edge.bulge === 1) === outward ? 0 : 1;
  return [
    `L ${at(cx, cy, first, edge.angle)}`,
    `A ${fmt(knob)} ${fmt(knob)} 0 0 ${sweep} ${at(cx, cy, second, edge.angle)}`,
    `L ${at(cx, cy, end, edge.angle)}`,
  ].join(" ");
}

/** A sector from `from.angle` clockwise to `to.angle`, knobs on both straight edges. */
export function piecePath(cx: number, cy: number, radius: number, from: PuzzleEdge, to: PuzzleEdge): string {
  const sweepAngle = to.angle - from.angle;
  return [
    `M ${fmt(cx)} ${fmt(cy)}`,
    edgeSegment(cx, cy, radius, from, true),
    `A ${fmt(radius)} ${fmt(radius)} 0 ${sweepAngle > 180 ? 1 : 0} 1 ${at(cx, cy, radius, to.angle)}`,
    edgeSegment(cx, cy, radius, to, false),
    "Z",
  ].join(" ");
}

/** The three cuts of the circle: 12 o'clock, 4 o'clock and 8 o'clock, as on NLG's cover. */
const CUT_TOP: PuzzleEdge = { angle: -90, bulge: 1 };
const CUT_LOWER_RIGHT: PuzzleEdge = { angle: 30, bulge: -1 };
const CUT_LOWER_LEFT: PuzzleEdge = { angle: 150, bulge: 1 };

/** Clockwise span of each pillar's piece. Die Too Soon top-left, Become Ill right, Live Too Long bottom. */
export const PIECES: Record<PillarKey, { from: PuzzleEdge; to: PuzzleEdge; labelAngle: number }> = {
  becomeIll: { from: CUT_TOP, to: CUT_LOWER_RIGHT, labelAngle: -30 },
  liveTooLong: { from: CUT_LOWER_RIGHT, to: CUT_LOWER_LEFT, labelAngle: 90 },
  dieTooSoon: { from: CUT_LOWER_LEFT, to: { ...CUT_TOP, angle: 270 }, labelAngle: 210 },
};

export const PILLAR_LABELS: Record<PillarKey, string[]> = {
  dieTooSoon: ["Die", "Too Soon"],
  liveTooLong: ["Live", "Too Long"],
  becomeIll: ["Become", "Ill"],
};

/** A single piece turned so its rim faces left — the icon at the left edge of each offers panel. */
export function sidePiecePath(cx: number, cy: number, radius: number): string {
  return piecePath(cx, cy, radius, { angle: 120, bulge: -1 }, { angle: 240, bulge: -1 });
}
